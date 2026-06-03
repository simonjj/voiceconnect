/**
 * HealthMonitor — periodically probes each registered agent's `/healthz`
 * endpoint and pushes state-change events over the websocket so the UI can
 * render a per-agent health dot ("is this thing actually working?").
 *
 * State derivation:
 *   - HTTP 2xx, no `sandbox_reachable: false` field      → 'ok'
 *   - HTTP 2xx but `sandbox_reachable: false`            → 'degraded'
 *     (relay is up but the sandbox behind it is asleep / unreachable —
 *      a real /chat call would 502 until the sandbox resumes)
 *   - HTTP non-2xx, network error, or timeout            → 'down'
 *
 * Polling cadence: every 10s with a 5s per-probe timeout. We only broadcast
 * when state OR last_error changes (latency drift alone doesn't churn the UI).
 */
import { listAgents } from './db.js';
import type { Agent, AgentHealth } from './types.js';

const POLL_INTERVAL_MS = 10_000;
const HEALTH_TIMEOUT_MS = 5_000;

export class HealthMonitor {
  private state: Map<string, AgentHealth> = new Map();
  private interval: NodeJS.Timeout | null = null;
  private readonly onChange: (id: string, h: AgentHealth) => void;

  constructor(onChange: (id: string, h: AgentHealth) => void) {
    this.onChange = onChange;
  }

  getAll(): Record<string, AgentHealth> {
    return Object.fromEntries(this.state);
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => { void this.tick(); }, POLL_INTERVAL_MS);
    void this.tick();
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private async tick(): Promise<void> {
    const agents = listAgents();
    const liveIds = new Set(agents.map((a) => a.id));
    for (const id of [...this.state.keys()]) {
      if (!liveIds.has(id)) this.state.delete(id);
    }
    await Promise.all(agents.map((a) => this.probeAgent(a)));
  }

  private async probeAgent(agent: Agent): Promise<void> {
    const url = agent.url.replace(/\/+$/, '') + '/healthz';
    const start = Date.now();
    let next: AgentHealth;
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), HEALTH_TIMEOUT_MS);
      const res = await fetch(url, { signal: ac.signal });
      clearTimeout(t);
      const latency = Date.now() - start;
      if (!res.ok) {
        next = { state: 'down', latency_ms: latency, last_error: `HTTP ${res.status}`, checked_at: Date.now() };
      } else {
        const body: any = await res.json().catch(() => ({}));
        const sandboxField = body && Object.prototype.hasOwnProperty.call(body, 'sandbox_reachable')
          ? body.sandbox_reachable
          : undefined;
        if (sandboxField === false) {
          next = {
            state: 'degraded',
            latency_ms: latency,
            last_error: (body && (body.sandbox_error || body.sandbox_status_code))
              ? `sandbox: ${body.sandbox_error ?? `HTTP ${body.sandbox_status_code}`}`
              : 'sandbox unreachable',
            checked_at: Date.now(),
          };
        } else {
          next = { state: 'ok', latency_ms: latency, checked_at: Date.now() };
        }
      }
    } catch (e: any) {
      const isTimeout = e?.name === 'AbortError';
      next = {
        state: 'down',
        latency_ms: Date.now() - start,
        last_error: isTimeout ? 'timeout' : (e?.message || String(e)).slice(0, 200),
        checked_at: Date.now(),
      };
    }
    const prev = this.state.get(agent.id);
    this.state.set(agent.id, next);
    if (!prev || prev.state !== next.state || prev.last_error !== next.last_error) {
      this.onChange(agent.id, next);
    }
  }
}

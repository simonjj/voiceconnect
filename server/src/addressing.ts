/**
 * Address detection for multi-agent routing.
 *
 * Recognizes:
 *   - "hey {name}, ..."          → [name]
 *   - "{name}, ..."              → [name]
 *   - "{name}: ..."              → [name]
 *   - "team, ..." / "both ..."   → all active agents (broadcast)
 *   - "everyone, ..."            → all active agents (broadcast)
 *   - anything else              → [] (caller decides fallback)
 *
 * Pure function — no side effects, no I/O.
 *
 * Phase 2 §2.6 / Q2 decision: Standard grammar.
 */
import type { Agent } from './types.js';

const BROADCAST_KEYWORDS = ['team', 'both', 'everyone', 'everybody', 'all of you', 'you all', 'panel'];

export interface AddressDetection {
  /** Agents the user is addressing. Empty = no explicit addressee. */
  addressees: Agent[];
  /** Whether the user used a broadcast keyword (team/both/everyone). */
  isBroadcast: boolean;
  /** Transcript with the address prefix stripped, so agents don't repeat it back. */
  cleanedText: string;
}

const ADDRESS_PREFIX_PATTERNS = [
  // "hey sre agent," / "hey claude:" — capture up to two name tokens.
  /^\s*(?:hey|hi|hello|ok)[,]?\s+([\w-]+(?:\s+[\w-]+)?)\s*[,:]?\s*/i,
  // "sre agent," / "claude," (vocative comma)
  /^\s*([\w-]+(?:\s+[\w-]+)?)\s*,\s*/,
  // "claude:" (name + colon)
  /^\s*([\w-]+(?:\s+[\w-]+)?)\s*:\s*/,
];

const BROADCAST_PREFIX_PATTERN =
  /^\s*(?:hey\s+|ok\s+)?(team|both|everyone|everybody|all of you|you all|panel)\s*[,:]?\s*/i;

/**
 * Per-agent.id ASR aliases. These are extra strings the matcher accepts in
 * addition to the agent's display name and id. Useful when:
 *   - the brand name is hard for Whisper to transcribe (e.g. acronyms)
 *   - the agent has been rebranded but should still answer to legacy names
 */
const AGENT_ASR_ALIASES: Record<string, string[]> = {
  sre: ['sage', 'sre', 's r e', 'es are ee', 'essary', 'sri agent', 'sri'],
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Detect addressees in a transcript.
 *
 * @param transcript Raw STT text from the user.
 * @param activeAgents Agents currently selected as active (door-open) by the user.
 * @returns Detection with addressees, broadcast flag, and cleaned text.
 */
export function detectAddressees(transcript: string, activeAgents: Agent[]): AddressDetection {
  const text = transcript ?? '';

  // 1. Broadcast keywords take precedence.
  const broadcastMatch = text.match(BROADCAST_PREFIX_PATTERN);
  if (broadcastMatch) {
    return {
      addressees: [...activeAgents],
      isBroadcast: true,
      cleanedText: text.slice(broadcastMatch[0].length).trim(),
    };
  }

  // Build a name → agent index for O(1) lookup. Match on display name, id,
  // and any per-agent ASR aliases (lowercased, whitespace-collapsed).
  const byName = new Map<string, Agent>();
  for (const agent of activeAgents) {
    byName.set(normalize(agent.name), agent);
    byName.set(normalize(agent.id), agent);
    const aliases = AGENT_ASR_ALIASES[agent.id] ?? [];
    for (const alias of aliases) byName.set(normalize(alias), agent);
  }

  // 2. Try address-prefix patterns in order. For each pattern, prefer the
  // longest captured form (2 tokens), and fall back to the first token only.
  for (const pattern of ADDRESS_PREFIX_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const captured = match[1];
    const tokens = captured.trim().split(/\s+/);

    // Try the full capture first (e.g. "sre agent"), then just the first
    // token (e.g. "claude"). This lets single-word vocatives still work
    // even though the pattern allows up to two tokens.
    const candidates = tokens.length > 1 ? [normalize(captured), normalize(tokens[0])] : [normalize(captured)];

    let agent: Agent | undefined;
    let matchedCandidate: string | undefined;
    for (const c of candidates) {
      const found = byName.get(c);
      if (found) {
        agent = found;
        matchedCandidate = c;
        break;
      }
    }
    if (!agent || !matchedCandidate) continue;

    // If we matched only the first token, recompute the prefix length so we
    // don't strip a trailing word that wasn't part of the address.
    let prefixLen = match[0].length;
    if (matchedCandidate === normalize(tokens[0]) && tokens.length > 1) {
      // Re-match against the same pattern but with a single-token capture so
      // cleanedText excludes only "hey claude," and not the following word.
      const singleTokenSrc = pattern.source.replace('([\\w-]+(?:\\s+[\\w-]+)?)', '([\\w-]+)');
      const singleTokenPattern = new RegExp(singleTokenSrc, pattern.flags);
      const m2 = text.match(singleTokenPattern);
      if (m2) prefixLen = m2[0].length;
    }

    return {
      addressees: [agent],
      isBroadcast: false,
      cleanedText: text.slice(prefixLen).trim(),
    };
  }

  // 3. No address detected.
  return { addressees: [], isBroadcast: false, cleanedText: text.trim() };
}

/**
 * Resolve the final list of agents that should receive a turn,
 * given the detection result and the current conversation mode.
 *
 * Modes:
 *   - 'addressed-only'           → detection.addressees (may be empty → silence)
 *   - 'addressed-with-fallback'  → detection.addressees if non-empty, else all active (round-robin)
 *   - 'single'                   → first active agent (or last-spoken if provided)
 *
 * Phase 2 Q3 default = addressed-with-fallback, with auto-degrade at N>=3 handled by caller.
 */
export type ConversationMode = 'addressed-only' | 'addressed-with-fallback' | 'single';

export function resolveTargets(
  detection: AddressDetection,
  activeAgents: Agent[],
  mode: ConversationMode,
  lastSpeakerId?: string,
): Agent[] {
  if (mode === 'single') {
    if (detection.addressees.length > 0) return detection.addressees;
    if (lastSpeakerId) {
      const last = activeAgents.find((a) => a.id === lastSpeakerId);
      if (last) return [last];
    }
    return activeAgents.slice(0, 1);
  }

  if (mode === 'addressed-only') {
    return detection.addressees;
  }

  // addressed-with-fallback
  if (detection.addressees.length > 0) return detection.addressees;
  return [...activeAgents];
}

/**
 * Round-robin order: rotate so the agent who did NOT speak last goes first.
 * Stable when there is no lastSpeaker.
 */
export function roundRobinOrder(targets: Agent[], lastSpeakerId?: string): Agent[] {
  if (!lastSpeakerId || targets.length <= 1) return targets;
  const lastIdx = targets.findIndex((a) => a.id === lastSpeakerId);
  if (lastIdx < 0) return targets;
  // Move the last speaker to the END so the other(s) speak first.
  return [...targets.slice(lastIdx + 1), ...targets.slice(0, lastIdx), targets[lastIdx]];
}

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
  // "hey claude," / "hey claude:"
  /^\s*(?:hey|hi|hello|ok)[,]?\s+([\w-]+)\s*[,:]?\s*/i,
  // "claude," (vocative comma — name immediately followed by comma)
  /^\s*([\w-]+)\s*,\s*/,
  // "claude:" (name + colon)
  /^\s*([\w-]+)\s*:\s*/,
];

const BROADCAST_PREFIX_PATTERN =
  /^\s*(?:hey\s+|ok\s+)?(team|both|everyone|everybody|all of you|you all|panel)\s*[,:]?\s*/i;

function normalize(s: string): string {
  return s.trim().toLowerCase();
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

  // Build a name → agent index for O(1) lookup. Match on both name and id (lowercased).
  const byName = new Map<string, Agent>();
  for (const agent of activeAgents) {
    byName.set(normalize(agent.name), agent);
    byName.set(normalize(agent.id), agent);
  }

  // 2. Try address-prefix patterns in order.
  for (const pattern of ADDRESS_PREFIX_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const candidate = normalize(match[1]);

    // Don't accept "hey there", "ok now", etc. — only when the captured token
    // matches a known agent name/id.
    const agent = byName.get(candidate);
    if (!agent) continue;

    return {
      addressees: [agent],
      isBroadcast: false,
      cleanedText: text.slice(match[0].length).trim(),
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

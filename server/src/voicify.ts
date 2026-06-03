/**
 * voicify — strip markdown / code / URLs / decorative glyphs from agent text
 * so the TTS engine does not literally read out "asterisk asterisk" or speak
 * full URLs aloud, and so SRE-style status output (✅, tables, label lines)
 * comes out as natural prose.
 *
 * Mirrors the cleanup pass in services/twilio-bridge/bridge.mjs, applied
 * server-side for the web UI path (tts-queue.ts + audio-router.ts).
 *
 * Operate on a sentence-sized string (the TTS path already buffers deltas
 * to sentence boundaries before calling synth, so cross-token markdown
 * markers like `**bold**` arrive intact here).
 */
export function voicify(s: string): string {
  let t = String(s ?? '');

  // Fenced code blocks ```...``` — keep short content, drop large ones.
  t = t.replace(/```[\s\S]*?```/g, (block) => {
    const inner = block.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, '').trim();
    return inner.length > 200 ? ' (code omitted) ' : ` ${inner} `;
  });
  // Inline code: drop backticks but keep content.
  t = t.replace(/`([^`]+)`/g, '$1');
  // Markdown links [label](url) → "label". Bare URLs → "(link)".
  t = t.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');
  t = t.replace(/\bhttps?:\/\/\S+/gi, '(link)');
  // Markdown table separator rows like |---|---| or |:--|--:|.
  t = t.replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/gm, '');
  // Markdown table cell pipes — convert to commas so rows read as lists.
  t = t.replace(/^\s*\|(.+)\|\s*$/gm, (_m, body: string) =>
    body.split('|').map((c) => c.trim()).filter(Boolean).join(', '),
  );
  // Headings, blockquotes, bold/italic markers.
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  t = t.replace(/^\s{0,3}>\s?/gm, '');
  t = t.replace(/\*\*(.+?)\*\*/g, '$1');
  t = t.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '$1');
  t = t.replace(/__(.+?)__/g, '$1');
  t = t.replace(/~~(.+?)~~/g, '$1');
  // Bullet markers at the start of a line (markdown + decorative glyphs).
  t = t.replace(/^\s*[-*+]\s+/gm, '');
  t = t.replace(/^\s*\d+\.\s+/gm, '');
  t = t.replace(/^\s*[•◦▪▫·●○]\s+/gm, '');
  // Status-icon emoji at line/clause start: turn into spoken words.
  t = t.replace(/(^|[\s,;.])✅\s*/g, '$1 ok, ');
  t = t.replace(/(^|[\s,;.])❌\s*/g, '$1 failed, ');
  t = t.replace(/(^|[\s,;.])⚠️?\s*/g, '$1 warning, ');
  t = t.replace(/(^|[\s,;.])ℹ️?\s*/g, '$1 ');
  // Drop any remaining decorative emoji ranges (keep ascii + accents).
  t = t.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{1F1E6}-\u{1F1FF}]/gu,
    '',
  );
  // Spoken-friendly substitutions for common ascii art / operators.
  t = t.replace(/\s*[→➜➡]\s*/g, ' to ');
  t = t.replace(/\s+vs\.?\s+/gi, ' versus ');
  t = t.replace(/\s+\/\s+/g, ' or ');
  // Collapse whitespace + newlines.
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim();
  // Tidy up double punctuation introduced by replacements.
  t = t.replace(/\s+([,.;:!?])/g, '$1').replace(/([,.;:!?])\1+/g, '$1');
  return t;
}

/**
 * voiceCap — cap a voicify'd string at a sentence boundary so a single TTS
 * utterance never runs on for paragraphs. Used as a guardrail on top of
 * upstream prompting (e.g. SRE_VOICE_INSTRUCTION).
 *
 * If `s` is shorter than `maxChars`, returns it unchanged. Otherwise returns
 * the longest prefix that ends on a sentence terminator (.!?) and is <=
 * `maxChars`. Falls back to a hard char cut at `maxChars` if no boundary is
 * found, appending an ellipsis. The full original text is preserved by the
 * caller for UI/log surfaces.
 */
export function voiceCap(s: string, maxChars = 400): string {
  const t = String(s ?? '');
  if (t.length <= maxChars) return t;
  // Prefer the last sentence terminator within the window.
  const window = t.slice(0, maxChars);
  const m = window.match(/^[\s\S]*[.!?](?=\s|$)/);
  if (m && m[0].length >= maxChars * 0.4) return m[0].trim();
  // Fall back to a word-boundary cut + ellipsis.
  const cut = t.slice(0, maxChars).replace(/\s+\S*$/, '').trim();
  return cut + '…';
}

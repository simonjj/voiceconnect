/**
 * voicify — strip markdown / code / URLs from agent text so the TTS engine
 * does not literally read out "asterisk asterisk" or speak full URLs aloud.
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
  // Headings, blockquotes, bold/italic markers.
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  t = t.replace(/^\s{0,3}>\s?/gm, '');
  t = t.replace(/\*\*(.+?)\*\*/g, '$1');
  t = t.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '$1');
  t = t.replace(/__(.+?)__/g, '$1');
  t = t.replace(/~~(.+?)~~/g, '$1');
  // Bullet markers at the start of a line.
  t = t.replace(/^\s*[-*+]\s+/gm, '');
  t = t.replace(/^\s*\d+\.\s+/gm, '');
  // Collapse whitespace + newlines.
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim();
  return t;
}

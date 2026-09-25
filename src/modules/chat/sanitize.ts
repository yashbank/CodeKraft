/**
 * Output sanitiser — docs/09 §11 "Output handling": model text is streamed as text and rendered by
 * a markdown renderer that allows inline formatting only. Here HTML tags, control characters and
 * raw `javascript:`/`data:` links are removed before the text leaves the server so nothing the
 * model produces can execute in a client that forgets the rule.
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG = /<\/?[a-zA-Z][^<>]*>/g;
const UNSAFE_LINK = /\[([^\]]*)\]\(\s*(?:javascript|data|vbscript):[^)]*\)/gi;

/** Sanitise one streamed delta; safe to call per chunk (tags split across chunks are caught on persist). */
export function sanitizeModelText(text: string): string {
  return text.replace(CONTROL_CHARS, "").replace(HTML_TAG, "").replace(UNSAFE_LINK, "$1");
}

/** Sanitise the assembled answer before it is persisted (catches tags split across deltas). */
export function sanitizeAnswer(text: string): string {
  return sanitizeModelText(text).replace(/\n{3,}/g, "\n\n").trim();
}

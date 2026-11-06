/**
 * SVG safety check for public site content (landing pages, blog, case studies).
 *
 * An SVG is XML that can carry scripts. We never rewrite a file (a hand-rolled sanitiser is easy
 * to bypass); we REJECT any SVG that contains something active, and accept plain drawings.
 * Rejected: scripts, event handlers (onload=...), foreignObject, iframes/objects/embeds,
 * javascript: links, entities and DOCTYPE subsets (XXE / billion laughs), @import, and any
 * href/src/url() that points outside the file (only #fragments and data:image/png|jpeg|gif|webp
 * are allowed).
 */
export interface SvgCheck {
  ok: boolean;
  reason?: string;
}

const BAD_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/<\s*script/i, "contains a script"],
  [/<\s*foreignObject/i, "contains foreignObject"],
  [
    /<\s*(iframe|object|embed|audio|video|canvas|link|meta|base)\b/i,
    "contains an embedded element",
  ],
  [/\bon[a-z]+\s*=/i, "contains an event handler"],
  [/javascript\s*:/i, "contains a javascript: link"],
  [/vbscript\s*:/i, "contains a vbscript: link"],
  [/data\s*:\s*text\/html/i, "contains embedded HTML"],
  [/<!\s*ENTITY/i, "declares an entity"],
  [/<!\s*DOCTYPE[^>]*\[/i, "has a DOCTYPE subset"],
  [/@import/i, "imports an outside stylesheet"],
  [
    /<\s*(animate|set|animateTransform)\b[^>]*attributeName\s*=\s*["']?\s*(xlink:)?href/i,
    "animates a link",
  ],
];

/** Every href / xlink:href / src / url(...) must stay inside the file. */
const REF_PATTERNS: readonly RegExp[] = [
  /\b(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi,
  /\bsrc\s*=\s*(["'])(.*?)\1/gi,
  /url\(\s*(["']?)(.*?)\1\s*\)/gi,
];
const SAFE_REF = /^\s*(#|data:image\/(png|jpe?g|gif|webp);base64,)/i;

export function checkSvgSafe(svg: string): SvgCheck {
  const text = svg.replace(/^\uFEFF/, "");
  if (!/<\s*svg[\s>]/i.test(text)) return { ok: false, reason: "is not an SVG document" };
  for (const [re, why] of BAD_PATTERNS) if (re.test(text)) return { ok: false, reason: why };
  for (const re of REF_PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      if (!SAFE_REF.test(m[2] ?? ""))
        return { ok: false, reason: "links to something outside the file" };
    }
  }
  return { ok: true };
}

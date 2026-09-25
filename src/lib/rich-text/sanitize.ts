/**
 * Second-pass HTML sanitizer (ADR-10, TM-21, SA-19). Runs on everything `@tiptap/html` emits and
 * on any HTML that reaches the site from elsewhere. The allow-list is the HTML projection of
 * `RICH_TEXT_NODE_TYPES` / `RICH_TEXT_MARK_TYPES`: no `script`, `style`, `on*`, `javascript:` or
 * `data:` URLs; `iframe` only from the two embed hosts docs/06 API-CAT-06 allows.
 */
import sanitizeHtml, { type IOptions } from "sanitize-html";

/** Hosts an `<iframe>` may point at (docs/06 API-CAT-06 embed allow-list, privacy-enhanced YouTube). */
export const ALLOWED_IFRAME_HOSTS = ["www.youtube-nocookie.com", "player.vimeo.com"] as const;

const HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

export const RICH_TEXT_ALLOWED_TAGS: readonly string[] = [
  "p",
  ...HEADINGS,
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "br",
  "hr",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "a",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "iframe",
];

/** True for absolute http(s) URLs pointing away from this site (used for `rel`/`target`). */
export function isExternalHref(href: string, siteHost?: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const host = new URL(href).host.toLowerCase();
    return siteHost === undefined || host !== siteHost.toLowerCase();
  } catch {
    return true;
  }
}

export interface SanitizeOptions {
  /** Host of this site; links to it stay in-tab. */
  siteHost?: string;
}

export function richTextSanitizeOptions(opts: SanitizeOptions = {}): IOptions {
  return {
    allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      ol: ["start"],
      code: ["class"],
      iframe: ["src", "title", "allow", "allowfullscreen", "width", "height", "loading"],
      ...Object.fromEntries(HEADINGS.map((h) => [h, ["id"]])),
    },
    allowedClasses: { code: [/^language-[\w-]+$/] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"], iframe: ["https"] },
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    allowedIframeHostnames: [...ALLOWED_IFRAME_HOSTS],
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "template"],
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs["href"];
        const next: Record<string, string> = { ...attribs };
        delete next["target"];
        delete next["rel"];
        if (href !== undefined && isExternalHref(href, opts.siteHost)) {
          next["target"] = "_blank";
          next["rel"] = "noopener noreferrer";
        }
        return { tagName, attribs: next };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, alt: attribs["alt"] ?? "", loading: "lazy" },
      }),
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: "lazy",
          allow: "accelerometer; encrypted-media; picture-in-picture",
          allowfullscreen: "",
        },
      }),
    },
  };
}

/** Sanitise an HTML fragment with the rich-text allow-list. */
export function sanitizeRichHtml(html: string, opts: SanitizeOptions = {}): string {
  return sanitizeHtml(html, richTextSanitizeOptions(opts));
}

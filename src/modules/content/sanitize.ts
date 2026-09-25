/**
 * Content HTML sanitizer (PHASE-03 P3.10, ADR-10, TM-21, SA-19).
 * Strips script/style, disallows on* attributes & javascript: URLs,
 * and restricts iframes exclusively to youtube-nocookie and vimeo embeds.
 */
import sanitize from "sanitize-html";

const ALLOWED_IFRAME_HOSTS = [
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "player.vimeo.com",
];

export const SANITIZE_OPTIONS: sanitize.IOptions = {
  allowedTags: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "blockquote",
    "pre",
    "code",
    "ul",
    "ol",
    "li",
    "b",
    "i",
    "strong",
    "em",
    "strike",
    "s",
    "u",
    "a",
    "img",
    "hr",
    "br",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "iframe",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "width", "height", "frameborder", "allow", "allowfullscreen"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    h1: ["id"],
    h2: ["id"],
    h3: ["id"],
    h4: ["id"],
    h5: ["id"],
    h6: ["id"],
  },
  allowedIframeHostnames: ALLOWED_IFRAME_HOSTS,
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    iframe: ["https"],
  },
  transformTags: {
    a: (tagName, attribs) => {
      const isExternal =
        attribs.href && (attribs.href.startsWith("http://") || attribs.href.startsWith("https://"));
      return {
        tagName,
        attribs: {
          ...attribs,
          ...(isExternal
            ? {
                target: "_blank",
                rel: "noopener noreferrer",
              }
            : {}),
        },
      };
    },
  },
};

export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return "";
  return sanitize(dirtyHtml, SANITIZE_OPTIONS);
}

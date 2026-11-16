/**
 * Pure helpers for product media exposure (no DB / storage imports, unit-tested).
 *
 * Private PDFs (kind `presentation`) are served to ANY visitor, but only through
 * /api/files/product-media/[mediaId] and only while the owning product is published.
 */
export const PUBLIC_PRODUCT_MEDIA_PATH = "/api/files/product-media";

/** Visitors may open only presentation (PDF) media of published products. */
export function canVisitorViewProductMedia(
  rows: ReadonlyArray<{ kind: string; productStatus: string }>,
): boolean {
  return rows.some((r) => r.kind === "presentation" && r.productStatus === "published");
}

/** URL a client should use for a product_media row. */
export function buildProductMediaUrl(
  pm: { kind: string; embedUrl: string | null },
  m: { id: string; objectKey: string; visibility: string } | null,
  publicBase: string,
): string {
  if (pm.embedUrl) return pm.embedUrl;
  if (!m) return "";
  if (m.visibility === "public") return `${publicBase.replace(/\/+$/, "")}/${m.objectKey}`;
  if (pm.kind === "presentation") return `${PUBLIC_PRODUCT_MEDIA_PATH}/${m.id}`;
  return `/api/files/private/${m.id}`;
}

export type GalleryClass = "image" | "video" | "pdf" | "hidden";

/** How the detail page treats a media row. Non-PDF private attachments are hidden. */
export function classifyGalleryMedia(m: {
  kind: string;
  mime?: string | null;
  url?: string | null;
}): GalleryClass {
  if (m.kind === "video_embed") return toEmbedSrc(m.url) ? "video" : "hidden";
  if (m.kind === "video_file") {
    return m.url ? "video" : "hidden";
  }
  if (m.kind === "presentation") return m.url ? "pdf" : "hidden";
  if (
    (m.kind === "image" || m.kind === "screenshot" || m.kind === "gallery") &&
    (m.mime ?? "").startsWith("image/") &&
    m.url
  ) {
    return "image";
  }
  return "hidden";
}

/**
 * Safe iframe `src` for a video_embed URL, or null when the host is not allow-listed.
 * Accepts youtube watch / youtu.be / embed URLs and vimeo.com / player.vimeo.com URLs.
 */
export function toEmbedSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  const id = /^[\w-]{6,20}$/;
  if (host === "youtu.be") {
    const v = u.pathname.slice(1);
    return id.test(v) ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === "youtube.com" || host === "www.youtube.com") {
    const m = /^\/embed\/([\w-]{6,20})$/.exec(u.pathname);
    const v = m ? m[1] : u.pathname === "/watch" ? u.searchParams.get("v") : null;
    return v && id.test(v) ? `https://www.youtube-nocookie.com/embed/${v}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /^(?:\/video)?\/(\d{5,12})$/.exec(u.pathname);
    return m ? `https://player.vimeo.com/video/${m[1]}` : null;
  }
  return null;
}

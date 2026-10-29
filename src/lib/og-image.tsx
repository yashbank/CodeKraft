/** P12-03 — shared share-card renderer for the opengraph-image routes (next/og, nodejs runtime). */
import { ImageResponse } from "next/og";

import { PALETTES } from "./palettes";
import { absoluteUrl } from "./seo";
import { getSiteLogo, getSiteName, getThemeConfig } from "./site-brand";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** Logo as a data URL (satori reads png/jpeg reliably); null on timeout/error/other formats. */
async function fetchLogo(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(absoluteUrl(url), { signal: AbortSignal.timeout(2500) });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !/^image\/(png|jpe?g)$/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function renderOg(title: string, eyebrow?: string): Promise<ImageResponse> {
  const [siteName, logoUrl, theme] = await Promise.all([
    getSiteName(),
    getSiteLogo(),
    getThemeConfig(),
  ]);
  const logo = await fetchLogo(logoUrl);
  const accent = PALETTES.find((p) => p.id === theme.palette)?.dark ?? "#9d8fff";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0a0b10",
        color: "#ffffff",
        borderLeft: `16px solid ${accent}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", height: 64 }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered by satori, not the DOM
          <img src={logo} alt="" height={64} style={{ height: 64 }} />
        ) : (
          <div style={{ fontSize: 40, fontWeight: 700, color: accent }}>{siteName}</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {eyebrow ? (
          <div style={{ fontSize: 28, color: accent, marginBottom: 16 }}>{eyebrow}</div>
        ) : null}
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>{title.slice(0, 120)}</div>
      </div>
      <div style={{ fontSize: 26, color: "#a3a8b8" }}>{siteName}</div>
    </div>,
    OG_SIZE,
  );
}

/** Generation failed: fall back to the plain site logo (P11-03) or a 404. */
async function ogFallback(): Promise<Response> {
  const logo = await getSiteLogo().catch(() => null);
  return logo ? Response.redirect(absoluteUrl(logo), 302) : new Response(null, { status: 404 });
}

/** Never throws: render the card or fall back. `title` null means the entity was not found. */
export async function safeOg(title: string | null, eyebrow?: string): Promise<Response> {
  try {
    return await renderOg(title ?? (await getSiteName()), eyebrow);
  } catch {
    return ogFallback();
  }
}

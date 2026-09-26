/**
 * Deterministic placeholder tone for `MediaPlaceholder` (src/components/site/MediaPlaceholder.tsx)
 * when a card has no real cover art to show — this design renders an abstract color tile instead
 * of a photo everywhere (products, case studies, blog). `tone` can be any int; the component does
 * `Math.abs(tone) % 6` internally, so this just needs to be stable per slug.
 */
export function toneFromSlug(slug: string): number {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  return h;
}

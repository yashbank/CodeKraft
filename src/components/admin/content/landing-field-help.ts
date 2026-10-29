export type LandingChapterKey = "who" | "build" | "sell" | "proof" | "talk";
export type LandingFieldKey =
  | "poster"
  | "eyebrow"
  | "title"
  | "subtitle"
  | "body"
  | "cta1"
  | "cta1-target"
  | "cta2"
  | "cta2-target"
  | "node-label"
  | "style";

export const LANDING_FIELDS: LandingFieldKey[] = [
  "poster",
  "eyebrow",
  "title",
  "subtitle",
  "body",
  "cta1",
  "cta1-target",
  "cta2",
  "cta2-target",
  "node-label",
  "style",
];

/** Section names as visitors see them on the landing page (Build / Sell / Proof / Talk to us). */
const SECTION: Record<LandingChapterKey, string> = {
  who: "hero (top of the page)",
  build: "'Build' section",
  sell: "'Sell' section",
  proof: "'Proof' section",
  talk: "'Talk to us' section",
};

/** Helper line saying where a chapter field shows on the landing page. Mirrors LandingPage/LandingHero. */
export function landingFieldHelp(chapter: LandingChapterKey, field: LandingFieldKey): string {
  const s = SECTION[chapter];
  const hero = chapter === "who";
  const where = hero ? "in the hero" : `under the headline of the ${s}`;
  switch (field) {
    case "poster":
      return hero
        ? "Shown in the image panel beside the headline in the hero."
        : "Not shown in this section.";
    case "eyebrow":
      return `Shown as the small label above the headline of the ${s}.`;
    case "title":
      return `Shown as the headline of the ${s}.`;
    case "subtitle":
      return hero
        ? "Shown as the lead paragraph under the headline in the hero."
        : `Not shown in the ${s}.`;
    case "body":
      return hero
        ? "Not shown in the hero."
        : `Shown as the paragraph under the headline of the ${s}.`;
    case "cta1":
      return `Shown as the label of the main button ${where}.`;
    case "cta1-target":
      return `Where the main button ${where} goes.`;
    case "cta2":
      return `Shown as the label of the second button ${where}. Leave empty to hide it.`;
    case "node-label":
      return hero
        ? "Shown as the small label on the card over the bottom of the hero image. Leave empty to hide it."
        : "Not shown in this section.";
    case "style":
      return `Changes the look of the ${s} only (font, border, spacing, tone). Left on Default, it looks exactly as before.`;
    case "cta2-target":
      return `Where the second button ${where} goes.`;
  }
}

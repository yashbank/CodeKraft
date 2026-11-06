/**
 * The ONE list of file formats the app accepts for uploads (images, video, audio, documents,
 * archives, text, fonts). Pure and client-safe: the upload rules (modules/media/types.ts), the
 * file picker `accept` strings, the extension fallback in the browser uploader and the tests all
 * read from here, so a format is added in exactly one place.
 *
 * Safety rules that stay in force (docs/09 TM-12):
 *  - no executable or script types (html, js, exe, ...): see FORBIDDEN_UPLOAD_EXTENSIONS;
 *  - every group has a size cap (UPLOAD_GROUP_MAX_BYTES);
 *  - SVG is accepted only for public site content and only after a safety check that rejects
 *    scripts, event handlers, external references and entities (modules/media/svg-safety.ts).
 */
export type UploadGroup =
  "image" | "video" | "audio" | "pdf" | "office" | "archive" | "text" | "font";

export interface UploadFormat {
  /** Canonical MIME stored in R2 and in `media.mime`. */
  mime: string;
  /** File extensions (lower case, no dot) that map to this MIME. */
  exts: readonly string[];
  group: UploadGroup;
  /** Other MIME strings browsers send for the same file. They are mapped to `mime` at intake. */
  aliases?: readonly string[];
}

const OOXML = "application/vnd.openxmlformats-officedocument";

export const UPLOAD_FORMATS: readonly UploadFormat[] = [
  // Images
  { mime: "image/jpeg", exts: ["jpg", "jpeg"], group: "image" },
  { mime: "image/png", exts: ["png"], group: "image" },
  { mime: "image/webp", exts: ["webp"], group: "image" },
  { mime: "image/gif", exts: ["gif"], group: "image" },
  { mime: "image/avif", exts: ["avif"], group: "image" },
  { mime: "image/svg+xml", exts: ["svg"], group: "image" },
  // Video
  { mime: "video/mp4", exts: ["mp4", "m4v"], group: "video" },
  { mime: "video/webm", exts: ["webm"], group: "video" },
  { mime: "video/quicktime", exts: ["mov"], group: "video" },
  // Audio
  { mime: "audio/mpeg", exts: ["mp3"], group: "audio", aliases: ["audio/mp3"] },
  { mime: "audio/wav", exts: ["wav"], group: "audio", aliases: ["audio/x-wav", "audio/wave"] },
  { mime: "audio/ogg", exts: ["ogg", "oga"], group: "audio" },
  { mime: "audio/mp4", exts: ["m4a"], group: "audio", aliases: ["audio/x-m4a"] },
  { mime: "audio/flac", exts: ["flac"], group: "audio", aliases: ["audio/x-flac"] },
  // Documents
  { mime: "application/pdf", exts: ["pdf"], group: "pdf" },
  {
    mime: `${OOXML}.wordprocessingml.document`,
    exts: ["docx"],
    group: "office",
  },
  { mime: `${OOXML}.spreadsheetml.sheet`, exts: ["xlsx"], group: "office" },
  { mime: `${OOXML}.presentationml.presentation`, exts: ["pptx"], group: "office" },
  { mime: "application/msword", exts: ["doc"], group: "office" },
  { mime: "application/vnd.ms-excel", exts: ["xls"], group: "office" },
  { mime: "application/vnd.ms-powerpoint", exts: ["ppt"], group: "office" },
  // Archives
  {
    mime: "application/zip",
    exts: ["zip"],
    group: "archive",
    aliases: ["application/x-zip-compressed"],
  },
  { mime: "application/gzip", exts: ["gz", "tgz"], group: "archive" },
  { mime: "application/x-tar", exts: ["tar"], group: "archive" },
  { mime: "application/x-7z-compressed", exts: ["7z"], group: "archive" },
  // Plain text
  { mime: "text/plain", exts: ["txt", "log"], group: "text" },
  { mime: "text/csv", exts: ["csv"], group: "text" },
  { mime: "application/json", exts: ["json"], group: "text" },
  { mime: "text/markdown", exts: ["md"], group: "text" },
  // Fonts
  { mime: "font/woff", exts: ["woff"], group: "font", aliases: ["application/font-woff"] },
  { mime: "font/woff2", exts: ["woff2"], group: "font", aliases: ["application/font-woff2"] },
  {
    mime: "font/ttf",
    exts: ["ttf"],
    group: "font",
    aliases: ["application/x-font-ttf", "font/sfnt"],
  },
  { mime: "font/otf", exts: ["otf"], group: "font", aliases: ["application/x-font-otf"] },
];

const MB = 1024 * 1024;
/** Size cap per group. SVG has its own, smaller cap (SVG_MAX_BYTES). */
export const UPLOAD_GROUP_MAX_BYTES: Readonly<Record<UploadGroup, number>> = Object.freeze({
  image: 10 * MB,
  video: 200 * MB,
  audio: 50 * MB,
  pdf: 25 * MB,
  office: 25 * MB,
  archive: 100 * MB,
  text: 5 * MB,
  font: 10 * MB,
});
export const SVG_MIME = "image/svg+xml";
export const SVG_MAX_BYTES = 1 * MB;

/** Types that must never be uploaded as site content (only `release_file` installers are exempt). */
export const FORBIDDEN_UPLOAD_EXTENSIONS: ReadonlySet<string> = new Set([
  "html",
  "htm",
  "xhtml",
  "exe",
  "dll",
  "so",
  "dylib",
  "js",
  "mjs",
  "cjs",
  "ts",
  "sh",
  "bash",
  "bat",
  "cmd",
  "vbs",
  "php",
  "phtml",
  "py",
  "rb",
  "jar",
]);

const normalise = (mime: string) => (mime.toLowerCase().split(";")[0] ?? "").trim();

export function mimesOf(...groups: UploadGroup[]): string[] {
  return UPLOAD_FORMATS.filter((f) => groups.includes(f.group)).map((f) => f.mime);
}

/** Canonical MIME for any browser-reported MIME (maps aliases); null when the app has no such format. */
export function canonicalMime(mime: string): string | null {
  const m = normalise(mime);
  const hit = UPLOAD_FORMATS.find((f) => f.mime === m || f.aliases?.includes(m));
  return hit?.mime ?? null;
}

export function formatForMime(mime: string): UploadFormat | null {
  const m = normalise(mime);
  return UPLOAD_FORMATS.find((f) => f.mime === m || f.aliases?.includes(m)) ?? null;
}

/** Canonical MIME for a filename's extension (browsers send "" or odd types for mov, md, csv, fonts). */
export function mimeForFilename(name: string): string | null {
  const ext = name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
  return UPLOAD_FORMATS.find((f) => f.exts.includes(ext))?.mime ?? null;
}

/** Size cap for one MIME (group cap, or the SVG cap). Unknown MIMEs get 0. */
export function maxBytesForMime(mime: string): number {
  const m = normalise(mime);
  if (m === SVG_MIME) return SVG_MAX_BYTES;
  const f = formatForMime(m);
  return f ? UPLOAD_GROUP_MAX_BYTES[f.group] : 0;
}

/** `accept` string for a file picker covering the given groups (extensions plus MIMEs). */
export function acceptFor(...groups: UploadGroup[]): string {
  const fmts = UPLOAD_FORMATS.filter((f) => groups.includes(f.group));
  return [...fmts.flatMap((f) => f.exts.map((e) => `.${e}`)), ...fmts.map((f) => f.mime)].join(",");
}

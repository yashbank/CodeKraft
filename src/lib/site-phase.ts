/**
 * Site phase (live | testing | maintenance): pure, edge-safe helpers (no imports). The phase is a
 * `site_settings` row (`site_phase`, super admin only); a missing/unknown value means `live`.
 */
export const SITE_PHASES = ["live", "testing", "maintenance"] as const;
export type SitePhase = (typeof SITE_PHASES)[number];

export function parseSitePhase(value: unknown): SitePhase {
  return value === "testing" || value === "maintenance" ? value : "live";
}

/** Top-bar badge: only super admins, only when the site is not live. */
export function phaseBadge(
  role: string | undefined,
  phase: SitePhase,
): { label: "Testing" | "Maintenance"; tone: "warning" | "danger" } | null {
  if (role !== "super_admin" || phase === "live") return null;
  return phase === "testing"
    ? { label: "Testing", tone: "warning" }
    : { label: "Maintenance", tone: "danger" };
}

/** Outbound customer/external email is never sent while the site is in `testing`; staff still get theirs. */
export function shouldSuppressEmail(phase: SitePhase, recipientIsStaff: boolean): boolean {
  return phase === "testing" && !recipientIsStaff;
}

/** Marker stored in `email_outbox.last_error` for mail skipped by the phase. */
export const SKIPPED_BY_PHASE = "skipped-by-phase";

/** Retry-After (seconds) sent with the maintenance 503. */
export const MAINTENANCE_RETRY_AFTER = 300;

export function maintenanceHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Back soon</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:#0b0d12;color:#e8eaf0;text-align:center;padding:24px}main{max-width:420px}h1{font-size:1.6rem;margin:0 0 .6rem}p{margin:0;color:#a8adbb;line-height:1.5}</style></head><body><main data-testid="maintenance-page"><h1>We&rsquo;ll be right back</h1><p>This site is undergoing scheduled maintenance. Please check back in a few minutes.</p></main></body></html>`;
}

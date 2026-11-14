/**
 * Edge-safe phase gate for the middleware (no src/lib imports other than the pure phase helpers).
 *
 * Why a probe fetch instead of reading the DB: middleware runs on the edge and cannot use the
 * Postgres driver. Why in middleware at all: cookie-less visitors are rewritten to /ssg ISR twins
 * (cached up to 300 s), so a layout-level check could serve a stale "live" page. The middleware
 * runs before that cache on every request, so the decision is made here. The probe result is held
 * in module memory for PHASE_TTL_MS (a few seconds), then re-fetched from `/api/site-phase`, which
 * reads the `settings`-tagged cache that a settings save invalidates. Any failure means `live`.
 */
import type { NextRequest } from "next/server";

import {
  MAINTENANCE_RETRY_AFTER,
  maintenanceHtml,
  parseSitePhase,
  type SitePhase,
} from "@/lib/site-phase";

export const PHASE_TTL_MS = 3_000;
const PROBE_TIMEOUT_MS = 1_500;

let cached: { phase: SitePhase; at: number } | null = null;
let inflight: Promise<SitePhase> | null = null;

async function probe(
  origin: string,
  cookie?: string,
): Promise<{ phase: SitePhase; staff: boolean }> {
  try {
    const res = await fetch(`${origin}/api/site-phase`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return { phase: "live", staff: false };
    const body = (await res.json()) as { phase?: unknown; staff?: unknown };
    return { phase: parseSitePhase(body.phase), staff: body.staff === true };
  } catch {
    return { phase: "live", staff: false };
  }
}

async function currentPhase(origin: string): Promise<SitePhase> {
  const now = Date.now();
  if (cached && now - cached.at < PHASE_TTL_MS) return cached.phase;
  inflight ??= probe(origin)
    .then((r) => {
      cached = { phase: r.phase, at: Date.now() };
      return r.phase;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function resetSitePhaseCache(): void {
  cached = null;
  inflight = null;
}

const MAINTENANCE_OPEN = /^\/(api|auth)(\/|$)/;

export interface PhaseGate {
  phase: SitePhase;
  /** Set for maintenance when the visitor is not an admin-area user. */
  response: Response | null;
}

/** Site-host only. /api (webhooks, cron, the probe itself) is never gated. */
export async function sitePhaseGate(req: NextRequest): Promise<PhaseGate> {
  const { pathname, origin } = req.nextUrl;
  if (pathname === "/api" || pathname.startsWith("/api/")) return { phase: "live", response: null };
  const phase = await currentPhase(origin);
  if (phase !== "maintenance" || MAINTENANCE_OPEN.test(pathname)) return { phase, response: null };
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("session_token")) {
    // A signed-in visitor: admins/staff keep the live storefront, everyone else sees maintenance.
    const { staff } = await probe(origin, cookie);
    if (staff) return { phase, response: null };
  }
  return {
    phase,
    response: new Response(maintenanceHtml(), {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": String(MAINTENANCE_RETRY_AFTER),
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }),
  };
}

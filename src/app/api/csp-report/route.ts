import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit-port";
import { MINUTE_MS, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Browsers resend the same violation on every page view; keep one audit row per key per window.
// shortcut: per-instance memory, so serverless gives up to one row per warm instance per window.
const SEEN = new Map<string, number>();
const WINDOW_MS = 10 * 60_000;
const MAX_BODY = 8_192;
const MAX_ENTRIES = 10;
const CLIP = 200;

const str = (v: unknown) => (typeof v === "string" ? v.slice(0, CLIP) : "");

/** Entries of a legacy `{csp-report}` object or a report-to array (`[{type, body}]`). */
function entriesOf(report: unknown): Record<string, unknown>[] {
  const list = Array.isArray(report) ? report : [report];
  return list.slice(0, MAX_ENTRIES).map((e) => {
    const o = (e ?? {}) as Record<string, unknown>;
    return (o["csp-report"] ?? o.body ?? o) as Record<string, unknown>;
  });
}

/** Entries not seen within the window (each remembered); keys are byte-bounded by CLIP. */
function newEntries(report: unknown, now = Date.now()): Record<string, unknown>[] {
  return entriesOf(report).filter((r) => {
    const key = [
      str(r.effectiveDirective ?? r["effective-directive"] ?? r["violated-directive"]),
      str(r.blockedURL ?? r["blocked-uri"]),
      str(r.documentURL ?? r["document-uri"]),
    ].join("|");
    const last = SEEN.get(key);
    if (last !== undefined && now - last < WINDOW_MS) return false;
    if (SEEN.size >= 500) SEEN.clear();
    SEEN.set(key, now);
    return true;
  });
}

/** Reads at most MAX_BODY bytes of the actual stream; null when larger (chunked/no length). */
async function readCapped(req: NextRequest): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const ignored = () => new NextResponse(null, { status: 204 });

/**
 * CSP violation report ingest (docs/09 §9, P9.1).
 * Logs CSP violation reports to the audit port and server logs for monitoring.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
    if (!(await rateLimit(`csp-report:${ip}`, 30, MINUTE_MS)).allowed) return ignored();
    const text = await readCapped(req);
    if (text === null) return ignored();
    let report: unknown;
    try {
      report = JSON.parse(text);
    } catch {
      report = { raw: text };
    }
    const fresh = newEntries(report);
    if (fresh.length === 0) return ignored();

    await audit({
      action: "system.csp_violation",
      actorId: null,
      meta: {
        report: fresh,
        ip: req.headers.get("x-forwarded-for") ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }
}

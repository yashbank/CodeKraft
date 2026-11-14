import { createHmac, timingSafeEqual } from "node:crypto";

export const SVIX_TOLERANCE_SECONDS = 5 * 60;

export type SvixVerdict = "ok" | "missing_headers" | "bad_timestamp" | "stale" | "bad_signature";

/**
 * Verify a Svix-signed webhook (Resend): HMAC-SHA256 over `${id}.${timestamp}.${rawBody}` keyed by
 * the base64 secret after the `whsec_` prefix; header carries space-separated `v1,<base64>` entries.
 */
export function verifySvixSignature(args: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowMs?: number;
}): SvixVerdict {
  const { secret, id, timestamp, signature, rawBody } = args;
  if (!id || !timestamp || !signature) return "missing_headers";
  const ts = Number(timestamp);
  if (!Number.isInteger(ts)) return "bad_timestamp";
  const nowSec = Math.floor((args.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSec - ts) > SVIX_TOLERANCE_SECONDS) return "stale";

  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();

  for (const part of signature.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    const given = Buffer.from(value, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return "ok";
  }
  return "bad_signature";
}

/** Test/dev helper: produce a valid header set for `rawBody`. */
export function signSvix(secret: string, id: string, timestampSec: number, rawBody: string) {
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const sig = createHmac("sha256", key).update(`${id}.${timestampSec}.${rawBody}`).digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": String(timestampSec),
    "svix-signature": `v1,${sig}`,
  };
}

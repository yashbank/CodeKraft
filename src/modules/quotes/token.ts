/**
 * Cryptographic token generator for custom quote pay links (D-520, TM-11).
 * Generates base64url string with >= 128 bits of entropy, matching zQuoteToken.
 */
import crypto from "node:crypto";
import { zQuoteToken } from "./types";

export function generateQuoteToken(): string {
  // 24 random bytes = 192 bits of entropy (> 128 bits minimum requirement)
  const token = crypto.randomBytes(24).toString("base64url");
  return zQuoteToken.parse(token);
}

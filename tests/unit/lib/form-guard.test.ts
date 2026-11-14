import { describe, expect, it } from "vitest";
import { MIN_FILL_MS, checkFormGuard, issueFormToken } from "@/lib/form-guard";

describe("form-guard (honeypot + time trap)", () => {
  const t0 = 1_700_000_000_000;

  it("passes a human: empty honeypot, token older than the minimum fill time", () => {
    const token = issueFormToken(t0);
    expect(checkFormGuard({ honeypot: "", token }, t0 + MIN_FILL_MS + 1)).toBe("ok");
    expect(checkFormGuard({ token }, t0 + 60_000)).toBe("ok");
  });

  it("passes a tab left open for days (old token is not bot evidence)", () => {
    expect(checkFormGuard({ token: issueFormToken(t0) }, t0 + 3 * 86_400_000)).toBe("ok");
  });

  it("flags any non-empty honeypot, even with a valid token", () => {
    const token = issueFormToken(t0);
    expect(checkFormGuard({ honeypot: "http://spam.example", token }, t0 + 60_000)).toBe(
      "honeypot",
    );
    expect(checkFormGuard({ honeypot: "x", token: undefined }, t0)).toBe("honeypot");
  });

  it("flags a submit faster than the minimum fill time", () => {
    const token = issueFormToken(t0);
    expect(checkFormGuard({ token }, t0 + 500)).toBe("too_fast");
    expect(checkFormGuard({ token }, t0 + MIN_FILL_MS - 1)).toBe("too_fast");
  });

  it("flags missing, malformed, forged or future tokens", () => {
    const now = t0 + 60_000;
    expect(checkFormGuard({}, now)).toBe("bad_token");
    expect(checkFormGuard({ token: "garbage" }, now)).toBe("bad_token");
    expect(checkFormGuard({ token: `${t0}.deadbeef` }, now)).toBe("bad_token");
    // forged timestamp keeps the old signature
    const real = issueFormToken(t0);
    const forged = `${t0 - 100_000}.${real.split(".")[1]}`;
    expect(checkFormGuard({ token: forged }, now)).toBe("bad_token");
    // signed in the future
    expect(checkFormGuard({ token: issueFormToken(now + 60_000) }, now)).toBe("bad_token");
  });
});

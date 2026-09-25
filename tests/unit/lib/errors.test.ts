import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AppError,
  ERROR_DEFAULT_MESSAGE,
  ERROR_HTTP_STATUS,
  ErrorCode,
  fail,
  isAppError,
  ok,
  toActionResult,
} from "@/lib/errors";

/** docs/06 §1.4 — the table as published (order preserved). */
const DOC_TABLE: ReadonlyArray<[string, number]> = [
  ["UNAUTHENTICATED", 401],
  ["SESSION_REPLACED", 401],
  ["EMAIL_UNVERIFIED", 403],
  ["ACCOUNT_SUSPENDED", 403],
  ["FORBIDDEN", 403],
  ["VALIDATION", 400],
  ["CAPTCHA_FAILED", 400],
  ["NOT_FOUND", 404],
  ["STATE_INVALID", 409],
  ["CONFLICT", 409],
  ["DUPLICATE_PURCHASE", 409],
  ["ORDER_EXPIRED", 410],
  ["LIMIT_EXCEEDED", 429],
  ["RATE_LIMITED", 429],
  ["IDEMPOTENT_REPLAY", 200],
  ["UPSTREAM_UNAVAILABLE", 503],
  ["INTERNAL", 500],
];

/** Parse the same table straight out of the spec so drift in either direction fails. */
function tableFromDocs(): Array<[string, number]> {
  const doc = readFileSync("docs/06-API-SPECIFICATION.md", "utf8");
  const section = doc.slice(doc.indexOf("### 1.4 Result envelope"));
  const rows: Array<[string, number]> = [];
  for (const line of section.split("\n")) {
    const m = /^\| `([A-Z_]+)` \| (\d{3}) \|/.exec(line);
    if (m) rows.push([m[1] as string, Number(m[2])]);
    if (rows.length > 0 && !line.startsWith("|")) break;
  }
  return rows;
}

describe("ErrorCode ↔ HTTP status (docs/06 §1.4)", () => {
  it("matches the fixture table exactly", () => {
    expect(Object.entries(ERROR_HTTP_STATUS)).toEqual(DOC_TABLE);
    expect(Object.values(ErrorCode)).toEqual(DOC_TABLE.map(([code]) => code));
  });

  it("matches the table in the spec document", () => {
    expect(tableFromDocs()).toEqual(DOC_TABLE);
  });

  it("has a default message for every code", () => {
    for (const code of Object.values(ErrorCode)) {
      expect(ERROR_DEFAULT_MESSAGE[code]).toMatch(/\S/);
    }
  });
});

describe("AppError", () => {
  it("carries code, status, default message and options", () => {
    const e = new AppError(ErrorCode.NOT_FOUND);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("AppError");
    expect(e.message).toBe(ERROR_DEFAULT_MESSAGE[ErrorCode.NOT_FOUND]);
    expect(e.httpStatus).toBe(404);
    expect(isAppError(e)).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);

    const cause = new Error("root");
    const v = new AppError(ErrorCode.VALIDATION, "Bad input", {
      fieldErrors: { email: ["Invalid"] },
      retryAfterMs: 5,
      cause,
    });
    expect(v.message).toBe("Bad input");
    expect(v.cause).toBe(cause);
    expect(v.toActionError()).toEqual({
      code: "VALIDATION",
      message: "Bad input",
      fieldErrors: { email: ["Invalid"] },
      retryAfterMs: 5,
    });
    expect(new AppError(ErrorCode.FORBIDDEN).toActionError()).toEqual({
      code: "FORBIDDEN",
      message: ERROR_DEFAULT_MESSAGE[ErrorCode.FORBIDDEN],
    });
  });
});

describe("toActionResult envelope", () => {
  it("maps AppError to the wire error and everything else to INTERNAL", () => {
    expect(
      toActionResult(new AppError(ErrorCode.RATE_LIMITED, undefined, { retryAfterMs: 9 })),
    ).toEqual({
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: ERROR_DEFAULT_MESSAGE[ErrorCode.RATE_LIMITED],
        retryAfterMs: 9,
      },
    });
    expect(toActionResult(new Error("SELECT * FROM secrets"))).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "Something went wrong." },
    });
    expect(toActionResult("string")).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "Something went wrong." },
    });
  });

  it("ok / fail helpers", () => {
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 } });
    expect(fail(ErrorCode.CONFLICT)).toEqual({
      ok: false,
      error: { code: "CONFLICT", message: ERROR_DEFAULT_MESSAGE[ErrorCode.CONFLICT] },
    });
    expect(fail(ErrorCode.VALIDATION, "Nope", { fieldErrors: { a: ["x"] } })).toEqual({
      ok: false,
      error: { code: "VALIDATION", message: "Nope", fieldErrors: { a: ["x"] } },
    });
  });
});

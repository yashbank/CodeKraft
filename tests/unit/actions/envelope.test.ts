import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as actions from "@/lib/actions";
import {
  IdempotentReplay,
  defineAction,
  definePublicAction,
  fail,
  fieldErrorsFromIssues,
  ok,
  setActionErrorReporter,
  validateInput,
} from "@/lib/actions/envelope";
import { type Context, anonymousContext, buildContext } from "@/lib/authz/context";
import { type Role } from "@/lib/authz/permissions";
import { AppError, ErrorCode } from "@/lib/errors";

const as = (roles: Role[]): Context =>
  buildContext({ user: { id: "u1" }, session: { id: "s" }, roles, requestId: "req-1" });

const admin = as(["admin"]);
const customer = as(["customer"]);
const anon = anonymousContext({ requestId: "req-anon" });

const schema = z.object({
  title: z.string().min(3),
  items: z.array(z.object({ qty: z.number().int().positive() })).optional(),
});

afterEach(() => {
  setActionErrorReporter(undefined);
});

describe("ok / fail", () => {
  it("wraps data and errors", () => {
    expect(ok(1)).toEqual({ ok: true, data: 1 });
    expect(fail(new AppError(ErrorCode.NOT_FOUND))).toEqual({
      ok: false,
      error: { code: ErrorCode.NOT_FOUND, message: "Not found." },
    });
    expect(fail(new Error("db password is hunter2"))).toEqual({
      ok: false,
      error: { code: ErrorCode.INTERNAL, message: "Something went wrong." },
    });
  });

  it("barrel re-exports the envelope", () => {
    expect(actions.defineAction).toBe(defineAction);
  });
});

describe("validation", () => {
  it("maps Zod issues to dotted fieldErrors, form-level under _form", () => {
    const result = schema.safeParse({ title: "ab", items: [{ qty: 0 }] });
    expect(result.success).toBe(false);
    if (result.success) return;
    const fe = fieldErrorsFromIssues(result.error.issues);
    expect(Object.keys(fe).sort()).toEqual(["items.0.qty", "title"]);
    expect(fe.title).toHaveLength(1);
    const root = z.string().safeParse(42);
    if (root.success) return;
    expect(fieldErrorsFromIssues(root.error.issues)).toEqual({ _form: [expect.any(String)] });
  });

  it("accumulates several messages on one field", () => {
    const multi = z.string().min(5).regex(/^a/);
    const r = multi.safeParse("zzz");
    if (r.success) return;
    expect(fieldErrorsFromIssues(r.error.issues)._form).toHaveLength(2);
  });

  it("validateInput returns parsed data or throws VALIDATION", () => {
    expect(validateInput(schema, { title: "hello", extra: 1 })).toEqual({ title: "hello" });
    try {
      validateInput(schema, {});
      expect.unreachable();
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.VALIDATION);
      expect((err as AppError).fieldErrors).toEqual({ title: [expect.any(String)] });
    }
  });
});

describe("defineAction", () => {
  const action = defineAction({
    name: "API-TEST-01 thing.create",
    input: schema,
    permission: "catalog.write",
    handler: async (input, ctx) => ({ title: input.title.toUpperCase(), by: ctx.userId }),
  });

  it("returns VALIDATION with fieldErrors before touching auth", async () => {
    const result = await action({ title: "x" }, anon);
    expect(result).toEqual({
      ok: false,
      error: {
        code: ErrorCode.VALIDATION,
        message: "Some fields are invalid.",
        fieldErrors: { title: [expect.any(String)] },
      },
    });
  });

  it("returns UNAUTHENTICATED for anonymous callers", async () => {
    expect(await action({ title: "valid" }, anon)).toEqual({
      ok: false,
      error: { code: ErrorCode.UNAUTHENTICATED, message: "You need to sign in." },
    });
  });

  it("returns FORBIDDEN without the permission", async () => {
    expect(await action({ title: "valid" }, customer)).toEqual({
      ok: false,
      error: { code: ErrorCode.FORBIDDEN, message: "You do not have permission to do that." },
    });
  });

  it("runs the handler with parsed input and the authenticated context", async () => {
    expect(await action({ title: "valid", junk: true }, admin)).toEqual({
      ok: true,
      data: { title: "VALID", by: "u1" },
    });
  });

  it("accepts a permission list as any-of", async () => {
    const anyOf = defineAction({
      input: z.object({}),
      permission: ["settings.write", "settings.read"],
      handler: () => "seen",
    });
    expect(await anyOf({}, admin)).toEqual({ ok: true, data: "seen" });
    expect(await anyOf({}, customer)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await anyOf({}, anon)).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("works without a permission (session-only actions) and with sync handlers", async () => {
    const sessionOnly = defineAction({ input: z.object({}), handler: (_i, ctx) => ctx.userId });
    expect(await sessionOnly({}, customer)).toEqual({ ok: true, data: "u1" });
    expect(await sessionOnly({}, anon)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("maps a thrown AppError to its code, message and extras", async () => {
    const throwing = defineAction({
      input: z.object({}),
      handler: () => {
        throw new AppError(ErrorCode.RATE_LIMITED, "Slow down.", { retryAfterMs: 1500 });
      },
    });
    expect(await throwing({}, admin)).toEqual({
      ok: false,
      error: { code: ErrorCode.RATE_LIMITED, message: "Slow down.", retryAfterMs: 1500 },
    });
  });

  it("maps an unknown error to INTERNAL with an incident reference and never leaks the message", async () => {
    const boom = defineAction({
      input: z.object({}),
      handler: async () => {
        throw new Error("connection to db://user:secret@host failed");
      },
    });
    const result = await boom({}, admin);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ErrorCode.INTERNAL);
    expect(result.error.message).toMatch(/^Something went wrong\. Reference: [0-9a-f-]{36}$/);
    expect(result.error.message).not.toContain("secret");
    expect(result.error).not.toHaveProperty("fieldErrors");
  });

  it("handles non-Error throwables the same way", async () => {
    const boom = defineAction({
      input: z.object({}),
      handler: () => {
        throw "raw string with token=abc";
      },
    });
    const result = await boom({}, admin);
    expect(result).toMatchObject({ ok: false, error: { code: ErrorCode.INTERNAL } });
    if (!result.ok) expect(result.error.message).not.toContain("token");
  });

  it("calls the error reporter with the report and uses its event id as the reference", async () => {
    const reporter = vi.fn(() => "sentry-evt-42");
    setActionErrorReporter(reporter);
    const err = new Error("kaboom");
    const boom = defineAction({
      name: "API-X-01 x.do",
      input: z.object({}),
      handler: () => {
        throw err;
      },
    });
    const result = await boom({}, admin);
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(err, {
      action: "API-X-01 x.do",
      incidentId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      requestId: "req-1",
      userId: "u1",
    });
    expect(result).toEqual({
      ok: false,
      error: {
        code: ErrorCode.INTERNAL,
        message: "Something went wrong. Reference: sentry-evt-42",
      },
    });
  });

  it("keeps the generated incident id when the reporter returns nothing, and survives a throwing reporter", async () => {
    const boom = defineAction({
      input: z.object({}),
      handler: () => {
        throw new Error("x");
      },
    });
    setActionErrorReporter(() => undefined);
    const a = await boom({}, admin);
    if (!a.ok) expect(a.error.message).toMatch(/Reference: [0-9a-f-]{36}$/);

    setActionErrorReporter(() => "");
    const b = await boom({}, admin);
    if (!b.ok) expect(b.error.message).toMatch(/Reference: [0-9a-f-]{36}$/);

    setActionErrorReporter(() => {
      throw new Error("sentry down");
    });
    const c = await boom({}, admin);
    expect(c).toMatchObject({ ok: false, error: { code: ErrorCode.INTERNAL } });
  });

  it("does not report AppErrors or validation failures", async () => {
    const reporter = vi.fn(() => undefined);
    setActionErrorReporter(reporter);
    await action({ title: "x" }, admin);
    await action({ title: "valid" }, customer);
    expect(reporter).not.toHaveBeenCalled();
  });

  it("answers IdempotentReplay with ok + original data (docs/06 §1.5)", async () => {
    const replay = defineAction({
      input: z.object({}),
      handler: () => {
        throw new IdempotentReplay({ paymentId: "p1" });
      },
    });
    expect(await replay({}, admin)).toEqual({ ok: true, data: { paymentId: "p1" } });
    expect(new IdempotentReplay(1).code).toBe(ErrorCode.IDEMPOTENT_REPLAY);
  });

  it("never rejects", async () => {
    const cases = [action({ title: "x" }, anon), action({ title: "valid" }, admin)];
    await expect(Promise.all(cases)).resolves.toHaveLength(2);
  });
});

describe("definePublicAction", () => {
  const inquiry = definePublicAction({
    input: z.object({ email: z.email() }),
    handler: (input, ctx) => ({ email: input.email, user: ctx.userId }),
  });

  it("runs for anonymous and authenticated callers", async () => {
    expect(await inquiry({ email: "a@b.co" }, anon)).toEqual({
      ok: true,
      data: { email: "a@b.co", user: null },
    });
    expect(await inquiry({ email: "a@b.co" }, customer)).toEqual({
      ok: true,
      data: { email: "a@b.co", user: "u1" },
    });
  });

  it("still validates and never throws", async () => {
    expect(await inquiry({ email: "nope" }, anon)).toMatchObject({
      ok: false,
      error: { code: ErrorCode.VALIDATION, fieldErrors: { email: [expect.any(String)] } },
    });
    const boom = definePublicAction({
      input: z.object({}),
      handler: () => {
        throw new Error("leak?");
      },
    });
    const r = await boom({}, anon);
    expect(r).toMatchObject({ ok: false, error: { code: ErrorCode.INTERNAL } });
    if (!r.ok) expect(r.error.message).not.toContain("leak");
  });
});

// @vitest-environment node
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import {
  REDACTED,
  REDACT_PATHS,
  createLogger,
  getLogger,
  logger,
  moduleLogger,
  resolveLevel,
  withRequestId,
} from "@/lib/logger";

function capture(): { stream: Writable; lines: () => Record<string, unknown>[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return {
    stream,
    lines: () =>
      chunks
        .join("")
        .split("\n")
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>),
  };
}

describe("logger redaction (docs/12 §8.2)", () => {
  const savedLevel = process.env.LOG_LEVEL;
  afterEach(() => {
    if (savedLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = savedLevel;
  });

  it("redacts password / cookie / token fields at the top level and one level down", () => {
    const { stream, lines } = capture();
    const log = createLogger({ destination: stream, level: "info" });
    log.info(
      {
        password: "hunter2",
        user: { password: "hunter2", email: "a@b.test" },
        req: { headers: { cookie: "sid=abc", authorization: "Bearer x", accept: "*/*" } },
        res: { headers: { "set-cookie": "sid=abc; HttpOnly" } },
        token: "t0k",
        licenseKey: "AAAA-BBBB",
        bank_details: { ifsc: "HDFC0001" },
        payout: { bankDetails: { account_number: "123" } },
        apiKey: "k",
        email: { to: "a@b.test", html: "<p>Reset link</p>" },
      },
      "login",
    );
    const [entry] = lines();
    expect(entry).toBeDefined();
    const e = entry as Record<string, unknown>;
    expect(e.msg).toBe("login");
    expect(e.level).toBe(30);
    expect(e.password).toBe(REDACTED);
    expect((e.user as Record<string, unknown>).password).toBe(REDACTED);
    expect((e.user as Record<string, unknown>).email).toBe("a@b.test");
    const reqHeaders = (e.req as { headers: Record<string, unknown> }).headers;
    expect(reqHeaders.cookie).toBe(REDACTED);
    expect(reqHeaders.authorization).toBe(REDACTED);
    expect(reqHeaders.accept).toBe("*/*");
    expect((e.res as { headers: Record<string, unknown> }).headers["set-cookie"]).toBe(REDACTED);
    expect(e.token).toBe(REDACTED);
    expect(e.licenseKey).toBe(REDACTED);
    expect(e.bank_details).toBe(REDACTED);
    expect((e.payout as Record<string, unknown>).bankDetails).toBe(REDACTED);
    expect(e.apiKey).toBe(REDACTED);
    expect((e.email as Record<string, unknown>).html).toBe(REDACTED);
    expect((e.email as Record<string, unknown>).to).toBe("a@b.test");
    expect(JSON.stringify(entry)).not.toMatch(
      /hunter2|sid=abc|Bearer x|AAAA-BBBB|HDFC0001|Reset link/,
    );
  });

  it("lists every key of the docs/12 §8.2 redact list", () => {
    for (const key of [
      "password",
      "token",
      "secret",
      "authorization",
      "cookie",
      '["set-cookie"]',
      "license_key",
      "licenseKey",
      "bank",
      "account_number",
      "ifsc",
      "upi",
      "otp",
      "apiKey",
      '["x-api-key"]',
      "presignedUrl",
      "url.query.token",
    ]) {
      expect(REDACT_PATHS).toContain(key);
    }
  });

  it("withRequestId / moduleLogger add bindings; the lazy proxy resolves the root", () => {
    const { stream, lines } = capture();
    const log = createLogger({ destination: stream, base: { env: "test" } });
    const child = log.child({ requestId: "req-1" });
    child.info({ cookie: "x" }, "hello");
    const [entry] = lines();
    expect(entry).toMatchObject({
      requestId: "req-1",
      env: "test",
      cookie: REDACTED,
      msg: "hello",
    });
    expect(typeof (entry as { time: unknown }).time).toBe("string");

    const bound = withRequestId("req-2", { route: "/x" }).bindings();
    expect(bound).toMatchObject({ requestId: "req-2", route: "/x" });
    expect(moduleLogger("finance").bindings()).toMatchObject({ module: "finance" });
    expect(getLogger()).toBe(getLogger());
    expect(typeof logger.info).toBe("function");
    expect(logger.level).toBe(getLogger().level);
  });

  it("resolves the level from LOG_LEVEL with info as the default", () => {
    expect(resolveLevel(undefined)).toBe("info");
    expect(resolveLevel("DEBUG ")).toBe("debug");
    expect(resolveLevel("loud")).toBe("info");
    process.env.LOG_LEVEL = "warn";
    const { stream, lines } = capture();
    const log = createLogger({ destination: stream });
    expect(log.level).toBe("warn");
    log.info("dropped");
    log.warn("kept");
    expect(lines().map((l) => l.msg)).toEqual(["kept"]);
  });

  it("never enables pino-pretty inside a test run", () => {
    // VITEST is set: even with APP_ENV=local the transport must stay plain JSON.
    const saved = process.env.APP_ENV;
    process.env.APP_ENV = "local";
    try {
      const log = createLogger();
      expect(log.level).toBe("info");
      expect(log.bindings()).toMatchObject({ env: "local" });
    } finally {
      if (saved === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = saved;
    }
  });
});

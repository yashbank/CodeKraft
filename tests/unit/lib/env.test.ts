// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { EnvError, getEnv, parseEnv, resetEnvCache, type RawEnv } from "@/lib/env";

/** Minimal dotenv reader for `.env.example` (KEY=value lines, `#` comments). */
function readEnvExample(): RawEnv {
  const out: RawEnv = {};
  for (const line of readFileSync(".env.example", "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m) out[m[1] as string] = m[2] as string;
  }
  return out;
}

const example = readEnvExample();

const PRODUCTION: RawEnv = {
  ...example,
  APP_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://codekraft.in/",
  NEXT_PUBLIC_ADMIN_URL: "https://admin.codekraft.in",
  ADMIN_HOST: "admin.codekraft.in",
  DATABASE_URL: "postgres://user:pw@ep-abc-123-pooler.ap-southeast-1.aws.neon.tech/codekraft",
  DATABASE_URL_UNPOOLED: "postgres://user:pw@ep-abc-123.ap-southeast-1.aws.neon.tech/codekraft",
  BETTER_AUTH_SECRET: "s".repeat(32),
  BETTER_AUTH_URL: "https://codekraft.in",
  APP_ENCRYPTION_KEY: "k".repeat(44),
  CRON_SECRET: "cron-secret",
  RESEND_API_KEY: "re_123",
  EMAIL_TRANSPORT: "resend",
  EMAIL_FROM: "CodeKraft <hello@codekraft.in>",
  R2_BUCKET_PUBLIC: "codekraft-public",
  R2_BUCKET_PRIVATE: "codekraft-private",
  R2_BUCKET_DOCUMENTS: "codekraft-documents",
  R2_BUCKET_BACKUPS: "codekraft-backups",
};

function issuesOf(raw: RawEnv): string[] {
  try {
    parseEnv(raw);
  } catch (err) {
    if (err instanceof EnvError) return [...err.issues];
    throw err;
  }
  throw new Error("expected parseEnv to throw");
}

describe("parseEnv", () => {
  it("accepts .env.example as the local configuration", () => {
    const env = parseEnv(example);
    expect(env.APP_ENV).toBe("local");
    expect(env.EMAIL_TRANSPORT).toBe("log");
    expect(env.RUN_SCHEDULER).toBe(false);
    expect(env.BETTER_AUTH_SECRET).toBeUndefined();
    expect(env.EMAIL_ALLOWLIST).toEqual([]);
    expect(env.FEATURE_PHONE_OTP).toBeUndefined();
    expect(env.FX_API_URL).toBe("https://open.er-api.com/v6/latest");
    expect(env.DATABASE_URL_UNPOOLED).toBe(env.DATABASE_URL);
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe("1x00000000000000000000AA");
  });

  it("treats the harness value APP_ENV=test like local and trims/strips trailing slashes", () => {
    const env = parseEnv({ ...example, APP_ENV: "test", NEXT_PUBLIC_SITE_URL: " http://a.test/ " });
    expect(env.APP_ENV).toBe("local");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://a.test");
  });

  it("parses boolean-ish flags and comma lists", () => {
    const env = parseEnv({
      ...example,
      RUN_SCHEDULER: "true",
      FEATURE_BUNDLES: "1",
      FEATURE_THREE_HERO: "off",
      EMAIL_ALLOWLIST: "a@x.test, b@x.test ,,",
    });
    expect(env.RUN_SCHEDULER).toBe(true);
    expect(env.FEATURE_BUNDLES).toBe(true);
    expect(env.FEATURE_THREE_HERO).toBe(false);
    expect(env.EMAIL_ALLOWLIST).toEqual(["a@x.test", "b@x.test"]);
    expect(issuesOf({ ...example, FEATURE_BUNDLES: "maybe" })).toEqual([
      expect.stringMatching(/^FEATURE_BUNDLES: expected true\/false/),
    ]);
  });

  it("rejects malformed core values", () => {
    expect(issuesOf({ ...example, NEXT_PUBLIC_SITE_URL: "localhost:3000" })).toEqual([
      expect.stringMatching(/^NEXT_PUBLIC_SITE_URL/),
    ]);
    expect(issuesOf({ ...example, APP_ENV: "prod" })).toEqual([expect.stringMatching(/^APP_ENV/)]);
    expect(issuesOf({ ...example, DATABASE_URL: "mysql://x" })).toEqual([
      expect.stringMatching(/^DATABASE_URL: must be a postgres/),
    ]);
    expect(issuesOf({ ...example, EMAIL_TRANSPORT: "smtp" })).toEqual([
      expect.stringMatching(/^EMAIL_TRANSPORT/),
    ]);
    expect(issuesOf({ ...example, R2_BUCKET_PUBLIC: "Bad_Bucket" })).toEqual([
      expect.stringMatching(/^R2_BUCKET_PUBLIC/),
    ]);
  });

  it("requires BETTER_AUTH_SECRET outside local", () => {
    expect(issuesOf({ ...example, APP_ENV: "preview" })).toEqual([
      "BETTER_AUTH_SECRET: required outside local",
    ]);
    expect(parseEnv({ ...example, APP_ENV: "preview", BETTER_AUTH_SECRET: "x" }).APP_ENV).toBe(
      "preview",
    );
  });

  it("refuses resend without an allowlist outside production", () => {
    expect(issuesOf({ ...example, EMAIL_TRANSPORT: "resend" })).toEqual([
      expect.stringMatching(/^EMAIL_ALLOWLIST: must list recipients/),
    ]);
    expect(
      parseEnv({ ...example, EMAIL_TRANSPORT: "resend", EMAIL_ALLOWLIST: "f@x.test" })
        .EMAIL_ALLOWLIST,
    ).toEqual(["f@x.test"]);
  });

  describe("production guards (docs/12 §1)", () => {
    it("accepts a complete production configuration", () => {
      const env = parseEnv(PRODUCTION);
      expect(env.APP_ENV).toBe("production");
      expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://codekraft.in");
    });

    it("fails when required secrets are missing", () => {
      const issues = issuesOf({
        ...PRODUCTION,
        BETTER_AUTH_SECRET: "",
        APP_ENCRYPTION_KEY: undefined,
        CRON_SECRET: "",
        RESEND_API_KEY: "",
      });
      expect(issues).toEqual(
        expect.arrayContaining([
          "BETTER_AUTH_SECRET: required outside local",
          "APP_ENCRYPTION_KEY: required in production",
          "CRON_SECRET: required in production",
          "RESEND_API_KEY: required in production",
        ]),
      );
    });

    it("requires a 32+ character BETTER_AUTH_SECRET", () => {
      expect(issuesOf({ ...PRODUCTION, BETTER_AUTH_SECRET: "short" })).toEqual([
        "BETTER_AUTH_SECRET: must be at least 32 characters in production",
      ]);
    });

    it("refuses to boot with codekraft-dev-public (acceptance criterion)", () => {
      expect(issuesOf({ ...PRODUCTION, R2_BUCKET_PUBLIC: "codekraft-dev-public" })).toEqual([
        "R2_BUCKET_PUBLIC: production must not use bucket codekraft-dev-public",
      ]);
      expect(issuesOf({ ...PRODUCTION, R2_BUCKET_BACKUPS: "codekraft-staging-backups" })).toEqual([
        expect.stringMatching(/^R2_BUCKET_BACKUPS/),
      ]);
    });

    it("refuses dev / localhost database hosts", () => {
      expect(issuesOf({ ...PRODUCTION, DATABASE_URL: example.DATABASE_URL })).toEqual([
        expect.stringMatching(/^DATABASE_URL: production must connect/),
      ]);
      expect(
        issuesOf({
          ...PRODUCTION,
          DATABASE_URL_UNPOOLED: "postgres://u:p@ep-dev.ap-southeast-1.aws.neon.tech/db",
        }),
      ).toEqual([expect.stringMatching(/^DATABASE_URL_UNPOOLED: production must connect/)]);
    });

    it("requires the resend transport", () => {
      expect(issuesOf({ ...PRODUCTION, EMAIL_TRANSPORT: "log" })).toEqual([
        "EMAIL_TRANSPORT: must be `resend` in production",
      ]);
    });

    it("lists every issue in the error message", () => {
      expect(() => parseEnv({ ...PRODUCTION, CRON_SECRET: "", EMAIL_TRANSPORT: "log" })).toThrow(
        /Invalid environment:\n {2}- CRON_SECRET: required in production\n {2}- EMAIL_TRANSPORT/,
      );
    });
  });
});

describe("getEnv", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    resetEnvCache();
  });

  it("parses process.env once and memoises", () => {
    process.env = { ...example, APP_ENV: "local", NODE_ENV: "test" };
    resetEnvCache();
    const first = getEnv();
    process.env.APP_ENV = "production";
    expect(getEnv()).toBe(first);
    resetEnvCache();
    expect(() => getEnv()).toThrow(EnvError);
  });
});

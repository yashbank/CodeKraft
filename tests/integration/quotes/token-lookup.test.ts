import { beforeAll, describe, expect, it } from "vitest";
import { getQuoteQuery } from "@/modules/quotes/queries";
import { ErrorCode } from "@/lib/errors";
import { buildContext } from "@/lib/authz/context";
import { migrateTestDb } from "../../setup/migrate";

describe("getQuoteQuery token lookup (page maps VALIDATION/NOT_FOUND to 404)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });
  const ctx = buildContext({
    user: { id: crypto.randomUUID() },
    session: { id: "s" },
    roles: ["user"],
  });

  it("malformed token -> ok:false VALIDATION", async () => {
    const r = await getQuoteQuery({ token: "faketoken" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(ErrorCode.VALIDATION);
  });

  it("well-formed unknown token -> ok:false NOT_FOUND", async () => {
    const r = await getQuoteQuery({ token: "a".repeat(32) }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(ErrorCode.NOT_FOUND);
  });
});

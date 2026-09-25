// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/modules/auth/hash";

describe("argon2id hashing", () => {
  it("produces $argon2id$ hashes that verify and reject wrong passwords", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword({ hash: h, password: "correct horse battery" })).toBe(true);
    expect(await verifyPassword({ hash: h, password: "wrong" })).toBe(false);
    expect(await verifyPassword({ hash: "$2b$notargon", password: "x" })).toBe(false);
  });
});

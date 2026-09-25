import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  CURRENT_KEY_VERSION,
  CryptoError,
  decodeKey,
  decrypt,
  decryptToBuffer,
  encrypt,
  generateKey,
  hashToken,
  isEncryptedToken,
  safeEqual,
} from "@/lib/crypto";

const KEY = generateKey();
const OTHER = generateKey();

describe("encrypt / decrypt", () => {
  it("round-trips text and bytes with a v1: prefix and four base64 segments", () => {
    const token = encrypt("XXXX-YYYY-ZZZZ", KEY);
    expect(token.startsWith(`${CURRENT_KEY_VERSION}:`)).toBe(true);
    expect(token.split(":")).toHaveLength(4);
    expect(token).not.toContain("XXXX-YYYY-ZZZZ");
    expect(isEncryptedToken(token)).toBe(true);
    expect(decrypt(token, KEY)).toBe("XXXX-YYYY-ZZZZ");

    const bytes = randomBytes(40);
    expect(decryptToBuffer(encrypt(bytes, KEY), KEY).equals(bytes)).toBe(true);
    expect(decrypt(encrypt("", KEY), KEY)).toBe("");
    expect(decrypt(encrypt("नमस्ते 🙂", KEY), KEY)).toBe("नमस्ते 🙂");
  });

  it("uses a fresh IV per call", () => {
    expect(encrypt("same", KEY)).not.toBe(encrypt("same", KEY));
  });

  it("fails with the wrong key", () => {
    const token = encrypt("secret", KEY);
    expect(() => decrypt(token, OTHER)).toThrow(CryptoError);
    expect(() => decrypt(token, OTHER)).toThrow(/wrong key or tampered/);
  });

  it("fails when the tag or ciphertext is tampered with", () => {
    const token = encrypt("secret", KEY);
    const [v, iv, tag, data] = token.split(":") as [string, string, string, string];
    const flip = (b64: string) => {
      const buf = Buffer.from(b64, "base64");
      buf[0] = (buf[0] as number) ^ 0xff;
      return buf.toString("base64");
    };
    expect(() => decrypt(`${v}:${iv}:${flip(tag)}:${data}`, KEY)).toThrow(/tampered/);
    expect(() => decrypt(`${v}:${iv}:${tag}:${flip(data)}`, KEY)).toThrow(/tampered/);
    expect(() => decrypt(`${v}:${flip(iv)}:${tag}:${data}`, KEY)).toThrow(/tampered/);
  });

  it("rejects malformed tokens and unknown key versions", () => {
    expect(() => decrypt("plain", KEY)).toThrow(/malformed/);
    expect(() => decrypt("v1:a:b", KEY)).toThrow(/malformed/);
    expect(() => decrypt("v1:AAAA:AAAA:AAAA", KEY)).toThrow(/malformed/);
    const token = encrypt("x", KEY);
    expect(() => decrypt(token.replace(/^v1:/, "v2:"), KEY)).toThrow(
      /no encryption key for version v2/,
    );
    expect(isEncryptedToken("hello")).toBe(false);
  });

  it("supports a key ring for rotation", () => {
    const ring = { v1: decodeKey(KEY), v2: decodeKey(OTHER) };
    const v1 = encrypt("a", ring);
    const v2 = encrypt("b", ring, "v2");
    expect(v2.startsWith("v2:")).toBe(true);
    expect(decrypt(v1, ring)).toBe("a");
    expect(decrypt(v2, ring)).toBe("b");
    expect(() => encrypt("c", ring, "v3")).toThrow(/no encryption key for version v3/);
    expect(() => encrypt("c", { v1: Buffer.alloc(5) })).toThrow(/wrong length/);
  });

  it("decodes base64, base64url and hex keys and rejects wrong sizes", () => {
    const raw = randomBytes(32);
    expect(decodeKey(raw.toString("base64")).equals(raw)).toBe(true);
    expect(decodeKey(raw.toString("base64url")).equals(raw)).toBe(true);
    expect(decodeKey(raw.toString("hex")).equals(raw)).toBe(true);
    expect(() => decodeKey("short")).toThrow(/32 bytes/);
    expect(decrypt(encrypt("buf", raw), raw)).toBe("buf");
  });

  describe("APP_ENCRYPTION_KEY fallback", () => {
    const saved = process.env.APP_ENCRYPTION_KEY;
    afterEach(() => {
      if (saved === undefined) delete process.env.APP_ENCRYPTION_KEY;
      else process.env.APP_ENCRYPTION_KEY = saved;
    });

    it("uses the env key when none is passed", () => {
      process.env.APP_ENCRYPTION_KEY = KEY;
      expect(decrypt(encrypt("env"))).toBe("env");
      process.env.APP_ENCRYPTION_KEY = "";
      expect(() => encrypt("env")).toThrow(/APP_ENCRYPTION_KEY is not set/);
    });
  });
});

describe("hashToken / safeEqual", () => {
  it("hashes deterministically to sha256 hex", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hashToken("abc")).toHaveLength(64);
  });

  it("compares in constant time regardless of length", () => {
    expect(safeEqual("token", "token")).toBe(true);
    expect(safeEqual("token", "Token")).toBe(false);
    expect(safeEqual("token", "tokens")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("", "x")).toBe(false);
  });
});

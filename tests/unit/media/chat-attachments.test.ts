// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
  validateAttachmentCount,
  validateAttachmentFile,
} from "@/lib/attachments";
import type { Context } from "@/lib/authz/context";
import { mayReadAttachment, resolveOwnAttachments } from "@/modules/media/attachments";
import { validateUploadIntent } from "@/modules/media/validation";
import { AnthropicProvider } from "@/modules/chat/providers/anthropic";
import {
  MODEL_IMAGE_MAX_BYTES,
  MODEL_TEXT_PER_FILE_CHARS,
  buildUserContent,
} from "@/modules/chat/attachments";
import { sendMessageSchema } from "@/modules/chat/types";
import { queryAttachmentsSchema } from "@/modules/queries/types";

const U1 = "11111111-1111-4111-8111-111111111111";
const M = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;

describe("attachment validation (P14-06)", () => {
  it("accepts the allow-list and rejects other types", () => {
    for (const n of ["a.png", "a.JPG", "a.webp", "a.gif", "a.pdf", "a.txt", "a.md", "a.csv"])
      expect(validateAttachmentFile({ name: n, size: 10 })).toBeNull();
    for (const n of ["a.svg", "a.exe", "a.html", "a.zip", "noext"])
      expect(validateAttachmentFile({ name: n, size: 10 })).toMatch(/not allowed/);
  });
  it("enforces size and mime/extension agreement", () => {
    expect(validateAttachmentFile({ name: "a.png", size: ATTACHMENT_MAX_BYTES + 1 })).toMatch(
      /larger than/,
    );
    expect(validateAttachmentFile({ name: "a.png", size: 0 })).toMatch(/empty/);
    expect(validateAttachmentFile({ name: "a.png", size: 5, mime: "application/pdf" })).toMatch(
      /does not match/,
    );
    expect(
      validateAttachmentFile({ name: "a.csv", size: 5, mime: "application/vnd.ms-excel" }),
    ).toBeNull();
  });
  it("caps the count at 5", () => {
    expect(validateAttachmentCount(ATTACHMENT_MAX_FILES)).toBeNull();
    expect(validateAttachmentCount(ATTACHMENT_MAX_FILES + 1)).toMatch(/up to 5/);
    expect(
      queryAttachmentsSchema.safeParse(Array.from({ length: 6 }, (_, i) => M(i))).success,
    ).toBe(false);
  });
  it("upload intent for chat_attachment enforces type, size and ext/mime match server-side", () => {
    const base = {
      purpose: "chat_attachment" as const,
      filename: "a.png",
      mime: "image/png",
      sizeBytes: 100,
    };
    expect(() => validateUploadIntent(base)).not.toThrow();
    expect(() =>
      validateUploadIntent({ ...base, filename: "a.svg", mime: "image/svg+xml" }),
    ).toThrow();
    expect(() =>
      validateUploadIntent({ ...base, filename: "a.exe", mime: "application/x-msdownload" }),
    ).toThrow();
    expect(() => validateUploadIntent({ ...base, sizeBytes: ATTACHMENT_MAX_BYTES + 1 })).toThrow();
    expect(() => validateUploadIntent({ ...base, mime: "application/pdf" })).toThrow(/match/);
  });
  it("send schema: 5 max, needs text or a file", () => {
    const ok = { conversationId: U1, content: "hi" };
    expect(sendMessageSchema.safeParse(ok).success).toBe(true);
    expect(sendMessageSchema.safeParse({ ...ok, content: "" }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ ...ok, content: "", attachments: [M(1)] }).success).toBe(
      true,
    );
    expect(
      sendMessageSchema.safeParse({ ...ok, attachments: Array.from({ length: 6 }, (_, i) => M(i)) })
        .success,
    ).toBe(false);
  });
});

describe("resolveOwnAttachments", () => {
  const row = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    uploadedBy: U1,
    visibility: "private",
    mime: "image/png",
    sizeBytes: 10,
    ...over,
  });
  const dbWith = (rows: unknown[]) =>
    ({ select: () => ({ from: () => ({ where: async () => rows }) }) }) as never;

  it("returns the caller's own files", async () => {
    const out = await resolveOwnAttachments(dbWith([row(M(1))]), U1, [M(1)]);
    expect(out.map((o) => o.id)).toEqual([M(1)]);
  });
  it("rejects more than 5, duplicates, someone else's file and a disallowed type", async () => {
    const six = Array.from({ length: 6 }, (_, i) => M(i));
    await expect(resolveOwnAttachments(dbWith([]), U1, six)).rejects.toThrow(/up to 5/);
    await expect(resolveOwnAttachments(dbWith([row(M(1))]), U1, [M(1), M(1)])).rejects.toThrow();
    await expect(
      resolveOwnAttachments(dbWith([row(M(1), { uploadedBy: "someone-else" })]), U1, [M(1)]),
    ).rejects.toThrow();
    await expect(
      resolveOwnAttachments(dbWith([row(M(1), { mime: "image/svg+xml" })]), U1, [M(1)]),
    ).rejects.toThrow();
    await expect(resolveOwnAttachments(dbWith([]), null, [M(1)])).rejects.toThrow();
  });
});

describe("attachment authorisation", () => {
  const ctx = (userId: string | null, perms: string[] = []) =>
    ({ userId, roles: [], permissions: new Set(perms) }) as unknown as Context;
  const none = { uploadedByCaller: false, inOwnQuery: false, inAnyQuery: false, inAnyChat: false };

  it("another customer gets no access", () => {
    expect(mayReadAttachment(ctx("other"), { ...none, inAnyQuery: true, inAnyChat: true })).toBe(
      false,
    );
    expect(mayReadAttachment(ctx(null), { ...none, uploadedByCaller: true })).toBe(false);
  });
  it("uploader and thread owner do", () => {
    expect(mayReadAttachment(ctx(U1), { ...none, uploadedByCaller: true })).toBe(true);
    expect(mayReadAttachment(ctx(U1), { ...none, inOwnQuery: true })).toBe(true);
  });
  it("admins need the matching read permission", () => {
    expect(mayReadAttachment(ctx("a", ["queries.read"]), { ...none, inAnyQuery: true })).toBe(true);
    expect(mayReadAttachment(ctx("a", ["queries.read"]), { ...none, inAnyChat: true })).toBe(false);
    expect(
      mayReadAttachment(ctx("a", ["chat.transcripts.read"]), { ...none, inAnyChat: true }),
    ).toBe(true);
    expect(mayReadAttachment(ctx("a"), { ...none, inAnyQuery: true, inAnyChat: true })).toBe(false);
  });
});

describe("AI request builder", () => {
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  it("plain string when nothing is attached", () => {
    expect(buildUserContent("hello", [])).toBe("hello");
  });
  it("images become base64 image blocks, text files are extracted", () => {
    const out = buildUserContent("see these", [
      { name: "shot.png", mime: "image/png", body: png },
      { name: "log.txt", mime: "text/plain", body: Buffer.from("line one\nline two") },
    ]);
    expect(Array.isArray(out)).toBe(true);
    const blocks = out as Exclude<typeof out, string>;
    expect(blocks[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: png.toString("base64") },
    });
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n");
    expect(text).toContain("line one\nline two");
    expect(text).toContain("log.txt");
    expect(text).toContain("see these");
  });
  it("caps extracted text, skips huge images, notes unreadable pdf", () => {
    const out = buildUserContent("q", [
      {
        name: "big.txt",
        mime: "text/plain",
        body: Buffer.from("x".repeat(MODEL_TEXT_PER_FILE_CHARS + 500)),
      },
      { name: "huge.png", mime: "image/png", body: Buffer.alloc(MODEL_IMAGE_MAX_BYTES + 1) },
      { name: "doc.pdf", mime: "application/pdf", body: Buffer.from("%PDF-") },
    ]) as Array<{ type: string; text?: string }>;
    expect(out.some((b) => b.type === "image")).toBe(false);
    const all = out.map((b) => b.text ?? "").join("\n");
    expect(all).toContain("truncated, 500 more characters");
    expect(all).toContain("huge.png: image too large");
    expect(all).toContain("doc.pdf");
    expect(all).toContain("cannot be read");
  });
  afterEach(() => vi.unstubAllGlobals());
  it("AnthropicProvider sends the image block to the messages API (mocked fetch)", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicProvider({
      apiKey: "test",
      model: "claude-sonnet-5-5",
      maxOutputTokens: 600,
      timeoutMs: 1000,
      maxRetries: 0,
    });
    const content = buildUserContent("hi", [{ name: "a.png", mime: "image/png", body: png }]);
    await expect(
      (async () => {
        for await (const _ of provider.stream("sys", [{ role: "user", content }], {
          model: "claude-sonnet-5-5",
          maxTokens: 600,
          timeoutMs: 1000,
        }))
          void _;
      })(),
    ).rejects.toThrow();
    const sent = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    );
    expect(sent.messages[0].content[0].type).toBe("image");
    expect(sent.messages[0].content[0].source.media_type).toBe("image/png");
  });
});

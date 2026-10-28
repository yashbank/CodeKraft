// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/chat/caps", () => ({
  chatCapGuard: {
    check: vi.fn(),
    increment: vi.fn(),
    decrement: vi.fn(),
    caps: vi.fn(),
  },
}));
vi.mock("@/modules/settings/service", () => ({
  settingsService: { load: vi.fn() },
}));
vi.mock("@/modules/notifications/service", () => ({ notificationsService: { emit: vi.fn() } }));

import { CHAT_MODELS } from "@/modules/chat/models";
import { chatCapGuard } from "@/modules/chat/caps";
import { AnthropicProvider } from "@/modules/chat/providers/anthropic";
import { DefaultChatService } from "@/modules/chat/service";
import { settingsService } from "@/modules/settings/service";
import type { LLMEvent, LLMProvider } from "@/modules/chat/llm";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AI chat settings", () => {
  it("lists models cheapest first and includes current Anthropic ids", () => {
    const prices = CHAT_MODELS.map((m) => m.inputPerMTok);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const ids = CHAT_MODELS.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]),
    );
    expect(ids.indexOf("claude-haiku-5-5")).toBeLessThan(ids.indexOf("claude-opus-5-5"));
  });

  it("new conversations persist the admin default model", async () => {
    vi.mocked(settingsService.load).mockResolvedValue({ aiModel: "claude-haiku-5-5" } as never);
    vi.mocked(chatCapGuard.check).mockResolvedValue({
      allowed: true,
      exceeded: null,
      usage: { userRemaining: 1, platformRemaining: 1 },
    });
    const inserted: unknown[] = [];
    const chain = (rows: unknown[]): unknown =>
      new Proxy(() => undefined, {
        get: (_t, k) =>
          k === "then"
            ? (res: (v: unknown) => void) => res(rows)
            : (...a: unknown[]) => {
                if (k === "values") inserted.push(a[0]);
                return chain(rows);
              },
      });
    const db = {
      select: () => chain([{ id: "p1", emailVerified: true }]),
      insert: () => chain([{ id: "c1" }]),
    };
    await new DefaultChatService(db as never).startConversation({ userId: "u1" } as never, {});
    expect(inserted).toContainEqual(expect.objectContaining({ model: "claude-haiku-5-5" }));
  });

  it("over cap -> fallback and no provider call", async () => {
    vi.mocked(chatCapGuard.check).mockResolvedValue({
      allowed: false,
      exceeded: "user",
      usage: { userRemaining: 0, platformRemaining: 5 },
    });
    const stream = vi.fn();
    const provider = { id: "x", model: "x", stream } as unknown as LLMProvider;
    const events = [];
    for await (const e of new DefaultChatService({} as never).sendMessage(
      { userId: "u1" } as never,
      { conversationId: "c", content: "hi" } as never,
      provider,
    ))
      events.push(e);
    expect(stream).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({ event: "fallback", data: { reason: "limit" } });
  });

  it("aborts a hung Anthropic call after timeoutMs", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_u: string, init: RequestInit) =>
          new Promise((_res, rej) =>
            init.signal!.addEventListener("abort", () => rej(new Error("aborted"))),
          ),
      ),
    );
    const p = new AnthropicProvider({
      apiKey: "k",
      model: "claude-sonnet-5-5",
      maxOutputTokens: 600,
      timeoutMs: 20000,
      maxRetries: 0,
    });
    const events: LLMEvent[] = [];
    const run = (async () => {
      for await (const e of p.stream("s", [{ role: "user", content: "hi" }], {
        model: "",
        maxTokens: 600,
        timeoutMs: 5000,
      }))
        events.push(e);
    })();
    await vi.advanceTimersByTimeAsync(5001);
    await run;
    expect(events).toEqual([expect.objectContaining({ type: "done", stopReason: "timeout" })]);
  });
});

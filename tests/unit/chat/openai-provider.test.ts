import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "@/modules/chat/providers/openai";
import { getLLMProvider } from "@/modules/chat/providers";
import { CAPTURE_LEAD_TOOL, type LLMEvent } from "@/modules/chat/llm";

const sse = (...chunks: unknown[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        const enc = new TextEncoder();
        for (const ch of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify(ch)}\n\n`));
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      },
    }),
  );
const delta = (d: object, finish: string | null = null) => ({
  choices: [{ delta: d, finish_reason: finish }],
});
const tc = (args: string, extra: object = {}) => ({
  tool_calls: [{ index: 0, function: { arguments: args }, ...extra }],
});

const provider = new OpenAIProvider({ apiKey: "k", model: "gpt-4o-mini", maxOutputTokens: 600 });
const opts = {
  model: "claude-opus-5",
  maxTokens: 1000,
  timeoutMs: 5000,
  tools: [CAPTURE_LEAD_TOOL],
};
async function run(res: Response) {
  const fetchMock = vi.fn().mockResolvedValue(res);
  vi.stubGlobal("fetch", fetchMock);
  const events: LLMEvent[] = [];
  for await (const e of provider.stream("sys", [{ role: "user", content: "hi" }], opts)) {
    events.push(e);
  }
  return { events, body: JSON.parse(fetchMock.mock.calls[0]![1].body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("OpenAIProvider", () => {
  it("streams text, tool call, usage; maps model and tools", async () => {
    const { events, body } = await run(
      sse(
        delta({ content: "Hel" }),
        delta({ content: "lo" }),
        delta(
          tc("", { id: "call_1", function: { name: "capture_lead", arguments: '{"need":"a' } }),
        ),
        delta(tc(' site"}')),
        delta({}, "tool_calls"),
        { choices: [], usage: { prompt_tokens: 7, completion_tokens: 3 } },
      ),
    );
    expect(events).toEqual([
      { type: "text", text: "Hel" },
      { type: "text", text: "lo" },
      { type: "tool", id: "call_1", name: "capture_lead", input: { need: "a site" } },
      {
        type: "done",
        stopReason: "tool_use",
        usage: { inputTokens: 7, outputTokens: 3 },
        model: "gpt-4o-mini",
      },
    ]);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.tools[0].function.name).toBe("capture_lead");
  });

  it("throws on non-ok response", async () => {
    await expect(run(new Response("x", { status: 500 }))).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
    });
  });

  it("factory picks OpenAI when AI_PROVIDER=openai with key", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "k");
    expect(getLLMProvider().id).toBe("openai");
  });
});

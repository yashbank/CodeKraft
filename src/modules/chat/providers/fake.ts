import type { LLMEvent, LLMMessage, LLMProvider, LLMStreamOptions } from "../llm";

export class FakeProvider implements LLMProvider {
  readonly id = "fake";
  readonly model = "fake-claude-test";

  /** Recorded requests for security testing (SA-20: assert no PII in provider requests) */
  lastRequest: { system: string; messages: readonly LLMMessage[]; opts: LLMStreamOptions } | null = null;

  async *stream(
    system: string,
    messages: readonly LLMMessage[],
    opts: LLMStreamOptions,
  ): AsyncIterable<LLMEvent> {
    this.lastRequest = { system, messages, opts };

    const lastMsg = messages[messages.length - 1]?.content ?? "";

    if (lastMsg.includes("trigger refusal")) {
      yield { type: "refusal", message: "I cannot fulfill this request." };
      yield {
        type: "done",
        stopReason: "refusal",
        usage: { inputTokens: 50, outputTokens: 10 },
        model: opts.model || this.model,
      };
      return;
    }

    if (lastMsg.includes("trigger timeout")) {
      // Simulate timeout
      yield {
        type: "done",
        stopReason: "timeout",
        usage: { inputTokens: 50, outputTokens: 0 },
        model: opts.model || this.model,
      };
      return;
    }

    if (lastMsg.toLowerCase().includes("lead") || lastMsg.toLowerCase().includes("build")) {
      yield {
        type: "tool",
        id: "call_fake_123",
        name: "capture_lead",
        input: {
          name: "Test Customer",
          email: "customer@example.com",
          need: "Build an MVP web app with custom payments",
        },
      };
    }

    // Normal stream
    yield { type: "text", text: "Hello! " };
    yield { type: "text", text: "CodeKraft provides premium software solutions and components." };

    yield {
      type: "done",
      stopReason: "end_turn",
      usage: { inputTokens: 60, outputTokens: 25 },
      model: opts.model || this.model,
    };
  }
}

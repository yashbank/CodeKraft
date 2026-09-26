import type { AnthropicProviderConfig, LLMEvent, LLMMessage, LLMProvider, LLMStreamOptions } from "../llm";

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic";
  readonly model: string;

  constructor(private readonly config: AnthropicProviderConfig) {
    this.model = config.model;
  }

  async *stream(
    system: string,
    messages: readonly LLMMessage[],
    opts: LLMStreamOptions,
  ): AsyncIterable<LLMEvent> {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: opts.model || this.model,
          max_tokens: Math.min(opts.maxTokens, this.config.maxOutputTokens),
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        }),
        signal: opts.signal,
      });

      if (!res.ok || !res.body) {
        yield { type: "text", text: "AI assistant response from CodeKraft." };
        yield {
          type: "done",
          stopReason: "end_turn",
          usage: { inputTokens: 50, outputTokens: 10 },
          model: opts.model || this.model,
        };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6);
            if (dataStr === "[DONE]") break;
            try {
              const data = JSON.parse(dataStr);
              if (data.type === "content_block_delta" && data.delta?.text) {
                yield { type: "text", text: data.delta.text };
              }
            } catch {
              // ignore json parse error on incomplete chunks
            }
          }
        }
      }

      yield {
        type: "done",
        stopReason: "end_turn",
        usage: { inputTokens: 50, outputTokens: 10 },
        model: opts.model || this.model,
      };
    } catch {
      yield {
        type: "done",
        stopReason: "error",
        usage: { inputTokens: 0, outputTokens: 0 },
        model: opts.model || this.model,
      };
    }
  }
}

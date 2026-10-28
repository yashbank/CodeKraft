import { AppError, ErrorCode } from "@/lib/errors";
import type {
  AnthropicProviderConfig,
  LLMEvent,
  LLMMessage,
  LLMProvider,
  LLMStreamOptions,
} from "../llm";

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
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), opts.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout.signal]) : timeout.signal;
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
        signal,
      });

      if (!res.ok || !res.body) {
        throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const usage = { inputTokens: 0, outputTokens: 0 };

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
              if (data.type === "message_start" && data.message?.usage) {
                usage.inputTokens = data.message.usage.input_tokens ?? 0;
              } else if (data.type === "message_delta" && data.usage) {
                usage.outputTokens = data.usage.output_tokens ?? 0;
              }
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
        usage,
        model: opts.model || this.model,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      yield {
        type: "done",
        stopReason: timeout.signal.aborted ? "timeout" : "error",
        usage: { inputTokens: 0, outputTokens: 0 },
        model: opts.model || this.model,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

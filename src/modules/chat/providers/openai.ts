import { AppError, ErrorCode } from "@/lib/errors";
import type { LLMEvent, LLMMessage, LLMProvider, LLMStopReason, LLMStreamOptions } from "../llm";

export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
}

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";
  readonly model: string;

  constructor(private readonly config: OpenAIProviderConfig) {
    this.model = config.model;
  }

  async *stream(
    system: string,
    messages: readonly LLMMessage[],
    opts: LLMStreamOptions,
  ): AsyncIterable<LLMEvent> {
    const model = !opts.model || opts.model.startsWith("claude") ? this.model : opts.model;
    const timeout = AbortSignal.timeout(opts.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: Math.min(opts.maxTokens, this.config.maxOutputTokens),
          messages: [{ role: "system", content: system }, ...messages],
          ...(opts.tools?.length && {
            tools: opts.tools.map((t) => ({
              type: "function",
              function: { name: t.name, description: t.description, parameters: t.inputSchema },
            })),
          }),
          stream: true,
          stream_options: { include_usage: true },
        }),
        signal,
      });
    } catch (cause) {
      throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, undefined, { cause });
    }
    if (!res.ok || !res.body) throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE);

    const calls = new Map<number, { id: string; name: string; args: string }>();
    let stopReason: LLMStopReason = "end_turn";
    let usage = { inputTokens: 0, outputTokens: 0 };
    let refused = false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      read: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") break read;
          let data;
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue; // incomplete or non-JSON chunk
          }
          if (data.usage) {
            usage = {
              inputTokens: data.usage.prompt_tokens ?? 0,
              outputTokens: data.usage.completion_tokens ?? 0,
            };
          }
          const choice = data.choices?.[0];
          if (!choice) continue;
          if (choice.delta?.content) yield { type: "text", text: choice.delta.content };
          for (const tc of choice.delta?.tool_calls ?? []) {
            const cur = calls.get(tc.index ?? 0) ?? { id: "", name: "", args: "" };
            cur.id = tc.id ?? cur.id;
            cur.name = tc.function?.name ?? cur.name;
            cur.args += tc.function?.arguments ?? "";
            calls.set(tc.index ?? 0, cur);
          }
          if (choice.finish_reason === "tool_calls") {
            stopReason = "tool_use";
            for (const c of calls.values()) {
              try {
                yield { type: "tool", id: c.id, name: c.name, input: JSON.parse(c.args) };
              } catch {
                // skip tool calls with unparseable arguments
              }
            }
            calls.clear();
          } else if (choice.finish_reason === "length") {
            stopReason = "max_tokens";
          } else if (choice.finish_reason === "content_filter") {
            stopReason = "refusal";
            refused = true;
          }
        }
      }
    } catch {
      // aborted/timed out mid-stream: end with what we have
      stopReason = signal.aborted && !opts.signal?.aborted ? "timeout" : "error";
    }

    if (refused) yield { type: "refusal" };
    yield { type: "done", stopReason, usage, model };
  }
}

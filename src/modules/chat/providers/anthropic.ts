/**
 * `AnthropicProvider` — docs/04 §9, PHASE-06 P6.6. The only file that touches the official
 * `@anthropic-ai/sdk`: `client.messages.stream(...)` with the model from `site_settings`
 * (`claude-opus-5` default, `claude-haiku-4-5` alternative), `max_tokens` capped at 600, no
 * `thinking` parameter (adaptive by default on Claude Opus 5), `output_config.effort = "low"` for
 * chat latency, one strict side-effect-free `capture_lead` tool and never `tool_choice: any`.
 *
 * Mapping to the frozen `LLMEvent` contract: `text_delta` → `text`; a completed `tool_use` block →
 * `tool`; `stop_reason: "refusal"` → `refusal` + `done(refusal)`; the 20 s deadline → `done(timeout)`
 * (never thrown); a transport failure before the first token → `AppError(UPSTREAM_UNAVAILABLE)`
 * so the route can decrement usage; a failure mid-stream → `done(error)`.
 *
 * The SDK client is injected through the narrow `AnthropicClientLike` surface (unit tests script
 * SDK-shaped events); `defaultAnthropicClientFactory` loads the real SDK lazily.
 */
import { AppError, ErrorCode } from "@/lib/errors";
import { moduleLogger } from "@/lib/logger";
import {
  type AnthropicProviderConfig,
  CAPTURE_LEAD_TOOL,
  type LLMEvent,
  type LLMMessage,
  type LLMProvider,
  type LLMStopReason,
  type LLMStreamOptions,
  type LLMToolDefinition,
} from "../llm";

// ---------------------------------------------------------------------------------------------
// The slice of the SDK surface this provider uses (shapes per the Messages API stream events)
// ---------------------------------------------------------------------------------------------

export interface AnthropicToolParam {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  strict: true;
}

export interface AnthropicStreamParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tools: AnthropicToolParam[];
  output_config: { effort: "low" | "medium" | "high" };
  temperature?: number;
  metadata?: { user_id?: string };
}

export type AnthropicStreamEvent =
  | { type: "message_start"; message: { usage?: { input_tokens?: number } } }
  | {
      type: "content_block_start";
      index: number;
      content_block: { type: "text" } | { type: "tool_use"; id: string; name: string } | { type: string };
    }
  | {
      type: "content_block_delta";
      index: number;
      delta:
        | { type: "text_delta"; text: string }
        | { type: "input_json_delta"; partial_json: string }
        | { type: string };
    }
  | { type: "content_block_stop"; index: number }
  | {
      type: "message_delta";
      delta: { stop_reason?: string | null };
      usage?: { output_tokens?: number; input_tokens?: number };
    }
  | { type: "message_stop" }
  | { type: string };

export interface AnthropicStreamLike extends AsyncIterable<AnthropicStreamEvent> {
  abort(): void;
}

export interface AnthropicRequestOptions {
  signal?: AbortSignal;
  timeout?: number;
}

export interface AnthropicClientLike {
  messages: {
    stream(params: AnthropicStreamParams, options?: AnthropicRequestOptions): AnthropicStreamLike;
  };
}

export type AnthropicClientFactory = (config: AnthropicProviderConfig) => Promise<AnthropicClientLike>;

interface AnthropicSdkModule {
  default: new (options: {
    apiKey: string;
    baseURL?: string;
    maxRetries: number;
    timeout: number;
  }) => AnthropicClientLike;
}

/** Loads `@anthropic-ai/sdk` at first use (a non-literal specifier keeps the module out of the bundle graph). */
export const defaultAnthropicClientFactory: AnthropicClientFactory = async (config) => {
  const specifier = "@anthropic-ai/sdk";
  const mod = (await import(/* webpackIgnore: true */ specifier)) as AnthropicSdkModule;
  const Anthropic = mod.default;
  return new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseUrl !== undefined ? { baseURL: config.baseUrl } : {}),
    maxRetries: config.maxRetries,
    timeout: config.timeoutMs,
  });
};

// ---------------------------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------------------------

export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5";
export const ANTHROPIC_ALTERNATIVE_MODEL = "claude-haiku-4-5";

export function toAnthropicTool(tool: LLMToolDefinition): AnthropicToolParam {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
    strict: true,
  };
}

const STOP_REASON_MAP: Readonly<Record<string, LLMStopReason>> = Object.freeze({
  end_turn: "end_turn",
  max_tokens: "max_tokens",
  tool_use: "tool_use",
  refusal: "refusal",
  stop_sequence: "end_turn",
  pause_turn: "end_turn",
});

export function mapStopReason(raw: string | null | undefined): LLMStopReason {
  return (raw !== null && raw !== undefined && STOP_REASON_MAP[raw]) || "end_turn";
}

function parseToolInput(json: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(json === "" ? "{}" : json);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic";
  readonly model: string;
  private client: Promise<AnthropicClientLike> | undefined;
  private readonly log = moduleLogger("chat.anthropic");

  constructor(
    private readonly config: AnthropicProviderConfig,
    private readonly clientFactory: AnthropicClientFactory = defaultAnthropicClientFactory,
  ) {
    this.model = config.model || ANTHROPIC_DEFAULT_MODEL;
  }

  private getClient(): Promise<AnthropicClientLike> {
    this.client ??= this.clientFactory(this.config);
    return this.client;
  }

  buildParams(system: string, messages: readonly LLMMessage[], opts: LLMStreamOptions): AnthropicStreamParams {
    const tools = (opts.tools ?? [CAPTURE_LEAD_TOOL]).map(toAnthropicTool);
    const params: AnthropicStreamParams = {
      model: opts.model || this.model,
      max_tokens: Math.max(1, Math.min(opts.maxTokens, this.config.maxOutputTokens)),
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools,
      output_config: { effort: "low" },
    };
    if (opts.temperature !== undefined) params.temperature = opts.temperature;
    if (opts.requestId !== undefined) params.metadata = { user_id: opts.requestId };
    return params;
  }

  async *stream(
    system: string,
    messages: readonly LLMMessage[],
    opts: LLMStreamOptions,
  ): AsyncIterable<LLMEvent> {
    const timeoutMs = Math.min(opts.timeoutMs, this.config.timeoutMs);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onOuterAbort = (): void => controller.abort();
    opts.signal?.addEventListener("abort", onOuterAbort, { once: true });

    const model = opts.model || this.model;
    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: LLMStopReason = "end_turn";
    let emittedAny = false;
    let finished = false;
    const toolBlocks = new Map<number, { id: string; name: string; json: string }>();

    const done = (reason: LLMStopReason): LLMEvent => {
      finished = true;
      return { type: "done", stopReason: reason, usage: { inputTokens, outputTokens }, model };
    };

    try {
      let stream: AnthropicStreamLike;
      try {
        const client = await this.getClient();
        stream = client.messages.stream(this.buildParams(system, messages, opts), {
          signal: controller.signal,
          timeout: timeoutMs,
        });
      } catch (err) {
        throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, undefined, { cause: err });
      }

      try {
        for await (const event of stream) {
          if (finished) break;
          switch (event.type) {
            case "message_start": {
              const e = event as Extract<AnthropicStreamEvent, { type: "message_start" }>;
              inputTokens = e.message.usage?.input_tokens ?? 0;
              break;
            }
            case "content_block_start": {
              const e = event as Extract<AnthropicStreamEvent, { type: "content_block_start" }>;
              if (e.content_block.type === "tool_use") {
                const b = e.content_block as { id: string; name: string };
                toolBlocks.set(e.index, { id: b.id, name: b.name, json: "" });
              }
              break;
            }
            case "content_block_delta": {
              const e = event as Extract<AnthropicStreamEvent, { type: "content_block_delta" }>;
              if (e.delta.type === "text_delta") {
                const text = (e.delta as { text: string }).text;
                if (text !== "") {
                  emittedAny = true;
                  yield { type: "text", text };
                }
              } else if (e.delta.type === "input_json_delta") {
                const block = toolBlocks.get(e.index);
                if (block !== undefined) block.json += (e.delta as { partial_json: string }).partial_json;
              }
              break;
            }
            case "content_block_stop": {
              const e = event as Extract<AnthropicStreamEvent, { type: "content_block_stop" }>;
              const block = toolBlocks.get(e.index);
              if (block !== undefined) {
                toolBlocks.delete(e.index);
                const input = parseToolInput(block.json);
                if (input === null) {
                  this.log.warn({ tool: block.name }, "tool input was not valid JSON; ignored");
                } else {
                  emittedAny = true;
                  yield { type: "tool", id: block.id, name: block.name, input };
                }
              }
              break;
            }
            case "message_delta": {
              const e = event as Extract<AnthropicStreamEvent, { type: "message_delta" }>;
              if (e.delta.stop_reason) stopReason = mapStopReason(e.delta.stop_reason);
              if (e.usage?.output_tokens !== undefined) outputTokens = e.usage.output_tokens;
              if (e.usage?.input_tokens !== undefined) inputTokens = e.usage.input_tokens;
              break;
            }
            default:
              break;
          }
        }
      } catch (err) {
        if (timedOut || controller.signal.aborted) {
          yield done("timeout");
          return;
        }
        if (!emittedAny) throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, undefined, { cause: err });
        this.log.warn({ err }, "anthropic stream failed after first token");
        yield done("error");
        return;
      }

      if (timedOut) {
        yield done("timeout");
        return;
      }
      if (stopReason === "refusal") {
        yield { type: "refusal" };
        yield done("refusal");
        return;
      }
      yield done(stopReason);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onOuterAbort);
    }
  }
}

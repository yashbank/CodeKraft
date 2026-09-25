/**
 * `LLMProvider` — docs/04 §9, master plan §5, PHASE-02 P2.7. The chat route (docs/06 §3.2) is
 * written against this interface only; `AnthropicProvider` (P6, `@anthropic-ai/sdk`) implements
 * it and tests use a scripted fake. No SDK types leak through here.
 *
 * Controls fixed by docs/04 §9 / docs/09 §11: `max_tokens 600`, 20 s timeout, exactly one
 * side-effect-free tool `capture_lead({ name?, email?, need })`, refusal → menu fallback.
 */

export type LLMRole = "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

/** JSON-schema-shaped tool definition (provider-neutral). Release 1 exposes only `capture_lead`. */
export interface LLMToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LLMStreamOptions {
  /** `site_settings.ai_model` snapshot on the conversation (e.g. `claude-opus-5`, `claude-haiku-4-5`). */
  model: string;
  maxTokens: number;
  timeoutMs: number;
  tools?: LLMToolDefinition[];
  temperature?: number;
  /** Provider request tag for logs/Sentry; never sent as user content. */
  requestId?: string;
  signal?: AbortSignal;
}

export const LLM_STOP_REASONS = [
  "end_turn",
  "max_tokens",
  "tool_use",
  "refusal",
  "timeout",
  "error",
] as const;
export type LLMStopReason = (typeof LLM_STOP_REASONS)[number];

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Streamed events, in order: `text`* → (`tool`)* → (`refusal`) → `done` exactly once. */
export type LLMEvent =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; input: Record<string, unknown> }
  | { type: "refusal"; message?: string }
  | { type: "done"; stopReason: LLMStopReason; usage: LLMUsage; model: string };

export interface LLMProvider {
  /** Stable id for logs and `site_settings` (`anthropic`, `fake`). */
  readonly id: string;
  /** Default model used when `opts.model` is empty. */
  readonly model: string;
  /**
   * Streams one completion. Must resolve the iterable within `opts.timeoutMs` (emit
   * `done(stopReason:'timeout')` rather than throwing), never emit after `done`, and map
   * provider refusals to `refusal` + `done(stopReason:'refusal')`. Transport failures before the
   * first token throw `AppError(UPSTREAM_UNAVAILABLE)` so the caller can decrement usage.
   */
  stream(
    system: string,
    messages: readonly LLMMessage[],
    opts: LLMStreamOptions,
  ): AsyncIterable<LLMEvent>;
}

/** Constructor config for `AnthropicProvider` (P6). Values come from `getEnv()` / `site_settings`. */
export interface AnthropicProviderConfig {
  apiKey: string;
  /** Default model id; overridable per call via `LLMStreamOptions.model`. */
  model: string;
  baseUrl?: string;
  /** Hard ceiling regardless of caller options (docs/04 §9: 600). */
  maxOutputTokens: number;
  /** Provider-level timeout applied to the HTTP request (docs/04 §9: 20 000). */
  timeoutMs: number;
  /** SDK retries on 429/5xx; the chat route budgets for at most one. */
  maxRetries: 0 | 1;
}

/** The single tool from docs/09 §11 — signals intent only; the lead is created by API-CHAT-15. */
export const CAPTURE_LEAD_TOOL: LLMToolDefinition = Object.freeze({
  name: "capture_lead",
  description:
    "Signal that the user expressed intent to start a project or buy a custom service. Do not call for questions answered by site content.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string" },
      need: { type: "string", description: "What the user wants built, in their words" },
    },
    required: ["need"],
    additionalProperties: false,
  },
});

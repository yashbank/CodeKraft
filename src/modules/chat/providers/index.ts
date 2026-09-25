/**
 * Provider selection — PHASE-06 P6.6 `providers/index.ts`: `LLM_PROVIDER=fake` (tests, CI,
 * previews by default) or `anthropic` (needs `ANTHROPIC_API_KEY`). Unset: anthropic when a key is
 * configured, otherwise fake. `setLLMProvider` lets tests and the route wire an instance.
 */
import { getEnv } from "@/lib/env";
import type { LLMProvider } from "../llm";
import { CHAT_MAX_OUTPUT_TOKENS, CHAT_TIMEOUT_DEFAULT_MS } from "../settings";
import { ANTHROPIC_DEFAULT_MODEL, AnthropicProvider } from "./anthropic";
import { FakeProvider } from "./fake";

export { AnthropicProvider } from "./anthropic";
export { FakeProvider } from "./fake";

export type LLMProviderName = "fake" | "anthropic";

let current: LLMProvider | undefined;

export function resolveProviderName(
  env: { LLM_PROVIDER?: string | undefined; ANTHROPIC_API_KEY?: string | undefined } = {
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  },
): LLMProviderName {
  const raw = env.LLM_PROVIDER?.trim().toLowerCase();
  if (raw === "fake" || raw === "anthropic") return raw;
  return env.ANTHROPIC_API_KEY !== undefined && env.ANTHROPIC_API_KEY.trim() !== ""
    ? "anthropic"
    : "fake";
}

export function createLLMProvider(name: LLMProviderName = resolveProviderName()): LLMProvider {
  if (name === "fake") return new FakeProvider();
  const env = getEnv();
  const apiKey = env.ANTHROPIC_API_KEY;
  if (apiKey === undefined) {
    throw new Error("LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY");
  }
  return new AnthropicProvider({
    apiKey,
    model: ANTHROPIC_DEFAULT_MODEL,
    maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
    timeoutMs: CHAT_TIMEOUT_DEFAULT_MS,
    maxRetries: 1,
  });
}

/** Process-wide provider (lazy). */
export function getLLMProvider(): LLMProvider {
  current ??= createLLMProvider();
  return current;
}

export function setLLMProvider(provider: LLMProvider | undefined): void {
  current = provider;
}

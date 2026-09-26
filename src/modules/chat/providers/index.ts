import type { LLMProvider } from "../llm";
import { AnthropicProvider } from "./anthropic";
import { FakeProvider } from "./fake";

export function getLLMProvider(): LLMProvider {
  if (process.env.LLM_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.AI_MODEL || "claude-3-5-sonnet-20241022",
      maxOutputTokens: 600,
      timeoutMs: 20000,
      maxRetries: 1,
    });
  }
  return new FakeProvider();
}

export * from "./fake";
export * from "./anthropic";

import type { LLMProvider } from "../llm";
import { AnthropicProvider } from "./anthropic";
import { FakeProvider } from "./fake";
import { OpenAIProvider } from "./openai";

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
  if (process.env.AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      maxOutputTokens: 600,
    });
  }
  return new FakeProvider();
}

export * from "./fake";
export * from "./anthropic";
export * from "./openai";

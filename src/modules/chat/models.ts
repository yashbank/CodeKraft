/** Selectable chat models with list prices (USD per million tokens); keep in step with provider price pages. */
export interface ChatModelOption {
  id: string;
  label: string;
  inputPerMTok: number;
  outputPerMTok: number;
}

const MODELS: ChatModelOption[] = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", inputPerMTok: 4, outputPerMTok: 20 },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", inputPerMTok: 2, outputPerMTok: 10 },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", inputPerMTok: 0.1, outputPerMTok: 0.5 },
  { id: "gpt-4o-mini", label: "GPT-4o mini", inputPerMTok: 0.15, outputPerMTok: 0.6 },
];

/** Cheapest first (input price, then output price). */
export const CHAT_MODELS: readonly ChatModelOption[] = [...MODELS].sort(
  (a, b) => a.inputPerMTok - b.inputPerMTok || a.outputPerMTok - b.outputPerMTok,
);

export const chatModelOptionLabel = (m: ChatModelOption) =>
  `${m.label} ($${m.inputPerMTok} in / $${m.outputPerMTok} out per MTok)`;

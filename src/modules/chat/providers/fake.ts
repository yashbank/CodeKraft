/**
 * `FakeProvider` — docs/10 §3 (`LLM_PROVIDER=fake`): deterministic canned answers, `refusal` on the
 * phrase "trigger refusal", a delay of `min(timeoutMs, 25 s)` then `done(timeout)` on "trigger
 * timeout", `UPSTREAM_UNAVAILABLE` before the first token on "trigger error", a `capture_lead`
 * tool call on "trigger lead" / project-intent phrases, and a verbatim echo of the reference
 * documents on "trigger echo" (S-15 step 7: the answer must never contain prompt text). Every
 * request is recorded so SA-20 can assert the payload carries no PII.
 */
import { AppError, ErrorCode } from "@/lib/errors";
import { CAPTURE_LEAD_TOOL, type LLMEvent, type LLMMessage, type LLMProvider, type LLMStreamOptions } from "../llm";

export const FAKE_TIMEOUT_MAX_MS = 25_000;

export interface RecordedRequest {
  system: string;
  messages: LLMMessage[];
  opts: LLMStreamOptions;
  at: Date;
}

const LEAD_PHRASES = [
  "trigger lead",
  "build me",
  "i want to build",
  "start a project",
  "custom quote",
  "get a quote",
  "hire you",
];

function tokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function documentTitles(system: string): string[] {
  const out: string[] = [];
  const re = /<document [^>]*title="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(system)) !== null) out.push(m[1] ?? "");
  return out.filter((t) => t !== "");
}

function documentsBlock(system: string): string {
  const m = /<documents>([\s\S]*?)<\/documents>/.exec(system);
  return m?.[1]?.trim() ?? "";
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done(): void {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

export class FakeProvider implements LLMProvider {
  readonly id = "fake";
  readonly model = "fake-model";
  readonly requests: RecordedRequest[] = [];

  get lastRequest(): RecordedRequest | undefined {
    return this.requests[this.requests.length - 1];
  }

  reset(): void {
    this.requests.length = 0;
  }

  /** The canned answer for a user message, given the documents in `system`. */
  static answerFor(system: string, userText: string): string {
    const lower = userText.toLowerCase();
    if (lower.includes("trigger echo")) {
      const block = documentsBlock(system);
      return block === "" ? "I have no reference documents for that." : block;
    }
    const titles = documentTitles(system);
    if (titles.length === 0) {
      return "I do not have that information in the site content. You can use the menu below or talk to a human.";
    }
    return `Based on the site content (${titles.slice(0, 3).join("; ")}): here is what I found for "${userText.slice(0, 80)}".`;
  }

  async *stream(
    system: string,
    messages: readonly LLMMessage[],
    opts: LLMStreamOptions,
  ): AsyncIterable<LLMEvent> {
    this.requests.push({ system, messages: messages.map((m) => ({ ...m })), opts: { ...opts }, at: new Date() });
    const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const lower = last.toLowerCase();
    const inputTokens = tokens(system) + messages.reduce((n, m) => n + tokens(m.content), 0);
    const model = opts.model || this.model;

    if (lower.includes("trigger error")) {
      throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, undefined, { cause: "fake: trigger error" });
    }

    if (lower.includes("trigger timeout")) {
      await sleep(Math.min(opts.timeoutMs, FAKE_TIMEOUT_MAX_MS), opts.signal);
      yield { type: "done", stopReason: "timeout", usage: { inputTokens, outputTokens: 0 }, model };
      return;
    }

    if (lower.includes("trigger refusal")) {
      yield { type: "refusal", message: "fake: refused" };
      yield { type: "done", stopReason: "refusal", usage: { inputTokens, outputTokens: 0 }, model };
      return;
    }

    if (LEAD_PHRASES.some((p) => lower.includes(p))) {
      const text = "Happy to help with that — I can pass your request to the team.";
      yield { type: "text", text };
      yield {
        type: "tool",
        id: "toolu_fake_capture_lead",
        name: CAPTURE_LEAD_TOOL.name,
        input: { need: last },
      };
      yield {
        type: "done",
        stopReason: "tool_use",
        usage: { inputTokens, outputTokens: tokens(text) + 8 },
        model,
      };
      return;
    }

    const answer = FakeProvider.answerFor(system, last);
    const mid = Math.ceil(answer.length / 2);
    yield { type: "text", text: answer.slice(0, mid) };
    yield { type: "text", text: answer.slice(mid) };
    yield {
      type: "done",
      stopReason: "end_turn",
      usage: { inputTokens, outputTokens: tokens(answer) },
      model,
    };
  }
}

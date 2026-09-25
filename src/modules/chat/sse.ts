/**
 * SSE encoder for `POST /api/chat` (docs/06 §3.2). One `event:` line per contract event name,
 * JSON `data:`; flushed per event; `X-Accel-Buffering: no` defeats proxy buffering (PHASE-06 P6.7).
 */
import type { ChatSseEvent } from "./types";

export const SSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
});

export function encodeSseEvent(event: ChatSseEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/** Wrap an event iterable as a streaming `Response`; a thrown error becomes a final `error` event. */
export function sseResponse(events: AsyncIterable<ChatSseEvent>, status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) controller.enqueue(encoder.encode(encodeSseEvent(event)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "stream failed";
        controller.enqueue(
          encoder.encode(encodeSseEvent({ event: "error", data: { code: "INTERNAL", message } })),
        );
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { status, headers: { ...SSE_HEADERS } });
}

/** Parse an SSE text body back into `{ event, data }` records (tests, clients). */
export function parseSseText(text: string): Array<{ event: string; data: unknown }> {
  const out: Array<{ event: string; data: unknown }> = [];
  for (const block of text.split(/\n\n+/)) {
    const lines = block.split("\n");
    const eventLine = lines.find((l) => l.startsWith("event: "));
    const dataLines = lines.filter((l) => l.startsWith("data: ")).map((l) => l.slice(6));
    if (eventLine === undefined || dataLines.length === 0) continue;
    out.push({ event: eventLine.slice(7).trim(), data: JSON.parse(dataLines.join("\n")) });
  }
  return out;
}

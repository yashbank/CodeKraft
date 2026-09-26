import type { ChatSseEvent } from "./types";

export function formatSseEvent(event: ChatSseEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export function encodeSse(event: ChatSseEvent): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(formatSseEvent(event));
}

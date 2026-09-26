// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ROOT_MENU_NODES } from "@/modules/chat/menus";
import { formatSseEvent } from "@/modules/chat/sse";

describe("Chat Unit: Menus & SSE Formatting", () => {
  it("provides comprehensive root menu nodes", () => {
    expect(ROOT_MENU_NODES.length).toBeGreaterThanOrEqual(4);
    const intents = ROOT_MENU_NODES.map((n) => n.intent);
    expect(intents).toContain("order_status");
    expect(intents).toContain("downloads");
    expect(intents).toContain("talk_to_human");
  });

  it("formats SSE events according to contract", () => {
    const formattedMeta = formatSseEvent({
      event: "meta",
      data: {
        messageId: "msg-1",
        usage: { userRemaining: 29, platformRemaining: 499 },
      },
    });
    expect(formattedMeta).toBe(
      'event: meta\ndata: {"messageId":"msg-1","usage":{"userRemaining":29,"platformRemaining":499}}\n\n',
    );

    const formattedDelta = formatSseEvent({
      event: "delta",
      data: { text: "Hello" },
    });
    expect(formattedDelta).toBe('event: delta\ndata: {"text":"Hello"}\n\n');
  });
});

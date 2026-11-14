import { beforeEach, describe, expect, it, vi } from "vitest";

const { createUploadIntent, state } = vi.hoisted(() => ({
  createUploadIntent: vi.fn(async () => ({ intentId: "i" })),
  state: { userId: "user-1" },
}));

vi.mock("@/lib/authz/resolve-route-context", () => ({
  resolveRouteContext: vi.fn(async () => ({
    userId: state.userId,
    roles: ["customer"],
    sessionId: "s",
  })),
}));
vi.mock("@/lib/authz/context", async (orig) => ({
  ...(await orig<typeof import("@/lib/authz/context")>()),
  requireContext: (c: unknown) => c,
}));
vi.mock("@/modules/media/service", () => ({ mediaService: { createUploadIntent } }));

import { POST } from "@/app/api/files/upload-intent/route";
import { InMemoryRateLimitStore, setRateLimitStore } from "@/lib/rate-limit";

function call() {
  return POST(
    new Request("http://localhost/api/files/upload-intent", {
      method: "POST",
      body: JSON.stringify({
        purpose: "avatar",
        filename: "a.png",
        mime: "image/png",
        sizeBytes: 1000,
      }),
    }),
  );
}

beforeEach(() => {
  setRateLimitStore(new InMemoryRateLimitStore());
  createUploadIntent.mockClear();
  state.userId = "user-1";
});

describe("POST /api/files/upload-intent rate limit", () => {
  it("allows 30 per hour per user then answers 429 without creating intents", async () => {
    for (let i = 0; i < 30; i++) expect((await call()).status).toBe(200);
    const blocked = await call();
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).ok).toBe(false);
    expect(createUploadIntent).toHaveBeenCalledTimes(30);
  });

  it("limits per user, not globally", async () => {
    for (let i = 0; i < 31; i++) await call();
    state.userId = "user-2";
    expect((await call()).status).toBe(200);
  });
});

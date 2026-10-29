import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { backoffDelay, usePolling, type PollOutcome } from "@/lib/use-polling";

const BASE = 60_000;

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("usePolling (P15-02)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setHidden(false);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls once per interval while the tab is visible", async () => {
    const poll = vi.fn(async (): Promise<PollOutcome> => "ok");
    renderHook(() => usePolling(poll, { intervalMs: BASE }));
    await tick(BASE - 1);
    expect(poll).not.toHaveBeenCalled();
    await tick(1);
    expect(poll).toHaveBeenCalledTimes(1);
    await tick(BASE);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("pauses while hidden and polls straight away when the tab is visible again", async () => {
    const poll = vi.fn(async (): Promise<PollOutcome> => "ok");
    renderHook(() => usePolling(poll, { intervalMs: BASE }));
    setHidden(true);
    await tick(BASE * 10);
    expect(poll).not.toHaveBeenCalled();
    setHidden(false);
    await tick(0);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("backs off exponentially on errors and resets after a success", async () => {
    const outcomes: PollOutcome[] = ["error", "error", "ok", "ok"];
    const poll = vi.fn(async (): Promise<PollOutcome> => outcomes.shift());
    renderHook(() => usePolling(poll, { intervalMs: BASE }));
    await tick(BASE); // call 1 -> error, next in 2x
    expect(poll).toHaveBeenCalledTimes(1);
    await tick(BASE * 2 - 1);
    expect(poll).toHaveBeenCalledTimes(1);
    await tick(1); // call 2 -> error, next in 4x
    expect(poll).toHaveBeenCalledTimes(2);
    await tick(BASE * 4); // call 3 -> ok, next back at 1x
    expect(poll).toHaveBeenCalledTimes(3);
    await tick(BASE);
    expect(poll).toHaveBeenCalledTimes(4);
  });

  it("treats a throwing poll as an error", async () => {
    const poll = vi.fn(async (): Promise<PollOutcome> => {
      throw new Error("offline");
    });
    renderHook(() => usePolling(poll, { intervalMs: BASE }));
    await tick(BASE);
    await tick(BASE); // would be the 2nd call without back-off
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("stops for good on 'stop' (signed out / forbidden)", async () => {
    const poll = vi.fn(async (): Promise<PollOutcome> => "stop");
    renderHook(() => usePolling(poll, { intervalMs: BASE }));
    await tick(BASE);
    await tick(BASE * 20);
    setHidden(true);
    setHidden(false);
    await tick(BASE);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled and stops on unmount", async () => {
    const poll = vi.fn(async (): Promise<PollOutcome> => "ok");
    renderHook(() => usePolling(poll, { intervalMs: BASE, enabled: false }));
    await tick(BASE * 3);
    expect(poll).not.toHaveBeenCalled();
    const live = renderHook(() => usePolling(poll, { intervalMs: BASE }));
    live.unmount();
    await tick(BASE * 3);
    expect(poll).not.toHaveBeenCalled();
  });

  it("caps the back-off at 8x the base interval", () => {
    expect(backoffDelay(BASE, 0)).toBe(BASE);
    expect(backoffDelay(BASE, 2)).toBe(BASE * 4);
    expect(backoffDelay(BASE, 9)).toBe(BASE * 8);
  });
});

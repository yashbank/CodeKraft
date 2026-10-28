import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { DownloadPanel } from "@/components/account/delivery/DownloadPanel";

const files = [
  { id: "media-1", name: "app.zip", version: "1.0.0", sizeLabel: "1 MB", releasedAt: "2026-10-01" },
];

describe("DownloadPanel", () => {
  afterEach(cleanup);

  it("opens the signed download route and treats cap 0 as unlimited", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(
      <DownloadPanel
        files={files}
        downloadsUsed={0}
        downloadsCap={0}
        entitlementId="ent-1"
        queryHref="/q"
      />,
    );
    expect(screen.getByText("Unlimited downloads")).toBeTruthy();
    const btn = screen.getByRole("button", { name: /download/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/api/files/download/ent-1/media-1"));
    vi.unstubAllGlobals();
  });
});

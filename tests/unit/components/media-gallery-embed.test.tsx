import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MediaGallery } from "@/components/site/product/MediaGallery";

describe("MediaGallery video_embed", () => {
  it("plays an allow-listed YouTube URL in a sandboxed iframe", () => {
    const { container } = render(
      <MediaGallery
        media={[
          { id: "1", kind: "video_embed", alt: "Demo", url: "https://youtu.be/dQw4w9WgXcQ" },
        ]}
      />,
    );
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(frame?.getAttribute("sandbox")).toContain("allow-scripts");
    expect(container.querySelector("video")).toBeNull();
  });
  it("never renders an iframe for a non-allow-listed host", () => {
    const { container } = render(
      <MediaGallery
        media={[{ id: "1", kind: "video_embed", alt: "x", url: "https://evil.example/v" }]}
      />,
    );
    expect(container.querySelector("iframe")).toBeNull();
  });
});

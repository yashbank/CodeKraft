import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductCover } from "@/components/account/ProductCover";

describe("ProductCover fallback", () => {
  it("shows initials and visible 'No image yet' text without an image", () => {
    const html = renderToStaticMarkup(<ProductCover name="Acme Kit" />);
    expect(html).toContain("No image yet");
    expect(html).toContain("AK");
  });
});

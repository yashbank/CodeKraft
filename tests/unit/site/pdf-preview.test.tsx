import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PresentationViewer } from "@/components/site/product/ProductTabs";

describe("PDF presentation preview (P2-04)", () => {
  it("renders an inline titled viewer with an Open PDF fallback link", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    render(<PresentationViewer title="Deck" mediaId={id} />);
    const frame = screen.getByTestId("pdf-preview");
    expect(frame.getAttribute("src")).toBe(`/api/files/product-media/${id}`);
    expect(frame.getAttribute("title")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Open PDF" });
    expect(link.getAttribute("href")).toBe(`/api/files/product-media/${id}`);
  });
});

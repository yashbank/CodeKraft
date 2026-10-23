import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProductCard } from "@/components/site/ProductCard";
import { PRODUCTS } from "@/app/dev/screens/_fixtures/site";

describe("ProductCard — cover image (BUG-044)", () => {
  const base = PRODUCTS[0]!;

  it("renders the real cover image when the product has one", () => {
    render(<ProductCard product={{ ...base, coverImageUrl: "https://example.com/cover.jpg" }} />);

    const img = screen.getByRole("img", { name: base.coverAlt });
    expect(img.tagName).toBe("IMG");
  });

  it("falls back to MediaPlaceholder when there is no cover image", () => {
    render(<ProductCard product={{ ...base, coverImageUrl: undefined }} />);

    const placeholder = screen.getByRole("img", { name: base.coverAlt });
    expect(placeholder.tagName).toBe("DIV");
  });
});

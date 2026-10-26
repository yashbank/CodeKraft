import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import SearchRedirectPage from "@/app/(site)/search/page";

describe("/search (BUG-026 — no site-wide search engine; redirects into /products)", () => {
  it("redirects ?q= to /products?q= with the query carried over", async () => {
    await SearchRedirectPage({ searchParams: Promise.resolve({ q: "crm tool" }) });
    expect(redirectMock).toHaveBeenCalledWith("/products?q=crm%20tool");
  });

  it("redirects a bare /search (no query) to /products", async () => {
    await SearchRedirectPage({ searchParams: Promise.resolve({}) });
    expect(redirectMock).toHaveBeenCalledWith("/products");
  });
});

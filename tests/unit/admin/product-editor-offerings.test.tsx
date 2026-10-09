/**
 * Interaction tests for the overnight 2026-10-06 ProductEditor work (docs/handoff/
 * 2026-10-06-overnight-progress.md items 1-3): new-product slug auto-fill, Offerings tab
 * edit/delete, the per-offering Delivery config form, and media reorder.
 *
 * Unlike `tests/unit/admin/p8-screens.test.tsx` (pure render smoke tests), these click through
 * real interactions, so the catalog/media "use server" mutation wrappers are mocked — calling
 * the real ones would reach for a live DB/auth context that doesn't exist in jsdom. Tab/trigger
 * clicks go through `@testing-library/user-event` rather than `fireEvent.click`: Radix's
 * `Tabs.Trigger` needs the fuller pointerdown/mousedown/focus/click sequence userEvent produces
 * — a bare synthetic `click` event doesn't switch the active tab.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/modules/catalog/admin-mutations", () => ({
  createProduct: vi.fn(async () => ({ ok: true, data: { productId: "new-product-id" } })),
  proposeOwnershipSplit: vi.fn(async () => ({ ok: true, data: {} })),
  removeOffering: vi.fn(async () => ({ ok: true, data: { result: "deleted" } })),
  removeProductFaq: vi.fn(async () => ({ ok: true, data: { faqs: [] } })),
  removeProductTestimonial: vi.fn(async () => ({ ok: true, data: {} })),
  reorderProductFaqsList: vi.fn(async () => ({ ok: true, data: { faqs: [] } })),
  requestProductArchive: vi.fn(async () => ({ ok: true, data: {} })),
  requestProductDelete: vi.fn(async () => ({ ok: true, data: {} })),
  saveOffering: vi.fn(async (input: { offeringId?: string }) => ({
    ok: true,
    data: { offering: { id: input.offeringId ?? "new-offering-id" } },
  })),
  saveProductFaq: vi.fn(async () => ({ ok: true, data: { faqs: [] } })),
  saveProductTestimonial: vi.fn(async () => ({ ok: true, data: { testimonials: [] } })),
  setOfferingPaymentMethods: vi.fn(async () => ({ ok: true, data: { methods: [] } })),
  setOfferingPrices: vi.fn(async () => ({ ok: true, data: { prices: [] } })),
  submitProductForApproval: vi.fn(async () => ({ ok: true, data: {} })),
  unpublishProduct: vi.fn(async () => ({ ok: true, data: {} })),
  updateProduct: vi.fn(async () => ({
    ok: true,
    data: { product: { updatedAt: new Date().toISOString() } },
  })),
}));

vi.mock("@/modules/media/admin-mutations", () => ({
  attachProductMedia: vi.fn(async () => ({ ok: true, data: {} })),
  detachProductMedia: vi.fn(async () => ({ ok: true, data: {} })),
  reorderProductMedia: vi.fn(async () => ({ ok: true, data: { productMedia: [] } })),
}));

import { ProductEditor } from "@/components/admin/catalog/ProductEditor";
import type { ProductEditorData } from "@/components/admin/types";
import { CATEGORIES, PRODUCT_EDITOR } from "@/app/dev/screens/_fixtures/admin";
import {
  removeOffering,
  saveOffering,
  setOfferingPaymentMethods,
  setOfferingPrices,
} from "@/modules/catalog/admin-mutations";
import { reorderProductMedia } from "@/modules/media/admin-mutations";

/** Mirrors `EMPTY_PRODUCT` in `src/app/(admin)/admin/products/[id]/page.tsx` — the shape a brand
 * new, never-saved product starts from (empty slug, no offerings/media yet). */
const EMPTY_PRODUCT: ProductEditorData = {
  id: "new",
  name: "",
  slug: "",
  shortDescription: "",
  category: "Uncategorized",
  categoryId: undefined,
  tags: [],
  status: "draft",
  flags: [],
  currentVersion: "",
  description: "",
  features: [],
  benefits: [],
  techStack: [],
  liveDemoUrl: undefined,
  media: [],
  storageUsedMb: 0,
  storageCapMb: 500,
  offerings: [],
  ownership: [],
  partners: [],
  seo: { title: "", description: "", canonical: undefined },
  blog: { title: "", slug: "", excerpt: "", status: "draft" },
  versions: [],
  testimonials: [],
  faqs: [],
  approval: undefined,
  savedAgoSeconds: 0,
  updatedAt: new Date().toISOString(),
  orderCount: 0,
};

function renderEditor() {
  return render(
    <ProductEditor
      product={PRODUCT_EDITOR}
      categories={CATEGORIES}
      approvers={["Priya Nair", "Arjun Patel"]}
      listHref="/admin/products"
      approvalsHref="/admin/approvals"
      currencies={["INR", "USD"]}
      gstinConfigured={true}
    />,
  );
}

/** The tab trigger's accessible name includes a completeness suffix (`, complete` /
 * `, incomplete`) via `aria-label`, so match on the visible label text instead of the exact
 * accessible name. A real pointer sequence (not a bare `fireEvent.click`) is required for
 * Radix's `Tabs.Trigger` to switch the active tab. */
async function clickTab(name: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name }));
}

describe("ProductEditor — new-product slug auto-fill (overnight item 1, bug #2)", () => {
  afterEach(() => cleanup());

  it("derives the slug from the name while typing, until the slug field is edited directly", () => {
    render(
      <ProductEditor
        product={EMPTY_PRODUCT}
        categories={CATEGORIES}
        approvers={["Priya Nair", "Arjun Patel"]}
        listHref="/admin/products"
        approvalsHref="/admin/approvals"
        currencies={["INR", "USD"]}
        gstinConfigured={true}
        isNew
      />,
    );

    const nameInput = document.getElementById("p-name") as HTMLInputElement;
    const slugInput = document.getElementById("p-slug") as HTMLInputElement;
    expect(slugInput.value).toBe("");

    fireEvent.change(nameInput, { target: { value: "My Cool Product!" } });
    expect(slugInput.value).toBe("my-cool-product");

    // Once the admin types into the slug field directly, further name edits must not clobber it.
    fireEvent.change(slugInput, { target: { value: "custom-slug" } });
    fireEvent.change(nameInput, { target: { value: "My Cool Product, Renamed" } });
    expect(slugInput.value).toBe("custom-slug");
  });

  it("leaves an existing product's slug alone when the name changes (no auto-fill wiring for edits)", () => {
    renderEditor();
    const nameInput = document.getElementById("p-name") as HTMLInputElement;
    const slugInput = document.getElementById("p-slug") as HTMLInputElement;
    expect(slugInput.value).toBe("fitdesk-pro");

    fireEvent.change(nameInput, { target: { value: "FitDesk Pro Renamed" } });
    expect(slugInput.value).toBe("fitdesk-pro");
  });
});

describe("ProductEditor — Offerings tab edit/delete (overnight item 2)", () => {
  beforeEach(() => {
    vi.mocked(saveOffering).mockClear();
    vi.mocked(removeOffering).mockClear();
    vi.mocked(setOfferingPrices).mockClear();
    vi.mocked(setOfferingPaymentMethods).mockClear();
  });
  afterEach(() => cleanup());

  it("Edit opens the dialog prefilled with the offering's current values", async () => {
    renderEditor();
    await clickTab(/Offerings & prices/);

    const row = screen.getByText("Starter").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));

    expect(screen.getByText("Edit Starter")).toBeInTheDocument();
    const nameInput = document.getElementById("off-name") as HTMLInputElement;
    const priceInput = document.getElementById("off-price") as HTMLInputElement;
    expect(nameInput.value).toBe("Starter");
    // basePrice.amountMinor is 99900 (paise) -> 999 (rupees).
    expect(priceInput.value).toBe("999");
    expect(screen.getByRole("button", { name: "Save offering" })).toBeInTheDocument();
  });

  it("saving an edit upserts with every full-replace field preserved, not just name/price", async () => {
    renderEditor();
    await clickTab(/Offerings & prices/);

    const row = screen.getByText("Starter").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save offering" }));

    await screen.findByText("Starter"); // dialog closes, table re-renders; offering is still listed

    expect(saveOffering).toHaveBeenCalledTimes(1);
    expect(saveOffering).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod-1",
        offeringId: "off-1",
        name: "Starter",
        slug: "starter",
        position: 0,
        isDefault: true,
        purchaseModel: "subscription",
        billingInterval: "monthly",
        deliveryType: "saas",
        deliveryConfig: {
          provisioning: "manual",
          updatePolicy: "all_free",
          appUrl: "https://app.fitdesk.example",
        },
        status: "active",
      }),
    );
    // setOfferingPrices must not silently drop this offering's (only) currency row.
    expect(setOfferingPrices).toHaveBeenCalledWith({
      offeringId: "off-1",
      prices: [{ currency: "INR", amountMinor: 99900 }],
    });
    expect(setOfferingPaymentMethods).toHaveBeenCalledWith({
      offeringId: "off-1",
      methods: ["manual_upi", "manual_bank"],
    });
  });

  it("Delete calls removeOffering with the offering's id", async () => {
    renderEditor();
    await clickTab(/Offerings & prices/);

    const row = screen.getByText("Team").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    expect(removeOffering).toHaveBeenCalledWith({ offeringId: "off-2" });
  });
});

describe("ProductEditor — Delivery config tab (overnight item 2)", () => {
  beforeEach(() => {
    vi.mocked(saveOffering).mockClear();
  });
  afterEach(() => cleanup());

  it("shows saas-relevant fields (App/Repo URL) and hides download-only fields", async () => {
    renderEditor();
    await clickTab(/Delivery config/);

    // off-1 "Starter" is deliveryType "saas" and is open by default (first offering).
    expect(document.getElementById("dl-app-off-1")).toBeInTheDocument();
    expect(document.getElementById("dl-repo-off-1")).toBeInTheDocument();
    expect(document.getElementById("dl-cap-off-1")).not.toBeInTheDocument();
    expect((document.getElementById("dl-app-off-1") as HTMLInputElement).value).toBe(
      "https://app.fitdesk.example",
    );
  });

  it("saving delivery config round-trips the unrelated offering fields unchanged", async () => {
    renderEditor();
    await clickTab(/Delivery config/);

    const appUrlInput = document.getElementById("dl-app-off-1") as HTMLInputElement;
    const form = appUrlInput.closest("form") as HTMLFormElement;
    fireEvent.click(within(form).getByRole("button", { name: "Save delivery config" }));

    await Promise.resolve();
    expect(saveOffering).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod-1",
        offeringId: "off-1",
        name: "Starter",
        slug: "starter",
        purchaseModel: "subscription",
        billingInterval: "monthly",
        deliveryType: "saas",
        status: "active",
        deliveryConfig: {
          provisioning: "manual",
          updatePolicy: "all_free",
          appUrl: "https://app.fitdesk.example",
        },
      }),
    );
  });
});

describe("ProductEditor — media reorder (overnight item 3)", () => {
  afterEach(() => cleanup());

  it("disables the edge buttons and swaps order via reorderProductMedia", async () => {
    renderEditor();
    await clickTab(/^Media,/);

    expect(screen.getByRole("button", { name: "Move hero-cover.webp up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move fitdesk-overview.pdf down" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Move hero-cover.webp down" }));

    expect(reorderProductMedia).toHaveBeenCalledWith({
      productId: "prod-1",
      productMediaIds: ["m2", "m1", "m3", "m4"],
    });
  });
});

import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));

vi.mock("@/modules/content/admin-mutations", () => ({
  saveService: vi.fn(async (input: { id?: string; title: string; slug: string }) => ({
    ok: true,
    data: {
      service: {
        id: input.id ?? "new-service-1",
        slug: input.slug,
        title: input.title,
        summary: "A summary",
        deliverables: [],
        bodyJson: { type: "doc", content: [] },
        icon: "code",
        position: 0,
        published: false,
      },
    },
  })),
  removeService: vi.fn(),
  reorderServicesList: vi.fn(),
}));

import { ServicesEditor } from "@/components/admin/content/ServicesEditor";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ServicesEditor create flow (BUG-046)", () => {
  it("shows the newly created service in the list immediately, without a page reload", async () => {
    render(<ServicesEditor services={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /add service/i }));
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Does this refresh instantly?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.getByText("Does this refresh instantly?")).toBeInTheDocument(),
    );
  });
});

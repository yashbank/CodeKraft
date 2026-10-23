import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}));

vi.mock("@/modules/content/admin-mutations", () => ({
  saveFaq: vi.fn(async (input: { id?: string; question: string }) => ({
    ok: true,
    data: {
      faq: {
        id: input.id ?? "new-faq-1",
        question: input.question,
        answerJson: { type: "doc", content: [] },
        scope: "site",
        published: true,
      },
    },
  })),
  removeFaq: vi.fn(),
  reorderFaqsList: vi.fn(),
}));

import { FaqsEditor } from "@/components/admin/content/FaqsEditor";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FaqsEditor create flow (BUG-036)", () => {
  it("shows the newly created FAQ in the list immediately, without a page reload", async () => {
    render(<FaqsEditor faqs={[]} products={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /add faq/i }));
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: "Does this refresh instantly?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.getByText("Does this refresh instantly?")).toBeInTheDocument(),
    );
  });
});

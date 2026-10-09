import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const saveCaseStudy = vi.fn(async (_i: unknown) => ({ ok: true, data: {} }));
vi.mock("@/modules/content/admin-mutations", () => ({
  publishCaseStudyById: vi.fn(),
  removeCaseStudy: vi.fn(),
  saveCaseStudy: (i: unknown) => saveCaseStudy(i),
  unpublishCaseStudyById: vi.fn(),
}));
let n = 0;
vi.mock("@/lib/admin/media-upload", () => ({
  uploadMediaFile: vi.fn(async () => ({ mediaId: `m${++n}`, url: `https://x/${n}.png` })),
}));

import { CaseStudiesEditor } from "@/components/admin/content/CaseStudiesEditor";

afterEach(cleanup);

describe("CaseStudiesEditor gallery", () => {
  it("appends in order, swaps with down, and saves gallery", async () => {
    const row = {
      id: "c1",
      title: "T",
      slug: "t",
      client: "C",
      industry: "I",
      tech: [],
      status: "draft" as const,
      updatedAt: new Date().toISOString(),
      resultHighlight: "+40%",
      problem: "P",
      solution: "S",
      results: "R",
    };
    render(<CaseStudiesEditor caseStudies={[row]} />);
    await userEvent.click(screen.getByRole("tab", { name: "Media" }));
    const files = [
      new File(["a"], "one.png", { type: "image/png" }),
      new File(["b"], "two.png", { type: "image/png" }),
    ];
    fireEvent.change(screen.getByLabelText("Gallery image files"), { target: { files } });
    await waitFor(() => screen.getByLabelText("Alt text for image 2"));
    expect((screen.getByLabelText("Alt text for image 1") as HTMLInputElement).value).toBe("one");
    await userEvent.click(screen.getByLabelText("Move image 1 down"));
    expect((screen.getByLabelText("Alt text for image 1") as HTMLInputElement).value).toBe("two");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveCaseStudy).toHaveBeenCalled());
    const payload = saveCaseStudy.mock.calls[0]![0] as any;
    expect(payload.title).toBe("T");
    expect(
      JSON.stringify([payload.problemJson, payload.solutionJson, payload.resultsJson]),
    ).toMatch(/P.*S.*R/);
    expect(payload.resultHighlight).toBe("+40%");
    expect(payload.gallery).toEqual([
      { mediaId: "m2", alt: "two" },
      { mediaId: "m1", alt: "one" },
    ]);
  });
});

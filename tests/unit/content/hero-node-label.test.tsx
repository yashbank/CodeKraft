import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingEditor } from "@/components/admin/content/LandingEditor";
import { HeroPoster } from "@/components/site/landing/HeroPoster";
import { upsertLandingChapterSchema } from "@/modules/content/contracts";
import { saveLandingChapter } from "@/modules/content/admin-mutations";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/modules/content/admin-mutations", () => ({
  saveLandingChapter: vi.fn(async () => ({ ok: true })),
  saveFeaturedProducts: vi.fn(),
}));

afterEach(cleanup);

describe("hero node label", () => {
  it("renders default, each style, and hides when empty", () => {
    const h = (p: object) => renderToStaticMarkup(<HeroPoster {...p} />);
    expect(h({})).toContain("Architecture Node");
    expect(h({})).toContain('data-node-style="default"');
    for (const s of ["pill", "terminal", "outline"] as const) {
      const out = h({ nodeLabel: "Hi", nodeStyle: s });
      expect(out).toContain(`data-node-style="${s}"`);
      expect(out).toContain("Hi");
    }
    expect(h({ nodeLabel: "" })).not.toContain("data-node-style");
  });

  it("validates length <= 40", () => {
    const base = {
      key: "who",
      title: "t",
      bodyJson: { type: "doc", content: [] },
      cta: { primary: { label: "a", href: "/x" } },
      position: 0,
      published: true,
    };
    const ok = (m: object) => upsertLandingChapterSchema.safeParse({ ...base, media: m }).success;
    expect(ok({ nodeLabel: "x".repeat(40), nodeStyle: "pill" })).toBe(true);
    expect(ok({ nodeLabel: "x".repeat(41) })).toBe(false);
    expect(ok({ nodeStyle: "bogus" })).toBe(false);
  });

  it("editor saves label text", async () => {
    render(
      <LandingEditor
        chapters={[
          {
            key: "who",
            title: "T",
            body: "",
            published: true,
            nodeLabel: "Old",
            nodeStyle: "outline",
          },
        ]}
        services={[]}
        publishedProducts={[]}
        featuredIds={[]}
        canPublish
      />,
    );
    fireEvent.change(screen.getByLabelText(/Image label/, { selector: "input" }), {
      target: { value: "New one" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(saveLandingChapter).toHaveBeenCalled());
    const arg = vi.mocked(saveLandingChapter).mock.calls[0]![0] as {
      media: { nodeLabel: string; nodeStyle?: string };
    };
    expect(arg.media.nodeLabel).toBe("New one");
    expect(arg.media.nodeStyle).toBe("outline");
  });
});

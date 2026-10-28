import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ServiceCard } from "@/components/site/ServiceCard";

afterEach(cleanup);

describe("ServiceCard", () => {
  it("is one link named by the title, with icon, highlights and reduced-motion classes", () => {
    const { container } = render(
      <ServiceCard
        service={{
          slug: "web",
          title: "Web apps",
          summary: "Fast sites.",
          icon: "globe",
          deliverables: ["A", "B", "C", "D"],
        }}
      />,
    );
    const link = screen.getByRole("link", { name: "Web apps" });
    expect(link.getAttribute("href")).toBe("/services#web");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(link.className).toContain("motion-reduce:transition-none");
  });
});

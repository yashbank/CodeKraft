import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { UmamiScript } from "@/components/site/UmamiScript";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("UmamiScript (D-1301)", () => {
  it("renders nothing without env or before launch", () => {
    delete process.env.NEXT_PUBLIC_UMAMI_SRC;
    delete process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
    const { container } = render(<UmamiScript launched />);
    expect(container.innerHTML).toBe("");
    process.env.NEXT_PUBLIC_UMAMI_SRC = "https://cloud.umami.is/script.js";
    process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID = "abc";
    const { container: c2 } = render(<UmamiScript launched={false} />);
    expect(c2.innerHTML).toBe("");
  });
});

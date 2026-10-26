import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  TURNSTILE_DEV_TOKEN,
  TurnstileWidget,
  turnstileEnabled,
} from "@/components/site/TurnstileWidget";

describe("TurnstileWidget (no site key)", () => {
  it("renders nothing and falls back to the dev token", () => {
    const { container } = render(<TurnstileWidget onToken={() => undefined} />);
    expect(turnstileEnabled).toBe(false);
    expect(container.firstChild).toBeNull();
    expect(TURNSTILE_DEV_TOKEN).toBe("mock-turnstile-token");
  });
});

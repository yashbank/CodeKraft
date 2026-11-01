// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WidgetKindSketch } from "@/components/admin/dashboard/WidgetKindSketch";
import { OptionPreview } from "@/components/admin/system/theme-studio/OptionPreview";
import { STUDIO_GROUPS } from "@/lib/theme-studio";
import { WIDGET_STYLES, type WidgetKind } from "@/modules/dashboard-widgets/widget-styles";

describe("OptionPreview", () => {
  it.each(STUDIO_GROUPS.map((g) => [g.key, g.ids[1] ?? g.ids[0] ?? ""]))(
    "renders an aria-hidden preview for %s",
    (key, id) => {
      const { container } = render(
        <OptionPreview group={key as never} id={id} theme="light-editorial" />,
      );
      const el = container.querySelector(`[data-option-preview="${key}"]`);
      expect(el?.getAttribute("aria-hidden")).toBe("true");
      expect(el?.firstElementChild).not.toBeNull();
    },
  );
});

describe("WidgetKindSketch", () => {
  it.each(Object.keys(WIDGET_STYLES))("renders an aria-hidden sketch for %s", (kind) => {
    const { container } = render(<WidgetKindSketch kind={kind as WidgetKind} />);
    expect(
      container.querySelector(`svg[data-widget-sketch="${kind}"][aria-hidden]`),
    ).not.toBeNull();
  });
});

import type * as React from "react";

import type { WidgetKind } from "@/modules/dashboard-widgets/widget-styles";

const bars = [10, 18, 13, 22, 16];

/** Tiny aria-hidden sketch of a widget kind for the widget library (the title stays the label). */
export function WidgetKindSketch({ kind }: { kind: WidgetKind }) {
  let body: React.ReactNode;
  switch (kind) {
    case "bar":
      body = bars.map((h, i) => <rect key={i} x={3 + i * 8} y={26 - h} width="5" height={h} />);
      break;
    case "line":
    case "sparkline":
      body = <polyline points="3,22 12,14 20,18 30,8 40,12" fill="none" strokeWidth="2" />;
      break;
    case "donut":
      body = <circle cx="22" cy="16" r="9" fill="none" strokeWidth="5" strokeDasharray="38 60" />;
      break;
    case "progress":
      body = (
        <>
          <rect x="3" y="13" width="38" height="5" opacity=".25" />
          <rect x="3" y="13" width="24" height="5" />
        </>
      );
      break;
    case "heatmap":
      body = [0, 1, 2, 3].flatMap((r) =>
        [0, 1, 2, 3, 4].map((c) => (
          <rect
            key={`${r}${c}`}
            x={3 + c * 8}
            y={3 + r * 7}
            width="6"
            height="5"
            opacity={0.25 + ((r * 5 + c) % 4) * 0.25}
          />
        )),
      );
      break;
    case "list":
      body = [6, 14, 22].map((y) => <rect key={y} x="3" y={y} width="38" height="4" />);
      break;
    default: // stat
      body = (
        <>
          <rect x="3" y="6" width="22" height="12" />
          <rect x="3" y="22" width="14" height="4" opacity=".4" />
        </>
      );
  }
  return (
    <svg
      aria-hidden
      data-widget-sketch={kind}
      viewBox="0 0 44 32"
      className="border-border bg-canvas text-accent-text h-8 w-11 shrink-0 rounded-sm border"
      fill="currentColor"
      stroke="currentColor"
    >
      {body}
    </svg>
  );
}

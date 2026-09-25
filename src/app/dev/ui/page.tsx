import { notFound } from "next/navigation";

import { Toaster } from "@/components/ui/sonner";
import { ButtonsSection } from "./sections/buttons";
import { DataSection, StatusMatrixSection } from "./sections/data";
import { FormattingSection } from "./sections/formatting";
import { FormsSection } from "./sections/forms";
import { OverlaysSection } from "./sections/overlays";
import { ThemeSwitcher } from "./sections/theme-switcher";

export const metadata = {
  title: "CodeKraft UI kitchen sink",
  robots: { index: false, follow: false },
};

const NAV = [
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["overlays", "Overlays"],
  ["data", "Data"],
  ["status", "Status"],
  ["formatting", "Formatting"],
] as const;

/** /dev/ui — every shadcn primitive in every state, both themes. Not available in production (P1.3). */
export default function DevUiPage() {
  if (
    process.env.APP_ENV === "production" &&
    !process.env.VERCEL &&
    process.env.ENABLE_DEV_SCREENS !== "true"
  ) {
    notFound();
  }
  return (
    <main className="min-h-screen bg-canvas text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div>
            <h1 className="text-h3">CodeKraft UI kitchen sink</h1>
            <p className="text-body-sm text-fg-muted">docs/08 design system · P1.3 · dev only</p>
          </div>
          <nav aria-label="Sections" className="flex flex-wrap gap-3 text-body-sm">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="text-fg-muted hover:text-fg">
                {label}
              </a>
            ))}
          </nav>
          <ThemeSwitcher />
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        <ButtonsSection />
        <FormsSection />
        <OverlaysSection />
        <DataSection />
        <StatusMatrixSection />
        <FormattingSection />
      </div>
      <Toaster />
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { ThemeSwitcher } from "@/app/dev/ui/sections/theme-switcher";
import { SCREENS } from "./registry";

export const metadata = {
  title: "CodeKraft screen previews",
  robots: { index: false, follow: false },
};

/** /dev/screens — every designed screen rendered with fixture data, both themes. Not in production. */
export default function ScreensLayout({ children }: { children: React.ReactNode }) {
  if (
    process.env.APP_ENV === "production" &&
    !process.env.VERCEL &&
    process.env.ENABLE_DEV_SCREENS !== "true"
  ) {
    notFound();
  }
  const groups = ["site", "auth", "account", "admin"] as const;
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <header className="sticky top-0 z-50 border-b border-border bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 text-body-sm">
          <Link href="/dev/screens" className="font-semibold text-fg">
            Screens
          </Link>
          {groups.map((g) => (
            <details key={g} className="relative">
              <summary className="cursor-pointer list-none text-fg-muted capitalize hover:text-fg">
                {g}
              </summary>
              <ul className="absolute left-0 z-50 mt-2 max-h-[70vh] w-72 overflow-auto rounded-md border border-border bg-surface p-2 shadow-2">
                {SCREENS.filter((s) => s.group === g).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={s.href}
                      className="block rounded-sm px-2 py-1 text-fg-muted hover:bg-elevated hover:text-fg"
                    >
                      <span className="font-mono text-caption text-fg-subtle">{s.id}</span>{" "}
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <span className="ml-auto">
            <ThemeSwitcher />
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}

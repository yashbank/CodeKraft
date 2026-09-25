import Link from "next/link";

import { SCREENS } from "./registry";

export default function ScreensIndex() {
  const groups = ["site", "auth", "account", "admin"] as const;
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-h1">Planned screens</h1>
        <p className="max-w-prose text-body text-fg-muted">
          Every designed screen from <code className="font-mono">ui/screens/**</code>, rendered with
          placeholder data and the real components. Switch themes top-right; resize the window for
          phone and tablet layouts.
        </p>
      </div>
      {groups.map((g) => (
        <section key={g} className="space-y-3">
          <h2 className="text-h3 capitalize">{g}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SCREENS.filter((s) => s.group === g).map((s) => (
              <li key={s.id}>
                <Link
                  href={s.href}
                  className="block rounded-md border border-border bg-surface p-3 transition-colors hover:border-accent"
                >
                  <span className="block font-mono text-caption text-fg-subtle">{s.id}</span>
                  <span className="text-body font-medium">{s.title}</span>
                </Link>
              </li>
            ))}
            {SCREENS.filter((s) => s.group === g).length === 0 ? (
              <li className="text-body-sm text-fg-muted">(pending)</li>
            ) : null}
          </ul>
        </section>
      ))}
    </main>
  );
}

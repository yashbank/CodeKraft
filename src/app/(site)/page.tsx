import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas text-fg flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-accent/10 text-accent border border-accent/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Phase 3 in Progress · 571 tests passing
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">CodeKraft Platform</h1>
          <p className="text-fg-muted max-w-lg mx-auto text-base">
            Digital commerce &amp; delivery engine. Explore the interactive screen previews and
            design system below while backend domains are being deployed.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <Link
            href="/dev/screens"
            className="group block p-5 rounded-xl border border-border bg-surface hover:border-accent hover:bg-elevated transition-all"
          >
            <span className="text-xs font-mono text-accent block mb-1">Preview Catalog</span>
            <h2 className="text-lg font-semibold group-hover:text-accent transition-colors">
              All 50+ Screens &rarr;
            </h2>
            <p className="text-sm text-fg-muted mt-1">
              Storefront, admin console, customer dashboard, and auth screens.
            </p>
          </Link>

          <Link
            href="/dev/ui"
            className="group block p-5 rounded-xl border border-border bg-surface hover:border-accent hover:bg-elevated transition-all"
          >
            <span className="text-xs font-mono text-accent block mb-1">Design System</span>
            <h2 className="text-lg font-semibold group-hover:text-accent transition-colors">
              UI Kitchen Sink &rarr;
            </h2>
            <p className="text-sm text-fg-muted mt-1">
              Component primitives, state matrices, formatting &amp; themes.
            </p>
          </Link>

          <Link
            href="/dev/screens/site/landing"
            className="group block p-5 rounded-xl border border-border bg-surface hover:border-accent hover:bg-elevated transition-all"
          >
            <span className="text-xs font-mono text-accent block mb-1">Storefront</span>
            <h2 className="text-lg font-semibold group-hover:text-accent transition-colors">
              Landing Page &rarr;
            </h2>
            <p className="text-sm text-fg-muted mt-1">
              Interactive 3D hero, services, and product catalog showcase.
            </p>
          </Link>

          <Link
            href="/dev/screens/admin/dashboard"
            className="group block p-5 rounded-xl border border-border bg-surface hover:border-accent hover:bg-elevated transition-all"
          >
            <span className="text-xs font-mono text-accent block mb-1">Management</span>
            <h2 className="text-lg font-semibold group-hover:text-accent transition-colors">
              Admin Dashboard &rarr;
            </h2>
            <p className="text-sm text-fg-muted mt-1">
              Dual-admin approvals, orders, product studio, and settings.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}

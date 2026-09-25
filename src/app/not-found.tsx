import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="space-y-3 text-center">
        <p className="text-overline text-fg-muted uppercase">404</p>
        <h1 className="text-h2">Page not found</h1>
        <Link href="/" className="text-accent-text underline underline-offset-4">
          Back to CodeKraft
        </Link>
      </div>
    </main>
  );
}

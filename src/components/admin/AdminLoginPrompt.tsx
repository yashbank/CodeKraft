import Link from "next/link";

export function AdminLoginPrompt() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-h2">CodeKraft Admin</h1>
        <p className="text-body text-fg-muted">Sign in with an admin account to continue.</p>
        <Link href="/auth/login?next=/" className="text-accent-text underline underline-offset-4">
          Go to sign in
        </Link>
      </div>
    </main>
  );
}

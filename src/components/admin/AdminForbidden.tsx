export function AdminForbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-h2">403 — Admin access required</h1>
        <p className="text-body text-fg-muted">
          This account does not hold an admin role. The attempt has been recorded.
        </p>
      </div>
    </main>
  );
}

import { getSession } from "@/modules/auth/service";
import { SignOutButton } from "@/components/account/SignOutButton";

export default async function AdminHome() {
  const session = await getSession();
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8">
      <h1 className="text-h2">Admin dashboard</h1>
      <p className="text-body text-fg-muted">
        Signed in as {session?.user.email}. The widget dashboard arrives in Phase 8.
      </p>
      <SignOutButton />
    </main>
  );
}

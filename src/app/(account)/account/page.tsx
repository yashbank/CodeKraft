import { getSession } from "@/modules/auth/service";
import { SignOutButton } from "@/components/account/SignOutButton";

export default async function AccountHome() {
  const session = await getSession();
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8">
      <h1 className="text-h2">Your account</h1>
      <p className="text-body text-fg-muted" data-testid="account-email">
        Signed in as {session?.user.email}. Purchases, invoices and settings arrive in Phase 7.
      </p>
      <SignOutButton />
    </main>
  );
}

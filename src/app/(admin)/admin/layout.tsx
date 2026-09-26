import { getSession } from "@/modules/auth/service";
import { AdminShellWrapper } from "@/components/admin/AdminShellWrapper";
import { PRIYA } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default async function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  const user = session
    ? {
        id: session.user.id,
        name: session.user.name || "Admin",
        email: session.user.email,
        role: "super_admin" as const,
      }
    : PRIYA;

  return <AdminShellWrapper user={user}>{children}</AdminShellWrapper>;
}

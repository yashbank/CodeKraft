import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/service";
import { AccountShellWrapper } from "@/components/account/AccountShellWrapper";

export const dynamic = "force-dynamic";

export default async function AccountAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login?next=/account");
  }

  const name: string =
    session.user.name ||
    (session.user.email ? session.user.email.split("@")[0] : "Customer") ||
    "Customer";

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AccountShellWrapper
      user={{
        name,
        email: session.user.email,
        initials,
      }}
    >
      {children}
    </AccountShellWrapper>
  );
}

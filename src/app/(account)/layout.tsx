import { redirect } from "next/navigation";

import { getSession } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

/** Customer area: session required (BR-03). Full dashboard shell lands in P7. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/auth/login?next=/account");
  return <div data-app="account">{children}</div>;
}

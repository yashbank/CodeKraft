import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetPasswordScreen } from "@/components/account/SetPasswordScreen";
import { redirectToLogin } from "@/lib/authz/login-redirect";
import { getSession } from "@/modules/auth/service";

export const metadata: Metadata = { title: "Change password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) return redirectToLogin("/account");
  if (!session.user.mustChangePassword) redirect("/");
  return <SetPasswordScreen mode={{ kind: "change" }} />;
}

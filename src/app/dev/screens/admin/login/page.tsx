import { AdminLogin } from "@/components/admin/AdminLogin";
import { href } from "../../_fixtures/admin";

export const metadata = { title: "SCR-ADM-01 · Admin login + TOTP" };

/** SCR-ADM-01 — login step, then the TOTP step after submit. */
export default function Page() {
  return (
    <AdminLogin
      environment="staging"
      reason="expired"
      forgotHref={href("/login")}
      dashboardHref={href("/dashboard")}
    />
  );
}

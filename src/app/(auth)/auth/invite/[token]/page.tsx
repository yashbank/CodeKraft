import type { Metadata } from "next";

import { SetPasswordScreen } from "@/components/account/SetPasswordScreen";
import { previewToken } from "@/modules/auth/invites";

export const metadata: Metadata = { title: "Set your password", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await previewToken(token);
  return (
    <SetPasswordScreen
      mode={
        p.valid
          ? { kind: "link", token, purpose: p.purpose, email: p.email, needsName: p.needsName }
          : { kind: "invalid", reason: p.reason }
      }
    />
  );
}

import type { Metadata } from "next";

import { areaMetadata, NOINDEX } from "@/lib/seo";
import { getSiteLogo, getSiteName } from "@/lib/site-brand";
import { Toaster } from "@/components/ui/sonner";
import { enforcePasswordChange } from "@/lib/authz/must-change";
import { redirectToLogin } from "@/lib/authz/login-redirect";

import { getSession } from "@/modules/auth/service";
import { getDisplayCurrency } from "@/lib/display-currency";
import { getRateTable } from "@/lib/rate-table";
import { ViewerCurrencyProvider } from "@/components/account/ViewerMoney";

export const dynamic = "force-dynamic";

/** Customer area: session required (BR-03). Full dashboard shell lands in P7. */
export async function generateMetadata(): Promise<Metadata> {
  const [siteName, logo] = await Promise.all([getSiteName(), getSiteLogo()]);
  return { robots: NOINDEX, ...areaMetadata("Account", siteName, logo) };
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) return redirectToLogin("/account");
  enforcePasswordChange(session);
  const [{ currency }, table] = await Promise.all([getDisplayCurrency(), getRateTable()]);
  return (
    <div data-app="account">
      <ViewerCurrencyProvider currency={currency} table={table}>
        {children}
      </ViewerCurrencyProvider>
      <Toaster />
    </div>
  );
}

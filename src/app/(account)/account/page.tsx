import { getSession } from "@/modules/auth/service";
import { OverviewScreen } from "@/components/account/OverviewScreen";
import {
  entitlements,
  invoices,
  queries,
} from "@/app/dev/screens/_fixtures/account";

export const dynamic = "force-dynamic";

export default async function AccountOverviewPage() {
  const session = await getSession();
  const firstName = session?.user.name?.split(" ")[0] || "Customer";

  return (
    <OverviewScreen
      firstName={firstName}
      emailVerified={true}
      actions={[
        {
          id: "act-1",
          tone: "info",
          title: "New product updates available",
          detail: "FitDesk Pro v3.2.0 was released with UPI autopay reconciliation.",
          href: "/account/purchases",
          cta: "View updates",
        },
      ]}
      entitlements={entitlements}
      invoices={invoices}
      queries={queries}
      wishlistCount={2}
      now={new Date().toISOString()}
      links={{
        purchases: "/account/purchases",
        entitlement: (id: string) => `/account/purchases#${id}`,
        invoices: "/account/invoices",
        queries: "/account/queries",
        query: (id: string) => `/account/queries#${id}`,
        wishlist: "/account/wishlist",
        chat: "/account/chat",
      }}
    />
  );
}

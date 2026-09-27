import { OverviewScreen } from "@/components/account/OverviewScreen";
import { getSession } from "@/modules/auth/service";
import { mapEntitlementSummary } from "@/lib/account/purchases-view";
import { mapInvoiceRowsToSummaries } from "@/lib/account/invoices-view";
import { mapQueryRowToSummary } from "@/lib/account/queries-view";
import { listMyEntitlementsQuery } from "@/modules/entitlements/queries";
import { listMyInvoicesQuery } from "@/modules/invoices/queries";
import { listMyQueriesQuery } from "@/modules/queries/queries";
import { listMyWishlistQuery } from "@/modules/catalog/queries";

export const dynamic = "force-dynamic";

export default async function AccountOverviewPage() {
  const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
  const [session, ctx] = await Promise.all([getSession(), getSiteRequestContext()]);
  const firstName = session?.user.name?.split(" ")[0] || "Customer";

  const [entitlementsResult, invoicesResult, queriesResult, wishlistResult] = await Promise.all([
    listMyEntitlementsQuery({ limit: 5 }, ctx),
    listMyInvoicesQuery({ limit: 5 }, ctx),
    listMyQueriesQuery({ limit: 5 }, ctx),
    listMyWishlistQuery({ limit: 200 }, ctx),
  ]);

  const entitlements = entitlementsResult.ok
    ? entitlementsResult.data.items.map(mapEntitlementSummary)
    : [];
  const invoices = invoicesResult.ok ? mapInvoiceRowsToSummaries(invoicesResult.data.items) : [];
  const queries = queriesResult.ok ? queriesResult.data.items.map(mapQueryRowToSummary) : [];
  const wishlistCount = wishlistResult.ok ? wishlistResult.data.items.length : 0;

  const anyFailed =
    !entitlementsResult.ok || !invoicesResult.ok || !queriesResult.ok || !wishlistResult.ok;

  return (
    <OverviewScreen
      firstName={firstName}
      emailVerified={Boolean(session?.user.emailVerified)}
      actions={[]}
      entitlements={entitlements}
      invoices={invoices}
      queries={queries}
      wishlistCount={wishlistCount}
      now={new Date().toISOString()}
      error={anyFailed ? "Couldn't load some of your account data. Please try again." : undefined}
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

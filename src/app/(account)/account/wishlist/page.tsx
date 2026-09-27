import { WishlistScreen } from "@/components/account/WishlistScreen";
import { mapWishlistItem } from "@/lib/account/wishlist-view";
import { listMyWishlistQuery } from "@/modules/catalog/queries";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const { getSiteRequestContext } = await import("@/lib/authz/site-request-context");
  const ctx = await getSiteRequestContext();

  const result = await listMyWishlistQuery({ limit: 100, displayCurrency: "INR" }, ctx);
  const items = result.ok ? result.data.items.map(mapWishlistItem) : [];

  return (
    <WishlistScreen
      items={items}
      links={{
        dashboard: "/account/purchases",
      }}
    />
  );
}

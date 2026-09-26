import { WishlistScreen } from "@/components/account/WishlistScreen";
import { wishlist } from "@/app/dev/screens/_fixtures/account";

export const dynamic = "force-dynamic";

export default function WishlistPage() {
  return (
    <WishlistScreen
      items={wishlist}
      links={{
        dashboard: "/account/purchases",
      }}
    />
  );
}

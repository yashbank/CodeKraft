import { CouponsList } from "@/components/admin/catalog/CouponsList";
import { COUPONS, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-32 · Coupons" };

export default function Page() {
  return (
    <PreviewShell active="/coupons" title="Coupons" summary="6 coupons · 2 active">
      <CouponsList
        coupons={COUPONS}
        products={[
          { id: "p-1", name: "FitDesk Pro" },
          { id: "p-2", name: "TradeFlow" },
          { id: "p-3", name: "ShopSync" },
          { id: "p-4", name: "Brand Kit Templates" },
        ]}
        ordersHref={href("/orders")}
      />
    </PreviewShell>
  );
}

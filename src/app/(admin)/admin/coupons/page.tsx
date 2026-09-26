import { CouponsList } from "@/components/admin/catalog/CouponsList";
import { COUPONS, PRODUCTS } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminCouponsPage() {
  return (
    <CouponsList
      coupons={COUPONS}
      products={PRODUCTS.map((p) => p.name)}
      ordersHref="/admin/orders"
    />
  );
}

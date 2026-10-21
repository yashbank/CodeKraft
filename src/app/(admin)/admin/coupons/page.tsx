import { CouponsList } from "@/components/admin/catalog/CouponsList";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { buildAdminNameMap, mapCouponToRow } from "@/lib/admin/coupons-view";
import { listAssignableAdminsQuery, listCouponsQuery } from "@/modules/coupons/queries";
import { listProductsAdminQuery } from "@/modules/catalog/queries";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const ctx = await getAdminRequestContext();
  const now = new Date().toISOString();

  const [couponsResult, productsResult, adminsResult] = await Promise.all([
    listCouponsQuery({ limit: 100 }, ctx),
    listProductsAdminQuery({ limit: 100 }, ctx),
    listAssignableAdminsQuery({}, ctx),
  ]);

  const products = productsResult.ok
    ? productsResult.data.items.map((p) => ({ id: p.id, name: p.name }))
    : [];
  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const adminMap = buildAdminNameMap(adminsResult.ok ? adminsResult.data.items : []);

  const coupons = couponsResult.ok
    ? couponsResult.data.items.map((c) => mapCouponToRow(c, productNameById, now, adminMap))
    : [];

  return <CouponsList coupons={coupons} products={products} ordersHref="/admin/orders" />;
}

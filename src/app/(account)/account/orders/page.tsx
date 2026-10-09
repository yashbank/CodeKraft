import { redirect } from "next/navigation";

/** No orders index in the sitemap (orders live under Purchases); notifications and invoices link here. */
export default function AccountOrdersIndex() {
  redirect("/account/purchases");
}

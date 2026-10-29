import { ErrorPanel } from "@/components/site/ErrorPanel";

/** Account 404: stays inside the account shell (P14-12b). */
export default function AccountNotFound() {
  return (
    <ErrorPanel
      code="404"
      title="We couldn't find that page"
      body="That item doesn't exist, or it belongs to another account."
      searchAction="/products"
      links={[
        { href: "/account", label: "Account home" },
        { href: "/account/purchases", label: "My purchases" },
        { href: "/account/queries", label: "Support" },
        { href: "/", label: "Back to site" },
      ]}
    />
  );
}

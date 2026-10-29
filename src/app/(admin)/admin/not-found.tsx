import { ErrorPanel } from "@/components/site/ErrorPanel";

/** Admin 404: stays inside the admin shell (the site 404 links to public pages this host 404s). */
export default function AdminNotFound() {
  return (
    <ErrorPanel
      code="404"
      title="Page not found"
      body="That record doesn't exist or you don't have access to it. Press Ctrl+K to search the admin."
      links={[
        { href: "/admin/dashboard", label: "Back to dashboard" },
        { href: "/admin/orders", label: "Orders" },
        { href: "/admin/queries", label: "Queries" },
      ]}
    />
  );
}

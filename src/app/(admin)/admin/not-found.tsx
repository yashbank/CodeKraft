import Link from "next/link";

import { EmptyState } from "@/components/admin/EmptyState";

/** Admin 404: stays inside the admin shell (the site 404 links to public pages this host 404s). */
export default function AdminNotFound() {
  return (
    <EmptyState
      title="Page not found"
      body="That record doesn't exist or you don't have access to it."
      action={
        <Link href="/admin/dashboard" className="text-body underline">
          Back to dashboard
        </Link>
      }
    />
  );
}

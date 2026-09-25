import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import {
  APPROVALS,
  CURRENT_ADMIN,
  NOTIFICATIONS,
  NOW,
  PREVIEW_ROUTES,
  SEARCH_ITEMS,
} from "../_fixtures/admin";

/** Preview wrapper: the real AdminShell fed with fixture data and remapped to /dev/screens routes. */
export function PreviewShell({
  active,
  title,
  summary,
  readMostly,
  breadcrumbs,
  children,
}: {
  active: string;
  title: string;
  summary?: string;
  readMostly?: boolean;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  children: ReactNode;
}) {
  return (
    <AdminShell
      active={active}
      user={CURRENT_ADMIN}
      environment="staging"
      pendingApprovals={
        APPROVALS.filter((a) => a.status === "pending" && a.requestedBy.id !== CURRENT_ADMIN.id)
          .length
      }
      notifications={NOTIFICATIONS}
      now={NOW}
      title={title}
      summary={summary}
      readMostly={readMostly}
      breadcrumbs={breadcrumbs}
      searchItems={SEARCH_ITEMS}
      routes={PREVIEW_ROUTES}
      stickyTop="41px"
    >
      {children}
    </AdminShell>
  );
}

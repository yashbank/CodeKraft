import { ApprovalsInbox } from "@/components/admin/commerce/ApprovalsInbox";
import { APPROVALS, PRIYA } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  return (
    <ApprovalsInbox
      approvals={APPROVALS}
      currentUser={PRIYA}
      now={new Date().toISOString()}
    />
  );
}

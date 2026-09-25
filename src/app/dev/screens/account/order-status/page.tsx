import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = [
  "awaitingReference",
  "submitted",
  "failedAttempt",
  "paid",
  "confirmed",
  "expired",
  "cancelled",
  "refunded",
  "loading",
] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-11"
      title="Order status"
      spec="ui/screens/user/SCR-ACC-11-order-status.md"
      href="/dev/screens/account/order-status"
      states={STATES}
      current={state}
    >
      <PreviewShell
        active="purchases"
        breadcrumb={[
          { label: "Purchases", href: "/dev/screens/account/purchases" },
          { label: "Order" },
        ]}
      >
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

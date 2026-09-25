import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = [
  "download",
  "cap-reached",
  "license",
  "license-pending",
  "saas",
  "saas-ready",
  "service",
  "service-done",
  "subscription",
  "cancelled",
  "expired",
  "loading",
] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-03"
      title="Entitlement detail"
      spec="ui/screens/user/SCR-ACC-03-entitlement-detail.md"
      href="/dev/screens/account/entitlement"
      states={STATES}
      current={state}
    >
      <PreviewShell
        active="purchases"
        breadcrumb={[
          { label: "Purchases", href: "/dev/screens/account/purchases" },
          { label: "Product" },
        ]}
      >
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

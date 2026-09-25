import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = ["default", "loading", "empty", "error", "pdf-error"] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-04"
      title="Invoices & payments"
      spec="ui/screens/user/SCR-ACC-04-invoices-payments.md"
      href="/dev/screens/account/invoices"
      states={STATES}
      current={state}
    >
      <PreviewShell active="invoices">
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

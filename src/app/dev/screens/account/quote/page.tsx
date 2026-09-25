import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = ["sent", "readonly", "accepted", "paid", "expired", "cancelled", "loading"] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-12"
      title="Custom quote"
      spec="ui/screens/user/SCR-ACC-12-custom-quote.md"
      href="/dev/screens/account/quote"
      states={STATES}
      current={state}
    >
      <PreviewShell minimal={{ backHref: "/dev/screens/account/overview", backLabel: "Dashboard" }}>
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

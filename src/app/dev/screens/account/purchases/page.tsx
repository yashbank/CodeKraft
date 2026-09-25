import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = ["default", "loading", "empty", "error"] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-02"
      title="Purchases & access"
      spec="ui/screens/user/SCR-ACC-02-purchases.md"
      href="/dev/screens/account/purchases"
      states={STATES}
      current={state}
    >
      <PreviewShell active="purchases">
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

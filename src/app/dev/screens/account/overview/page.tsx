import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = ["default", "unverified", "loading", "empty", "error"] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-01"
      title="Account overview"
      spec="ui/screens/user/SCR-ACC-01-overview.md"
      href="/dev/screens/account/overview"
      states={STATES}
      current={state}
    >
      <PreviewShell active="overview">
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

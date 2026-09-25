import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = ["default", "loading", "empty"] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-05"
      title="Queries"
      spec="ui/screens/user/SCR-ACC-05-queries.md"
      href="/dev/screens/account/queries"
      states={STATES}
      current={state}
    >
      <PreviewShell active="queries">
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

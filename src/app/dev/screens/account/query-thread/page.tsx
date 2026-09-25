import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = ["waiting", "resolved", "closed", "send-error"] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-05"
      title="Query thread"
      spec="ui/screens/user/SCR-ACC-05-queries.md"
      href="/dev/screens/account/query-thread"
      states={STATES}
      current={state}
    >
      <PreviewShell
        active="queries"
        breadcrumb={[
          { label: "Queries", href: "/dev/screens/account/queries" },
          { label: "Thread" },
        ]}
      >
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = ["default", "loading", "empty"] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-08"
      title="Notifications"
      spec="ui/screens/user/SCR-ACC-08-notifications.md"
      href="/dev/screens/account/notifications"
      states={STATES}
      current={state}
    >
      <PreviewShell active="notifications">
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

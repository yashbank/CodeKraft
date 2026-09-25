import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = [
  "default",
  "theme-flag",
  "phone-flag",
  "delete-blocked",
  "no-history",
  "loading",
] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-09"
      title="Profile & settings"
      spec="ui/screens/user/SCR-ACC-09-profile-settings.md"
      href="/dev/screens/account/settings"
      states={STATES}
      current={state}
    >
      <PreviewShell active="settings">
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

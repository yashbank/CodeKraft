import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = ["default", "loading", "empty"] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-07"
      title="Wishlist"
      spec="ui/screens/user/SCR-ACC-07-wishlist.md"
      href="/dev/screens/account/wishlist"
      states={STATES}
      current={state}
    >
      <PreviewShell active="wishlist">
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

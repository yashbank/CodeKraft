import { PreviewFrame, readState, type SearchParams } from "../_preview";
import { PreviewShell } from "../_shell";
import { Preview } from "./Preview";

const STATES = [
  "default",
  "streaming",
  "cap",
  "fallback",
  "connection-lost",
  "empty-history",
] as const;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, STATES);
  return (
    <PreviewFrame
      id="SCR-ACC-06"
      title="Chatbot"
      spec="ui/screens/user/SCR-ACC-06-chatbot.md"
      href="/dev/screens/account/chat"
      states={STATES}
      current={state}
    >
      <PreviewShell active="chat">
        <Preview state={state} />
      </PreviewShell>
    </PreviewFrame>
  );
}

"use client";

import { QueriesScreen } from "@/components/account/QueriesScreen";
import { chatTranscripts, NOW, queries } from "../../_fixtures/account";
import { DEV_LINKS, queryHref, transcriptHref } from "../_links";

export function Preview({ state }: { state: string }) {
  const empty = state === "empty";
  return (
    <QueriesScreen
      queries={empty ? [] : queries}
      transcripts={empty ? [] : chatTranscripts}
      now={NOW}
      links={{ query: queryHref, chat: DEV_LINKS.chat, transcript: transcriptHref }}
      loading={state === "loading"}
    />
  );
}

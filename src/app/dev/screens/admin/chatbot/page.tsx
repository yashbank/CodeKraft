import { ChatbotMonitor } from "@/components/admin/crm/ChatbotMonitor";
import { CHATBOT, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-16 · Chatbot monitor" };

export default function Page() {
  return (
    <PreviewShell active="/chatbot" title="Chatbot" summary="1,240 / 2,000 messages today">
      <ChatbotMonitor
        data={CHATBOT}
        settingsHref={href("/settings")}
        queriesHref={href("/queries")}
        leadsHref={href("/leads") + "/detail"}
      />
    </PreviewShell>
  );
}

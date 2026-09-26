import { ChatbotMonitor } from "@/components/admin/crm/ChatbotMonitor";
import { CHATBOT } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminChatbotPage() {
  return (
    <ChatbotMonitor
      data={CHATBOT}
      settingsHref="/admin/settings"
      queriesHref="/admin/queries"
      leadsHref="/admin/leads"
    />
  );
}

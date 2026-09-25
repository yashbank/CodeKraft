import { EntitlementsScreen } from "@/components/admin/commerce/EntitlementsScreen";
import { ADMINS, DELIVERY_TASKS, ENTITLEMENTS, NOW, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-12 · Entitlements & delivery tasks" };

export default function Page() {
  return (
    <PreviewShell
      active="/entitlements"
      title="Entitlements"
      summary="8 entitlements · 3 open delivery tasks"
    >
      <EntitlementsScreen
        entitlements={ENTITLEMENTS}
        tasks={DELIVERY_TASKS}
        admins={ADMINS}
        now={NOW}
        orderHref={href("/orders") + "/detail-paid"}
        customerHref={href("/customers") + "/detail"}
        queriesHref={href("/queries")}
      />
    </PreviewShell>
  );
}

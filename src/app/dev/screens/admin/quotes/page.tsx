import { QuotesScreen } from "@/components/admin/commerce/QuotesScreen";
import { CUSTOMER_OPTIONS, QUOTES, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-09 · Custom quotes" };

export default function Page() {
  return (
    <PreviewShell active="/quotes" title="Custom quotes" summary="5 quotes · 1 sent">
      <QuotesScreen
        quotes={QUOTES}
        customers={CUSTOMER_OPTIONS}
        orderHref={href("/orders") + "/detail-paid"}
        customerHref={href("/customers") + "/detail"}
      />
    </PreviewShell>
  );
}

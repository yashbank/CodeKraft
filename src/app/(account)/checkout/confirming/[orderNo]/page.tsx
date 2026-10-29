import { redirect } from "next/navigation";
import { PaymentConfirmingScreen } from "@/components/account/PaymentConfirmingScreen";
import { getSession } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

/** R9-06: post-payment "Confirming your payment" screen. Auth only; the poll is order-scoped. */
export default async function ConfirmingPage({ params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  if (!(await getSession())) redirect(`/auth/login?next=/checkout/confirming/${orderNo}`);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
      <PaymentConfirmingScreen orderNo={orderNo} />
    </div>
  );
}

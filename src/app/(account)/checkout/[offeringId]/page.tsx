import { notFound, redirect } from "next/navigation";
import { CheckoutScreen, type CheckoutPageState } from "@/components/account/CheckoutScreen";
import { mapCheckoutPreviewToOffering, mapProfileToBilling } from "@/lib/account/checkout-view";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { ErrorCode } from "@/lib/errors";
import { getSession } from "@/modules/auth/service";
import { previewCheckoutAction } from "@/modules/orders/actions";
import { getMyProfileQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ offeringId: string }>;
}

/**
 * SCR-ACC-10 checkout page. Real money: `previewCheckout` computes the actual price/tax/coupon
 * server-side (no client-side tax math), and `CheckoutScreen`'s "Place order" calls the real
 * `createOrder` -> manual UPI/bank payment instructions (release 1, D-501 -- no payment gateway
 * exists; the flow ends at "reference submitted, awaiting admin confirmation", never a fake
 * "payment successful" state -- see `PaymentInstructionsPanel`).
 */
export default async function CheckoutPage({ params }: PageProps) {
  const { offeringId } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/auth/login?next=/checkout/${offeringId}`);
  }

  const ctx = await getSiteRequestContext();
  const [previewResult, profileResult] = await Promise.all([
    previewCheckoutAction({ offeringId }, ctx),
    getMyProfileQuery({}, ctx),
  ]);

  if (!previewResult.ok) {
    if (previewResult.error.code === ErrorCode.NOT_FOUND) {
      notFound();
    }
    const state: CheckoutPageState =
      previewResult.error.code === ErrorCode.DUPLICATE_PURCHASE ? "duplicate" : "unavailable";
    // Only the offering's slug is needed for the "back to product" link in these states, and we
    // don't have it (the preview that would carry it is exactly what failed) -- fall back to the
    // purchases dashboard rather than guess a product URL.
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
        <CheckoutScreen
          offeringId={offeringId}
          offering={{
            productName: "",
            offeringName: "",
            purchaseModelLine: "",
            deliveryType: "download",
            unit: { amountMinor: 0, currency: "INR" },
            taxLabel: "Tax",
            tax: null,
            enabledMethods: ["manual_upi", "manual_bank"],
            displayCurrency: "INR",
            productHref: "/account/purchases",
          }}
          customerEmail={session.user.email}
          billing={{ name: session.user.name ?? "", country: "IN" }}
          state={state}
          links={{ dashboard: "/account/purchases", verify: "/auth/verify" }}
        />
      </div>
    );
  }

  const offering = mapCheckoutPreviewToOffering(previewResult.data);
  const billing = profileResult.ok
    ? mapProfileToBilling(profileResult.data.user, profileResult.data.profile)
    : { name: session.user.name ?? "", email: session.user.email, country: "IN" };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
      <CheckoutScreen
        offeringId={offeringId}
        offering={offering}
        customerEmail={session.user.email}
        billing={billing}
        links={{
          dashboard: "/account/purchases",
          verify: "/auth/verify",
        }}
      />
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/modules/auth/service";
import { CheckoutScreen } from "@/components/account/CheckoutScreen";
import { checkoutOffering, customer } from "@/app/dev/screens/_fixtures/account";

interface PageProps {
  params: Promise<{ offeringId: string }>;
}

export default async function CheckoutPage({ params }: PageProps) {
  const { offeringId } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/auth/login?next=/checkout/${offeringId}`);
  }

  const offering = {
    ...checkoutOffering,
    id: offeringId,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
      <CheckoutScreen
        offering={offering}
        customerEmail={session.user.email}
        billing={customer.billing}
        links={{
          dashboard: "/account/purchases",
          verify: "/auth/verify",
        }}
      />
    </div>
  );
}

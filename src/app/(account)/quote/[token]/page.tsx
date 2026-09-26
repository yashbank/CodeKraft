import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/service";
import { QuoteScreen } from "@/components/account/QuoteScreen";
import { customer, quote as quoteFixture } from "@/app/dev/screens/_fixtures/account";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function QuotePage({ params }: PageProps) {
  const { token } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/auth/login?next=/quote/${token}`);
  }

  const quote = {
    ...quoteFixture,
    id: `quote_${token}`,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
      <QuoteScreen
        quote={quote}
        billing={customer.billing}
        customerEmail={session.user.email}
        canAccept={true}
        now={new Date().toISOString()}
        links={{
          newQuery: "/account/queries",
          switchAccount: "/auth/login",
        }}
      />
    </div>
  );
}

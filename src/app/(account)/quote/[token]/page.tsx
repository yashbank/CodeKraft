import { notFound, redirect } from "next/navigation";
import { QuoteScreen } from "@/components/account/QuoteScreen";
import { defaultBilling, mapQuoteView } from "@/lib/account/quote-view";
import { mapProfileToBilling } from "@/lib/account/checkout-view";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { ErrorCode } from "@/lib/errors";
import { getSession } from "@/modules/auth/service";
import { getQuoteQuery } from "@/modules/quotes/queries";
import { getMyProfileQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * SCR-ACC-12 quote pay page. `getQuote` is a token-scoped `definePublicAction`: it looks the quote
 * up by `token` alone and only sets `canAccept` when `ctx.userId === quote.customerId` (verified in
 * `modules/quotes/service.ts`), so a signed-in customer who guesses another customer's token can
 * view the read-only "prepared for another customer" banner but never accept or pay it -- no extra
 * scoping needed here beyond passing the real session's `ctx`.
 */
export default async function QuotePage({ params }: PageProps) {
  const { token } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/auth/login?next=/quote/${token}`);
  }

  const ctx = await getSiteRequestContext();
  const [quoteResult, profileResult] = await Promise.all([
    getQuoteQuery({ token }, ctx),
    getMyProfileQuery({}, ctx),
  ]);

  if (!quoteResult.ok) {
    if (quoteResult.error.code === ErrorCode.NOT_FOUND) {
      notFound();
    }
    throw new Error(quoteResult.error.message);
  }

  const view = quoteResult.data;
  const billing = profileResult.ok
    ? mapProfileToBilling(profileResult.data.user, profileResult.data.profile)
    : defaultBilling(session.user.email);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
      <QuoteScreen
        quote={{ ...mapQuoteView(view, { customerEmail: session.user.email }), token }}
        billing={billing}
        customerEmail={session.user.email}
        canAccept={view.canAccept}
        now={new Date().toISOString()}
        links={{
          newQuery: "/account/queries",
          switchAccount: "/auth/login",
          dashboard: "/account/purchases",
        }}
      />
    </div>
  );
}

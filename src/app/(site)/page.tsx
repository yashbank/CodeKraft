import { getDisplayCurrency } from "@/lib/display-currency";
import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";
import { getSiteName } from "@/lib/site-brand";
import { LandingView } from "./_views/landing";

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  const title = `${siteName} — Architected for scale. Crafted for production.`;
  return {
    ...pageMetadata({
      path: "/",
      title,
      description:
        "We design and build bespoke software architectures, digital products, and robust enterprise solutions.",
    }),
    title: { absolute: title },
  };
}

// Visitors with a currency cookie or a session land here (per-user prices); everyone else is
// rewritten by middleware to the static twin at ./ssg (docs/08 §10).
export const dynamic = "force-dynamic";

export default async function LandingRoute() {
  const { currency } = await getDisplayCurrency();
  return <LandingView currency={currency} />;
}

import { getEnabledCurrencies } from "@/lib/display-currency";

import { LandingView } from "../_views/landing";

export { generateMetadata } from "../page";

// ISR twin of `/` for visitors with no currency cookie and no session (middleware rewrites to it):
// the base currency is exactly what they would get, so the page can be cached at the edge.
// Every admin save calls revalidatePath("/", "layout"); the window covers out-of-request writes
// (scheduled publish job).
export const revalidate = 300;

export default async function StaticLandingRoute() {
  const { base } = await getEnabledCurrencies();
  return <LandingView currency={base} />;
}

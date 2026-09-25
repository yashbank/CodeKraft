import { ContactPage } from "@/components/site/ContactPage";

import { SERVICE_OPTIONS } from "../../_fixtures/site";
import { readState, SitePreview, type SearchParams } from "../_shared";

export const metadata = { title: "SCR-SITE-09 Contact" };

const STATES = [
  { id: "default", label: "Default" },
  { id: "success", label: "Success" },
  { id: "error", label: "Server error" },
  { id: "turnstile_down", label: "Turnstile outage" },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams);
  const initialStatus =
    state === "success" || state === "error" || state === "turnstile_down" ? state : "idle";
  return (
    <SitePreview
      href="/dev/screens/site/contact"
      states={STATES}
      current={state}
      currentPath="/contact"
    >
      <ContactPage key={state} serviceOptions={SERVICE_OPTIONS} initialStatus={initialStatus} />
    </SitePreview>
  );
}

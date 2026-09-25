import { ServicesPage } from "@/components/site/ServicesPage";

import { SERVICE_OPTIONS, SERVICES } from "../../_fixtures/site";
import { readState, SitePreview, type SearchParams } from "../_shared";

export const metadata = { title: "SCR-SITE-02 Services" };

const STATES = [
  { id: "default", label: "Default" },
  { id: "empty", label: "No services" },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams);
  return (
    <SitePreview
      href="/dev/screens/site/services"
      states={STATES}
      current={state}
      currentPath="/services"
    >
      <ServicesPage services={state === "empty" ? [] : SERVICES} serviceOptions={SERVICE_OPTIONS} />
    </SitePreview>
  );
}

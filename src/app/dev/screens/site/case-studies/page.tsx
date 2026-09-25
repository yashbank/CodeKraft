import { CaseStudiesPage } from "@/components/site/CaseStudiesPage";

import { CASE_STUDIES, CLIENT_LOGOS, SERVICE_OPTIONS } from "../../_fixtures/site";
import { readState, SitePreview, type SearchParams } from "../_shared";

export const metadata = { title: "SCR-SITE-05 Case studies" };

const STATES = [
  { id: "default", label: "Default" },
  { id: "loading", label: "Loading" },
  { id: "empty", label: "Empty" },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams);
  return (
    <SitePreview
      href="/dev/screens/site/case-studies"
      states={STATES}
      current={state}
      currentPath="/projects"
    >
      <CaseStudiesPage
        key={state}
        studies={state === "empty" ? [] : CASE_STUDIES}
        logos={CLIENT_LOGOS}
        serviceOptions={SERVICE_OPTIONS}
        loading={state === "loading"}
      />
    </SitePreview>
  );
}

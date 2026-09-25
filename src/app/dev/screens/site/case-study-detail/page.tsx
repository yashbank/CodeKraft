import { CaseStudyDetailPage } from "@/components/site/CaseStudyDetailPage";
import type { CaseStudy } from "@/components/site/types";

import { CASE_STUDIES, SERVICE_OPTIONS } from "../../_fixtures/site";
import { readState, SitePreview, type SearchParams } from "../_shared";

export const metadata = { title: "SCR-SITE-06 Case study detail" };

const STATES = [
  { id: "default", label: "Default" },
  { id: "confidential", label: "Confidential, no gallery" },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams);
  const [first, second, third] = CASE_STUDIES as [CaseStudy, CaseStudy, CaseStudy];
  const study = state === "confidential" ? third : first;
  return (
    <SitePreview
      href="/dev/screens/site/case-study-detail"
      states={STATES}
      current={state}
      currentPath="/projects"
    >
      <CaseStudyDetailPage
        key={state}
        study={study}
        serviceOptions={SERVICE_OPTIONS}
        prev={{
          href: `/projects/${second.slug}`,
          title: second.title,
          eyebrow: "Previous project",
        }}
        next={
          state === "confidential"
            ? undefined
            : { href: `/projects/${third.slug}`, title: third.title, eyebrow: "Next project" }
        }
      />
    </SitePreview>
  );
}

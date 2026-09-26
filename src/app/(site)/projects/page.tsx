import type { Metadata } from "next";
import { CaseStudiesPage } from "@/components/site/CaseStudiesPage";
import { CASE_STUDIES, CLIENT_LOGOS, SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";

export const metadata: Metadata = {
  title: "Case Studies & Projects — Delivered Engineering Work | CodeKraft",
  description:
    "Explore case studies, client systems, and custom architectures engineered and shipped by CodeKraft.",
};

export default function ProjectsRoute() {
  return (
    <CaseStudiesPage
      studies={CASE_STUDIES}
      logos={CLIENT_LOGOS}
      serviceOptions={SERVICE_OPTIONS}
      intro="A selection of client platforms, SaaS products, and custom software systems designed and delivered by CodeKraft."
    />
  );
}

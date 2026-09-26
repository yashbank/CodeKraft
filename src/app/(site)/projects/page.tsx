import type { Metadata } from "next";

import { anonymousContext } from "@/lib/authz/context";
import { toneFromSlug } from "@/lib/media-tone";
import {
  listCaseStudiesQuery,
  listClientLogosQuery,
  listServicesQuery,
} from "@/modules/content/queries";
import { CaseStudiesPage } from "@/components/site/CaseStudiesPage";
import type { CaseStudySummary, ClientLogo, ServiceOption } from "@/components/site/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Case Studies & Projects — Delivered Engineering Work | CodeKraft",
  description:
    "Explore case studies, client systems, and custom architectures engineered and shipped by CodeKraft.",
};

export default async function ProjectsRoute() {
  const ctx = anonymousContext();
  const [studiesResult, logosResult, servicesResult] = await Promise.all([
    listCaseStudiesQuery({ limit: 50 }, ctx),
    listClientLogosQuery({}, ctx),
    listServicesQuery({}, ctx),
  ]);

  const rows = studiesResult.ok ? studiesResult.data.items : [];
  const studies: CaseStudySummary[] = rows.map((c) => ({
    slug: c.slug,
    title: c.title,
    client: c.clientName ?? undefined,
    industry: c.industry ?? "",
    techStack: c.techStack,
    resultHighlight: c.resultHighlight ?? "",
    publishedAt: c.publishedAt ?? "",
    coverAlt: c.cover?.alt ?? c.title,
    coverTone: toneFromSlug(c.slug),
  }));

  const logoRows = logosResult.ok ? logosResult.data : [];
  const logos: ClientLogo[] = logoRows.map((l) => ({ id: l.id, name: l.name }));

  const serviceRows = servicesResult.ok ? servicesResult.data : [];
  const serviceOptions: ServiceOption[] = serviceRows.map((s) => ({ slug: s.slug, title: s.title }));

  return (
    <CaseStudiesPage
      studies={studies}
      logos={logos}
      serviceOptions={serviceOptions}
      intro="A selection of client platforms, SaaS products, and custom software systems designed and delivered by CodeKraft."
    />
  );
}

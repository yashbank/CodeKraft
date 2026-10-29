import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/JsonLd";
import { articleLd, breadcrumbLd, NOINDEX, pageMetadata } from "@/lib/seo";
import { anonymousContext } from "@/lib/authz/context";
import { toneFromSlug } from "@/lib/media-tone";
import {
  getCaseStudyBySlugQuery,
  listCaseStudiesQuery,
  listServicesQuery,
} from "@/modules/content/queries";
import { CaseStudyDetailPage } from "@/components/site/CaseStudyDetailPage";
import type { CaseStudy, MediaItem, ServiceOption } from "@/components/site/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const result = await getCaseStudyBySlugQuery({ slug: params.slug }, anonymousContext());
  if (!result.ok) return { title: "Project Not Found", robots: NOINDEX };

  return pageMetadata({
    path: `/projects/${params.slug}`,
    title: result.data.seo.title || result.data.title,
    description: result.data.seo.description || result.data.resultHighlight,
    type: "article",
  });
}

export default async function ProjectDetailRoute(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const ctx = anonymousContext();

  const [studyResult, listResult, servicesResult] = await Promise.all([
    getCaseStudyBySlugQuery({ slug: params.slug }, ctx),
    listCaseStudiesQuery({ limit: 100 }, ctx),
    listServicesQuery({}, ctx),
  ]);

  if (!studyResult.ok) notFound();
  const s = studyResult.data;

  const gallery: MediaItem[] = s.gallery.map((g) => ({
    id: g.mediaId,
    kind: "gallery",
    alt: g.alt,
    url: g.url || undefined,
    ...(g.caption ? { caption: g.caption } : {}),
  }));

  const study: CaseStudy = {
    slug: s.slug,
    title: s.title,
    client: s.clientName ?? undefined,
    industry: s.industry ?? "",
    techStack: s.techStack,
    resultHighlight: s.resultHighlight ?? "",
    publishedAt: s.publishedAt ?? "",
    coverAlt: s.cover?.alt ?? s.title,
    coverUrl: s.cover?.url || undefined,
    coverTone: toneFromSlug(s.slug),
    problemHtml: s.problemHtml,
    solutionHtml: s.solutionHtml,
    resultsHtml: s.resultsHtml,
    metrics: s.resultHighlight ? [{ label: "Result", value: s.resultHighlight }] : [],
    gallery,
  };

  const serviceRows = servicesResult.ok ? servicesResult.data : [];
  const serviceOptions: ServiceOption[] = serviceRows.map((sv) => ({
    slug: sv.slug,
    title: sv.title,
  }));

  const items = listResult.ok ? listResult.data.items : [];
  const currentIndex = items.findIndex((c) => c.slug === params.slug);
  const prevItem = currentIndex > 0 ? items[currentIndex - 1] : undefined;
  const nextItem =
    currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : undefined;

  return (
    <>
      <JsonLd
        data={[
          articleLd({
            type: "Article",
            path: `/projects/${s.slug}`,
            title: s.title,
            description: s.seo.description || s.resultHighlight,
            image: s.cover?.url,
            datePublished: s.publishedAt,
          }),
          breadcrumbLd([
            { name: "Projects", path: "/projects" },
            { name: s.title, path: `/projects/${s.slug}` },
          ]),
        ]}
      />
      <CaseStudyDetailPage
        study={study}
        serviceOptions={serviceOptions}
        prev={prevItem ? { title: prevItem.title, href: `/projects/${prevItem.slug}` } : undefined}
        next={nextItem ? { title: nextItem.title, href: `/projects/${nextItem.slug}` } : undefined}
      />
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudyDetailPage } from "@/components/site/CaseStudyDetailPage";
import { CASE_STUDIES, SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";

export function generateStaticParams() {
  return CASE_STUDIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const study = CASE_STUDIES.find((c) => c.slug === params.slug);
  if (!study) return { title: "Project Not Found | CodeKraft" };

  return {
    title: `${study.title} — Case Study | CodeKraft`,
    description: study.resultHighlight,
  };
}

export default async function ProjectDetailRoute(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const study = CASE_STUDIES.find((c) => c.slug === params.slug);

  if (!study) {
    notFound();
  }

  const currentIndex = CASE_STUDIES.findIndex((c) => c.slug === params.slug);
  const prevStudy = currentIndex > 0 ? CASE_STUDIES[currentIndex - 1] : undefined;
  const nextStudy = currentIndex < CASE_STUDIES.length - 1 ? CASE_STUDIES[currentIndex + 1] : undefined;

  return (
    <CaseStudyDetailPage
      study={study}
      serviceOptions={SERVICE_OPTIONS}
      prev={prevStudy ? { title: prevStudy.title, href: `/projects/${prevStudy.slug}` } : undefined}
      next={nextStudy ? { title: nextStudy.title, href: `/projects/${nextStudy.slug}` } : undefined}
    />
  );
}

import type { Metadata } from "next";
import { LandingPage } from "@/components/site/landing/LandingPage";
import type { LandingContent, ServiceOption } from "@/components/site/types";

const CLEAN_LANDING: LandingContent = {
  who: {
    eyebrow: "Software Engineering & Digital Products",
    title: "Architected for scale. Crafted for production.",
    subtitle:
      "We design and build bespoke software architectures, digital products, and robust enterprise solutions.",
  },
  build: {
    eyebrow: "Services & Engineering",
    title: "Custom engineering for modern businesses",
    body: "From scalable web platforms to specialized workflow automations, we deliver software built to perform.",
  },
  sell: {
    eyebrow: "Digital Products",
    title: "Production-ready software components",
    body: "Pre-built modules and systems ready for instant deployment.",
  },
  proof: {
    eyebrow: "Quality & Craft",
    title: "Engineered to the highest standards",
    body: "Built with modern frameworks, rigorous test suites, and strict performance metrics.",
    stats: [],
  },
  talk: {
    eyebrow: "Start a Project",
    title: "Let's build something great together",
    body: "Tell us about your requirements, timeline, and goals. We'll get back to you promptly.",
  },
};

const SERVICE_OPTIONS: ServiceOption[] = [
  { slug: "custom-development", name: "Custom Software Development" },
  { slug: "architecture-consulting", name: "System Architecture Consulting" },
  { slug: "fullstack-application", name: "Full-Stack Web Platform" },
  { slug: "api-integrations", name: "API & Backend Integrations" },
];

export default function HomePage() {
  return (
    <LandingPage
      content={CLEAN_LANDING}
      services={[]}
      featuredProducts={[]}
      caseStudies={[]}
      testimonials={[]}
      logos={[]}
      blogTeasers={[]}
      serviceOptions={SERVICE_OPTIONS}
    />
  );
}

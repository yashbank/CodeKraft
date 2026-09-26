import type { Metadata } from "next";
import { ServicesPage } from "@/components/site/ServicesPage";
import { SERVICE_OPTIONS, SERVICES } from "@/app/dev/screens/_fixtures/site";

export const metadata: Metadata = {
  title: "Services — Custom Web Applications & Platform Engineering | CodeKraft",
  description:
    "End-to-end custom engineering, software architecture, and full-stack development. Scoped, built, and delivered.",
};

export default function ServicesRoute() {
  return (
    <ServicesPage
      services={SERVICES}
      serviceOptions={SERVICE_OPTIONS}
      intro="We design and build production-grade web applications, digital products, and cloud architectures for ambitious teams."
    />
  );
}

import type { Metadata } from "next";

import { anonymousContext } from "@/lib/authz/context";
import { listServicesQuery } from "@/modules/content/queries";
import { ServicesPage } from "@/components/site/ServicesPage";
import type { Service, ServiceIconName, ServiceOption } from "@/components/site/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Services — Custom Web Applications & Platform Engineering | CodeKraft",
  description:
    "End-to-end custom engineering, software architecture, and full-stack development. Scoped, built, and delivered.",
};

const SERVICE_ICON_NAMES = new Set<ServiceIconName>([
  "layout",
  "smartphone",
  "cloud",
  "globe",
  "pen-tool",
  "sparkles",
  "wrench",
  "compass",
]);

/** DB `icon` is free text (docs/05 §10); fall back to a safe default for anything ServiceIcon can't render. */
function toServiceIcon(icon: string | null): ServiceIconName {
  return icon && SERVICE_ICON_NAMES.has(icon as ServiceIconName) ? (icon as ServiceIconName) : "sparkles";
}

export default async function ServicesRoute() {
  const result = await listServicesQuery({}, anonymousContext());
  const rows = result.ok ? result.data : [];

  const services: Service[] = rows.map((s) => ({
    slug: s.slug,
    title: s.title,
    summary: s.summary ?? "",
    icon: toServiceIcon(s.icon),
    deliverables: s.deliverables,
    bodyHtml: s.html,
  }));

  const serviceOptions: ServiceOption[] = services.map((s) => ({ slug: s.slug, title: s.title }));

  return (
    <ServicesPage
      services={services}
      serviceOptions={serviceOptions}
      intro="We design and build production-grade web applications, digital products, and cloud architectures for ambitious teams."
    />
  );
}

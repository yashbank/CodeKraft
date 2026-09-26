import type { Metadata } from "next";

import { SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";
import { ContactPage } from "@/components/site/ContactPage";

export const metadata: Metadata = {
  title: "Contact & Start a Project — CodeKraft",
  description:
    "Tell us what you're building. Fixed-scope proposals, fast turnaround, and enterprise-grade software.",
};

export default function ContactPageRoute() {
  return (
    <ContactPage
      serviceOptions={SERVICE_OPTIONS}
      trustLines={[
        "Fixed-scope proposals with guaranteed deliverables",
        "Direct communication with senior engineers",
        "Mutual non-disclosure agreements upfront",
        "Clean IP assignment and documentation on delivery",
      ]}
    />
  );
}

import {
  CloudIcon,
  DownloadIcon,
  KeyRoundIcon,
  ServerIcon,
  SparklesIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

import type { DeliveryType } from "./types";

export const DELIVERY_ICONS: Record<DeliveryType, LucideIcon> = {
  saas: CloudIcon,
  hosted: ServerIcon,
  download: DownloadIcon,
  license: KeyRoundIcon,
  service: WrenchIcon,
  custom: SparklesIcon,
};

export const DELIVERY_LABELS: Record<DeliveryType, string> = {
  saas: "SaaS",
  hosted: "Hosted",
  download: "Download",
  license: "License",
  service: "Product + service",
  custom: "Custom",
};

/** Primary action label per delivery type (SCR-ACC-01 "Your products"). */
export function primaryActionLabel(type: DeliveryType, subscription: boolean): string {
  if (subscription) return "Manage subscription";
  switch (type) {
    case "download":
      return "Download";
    case "license":
      return "Reveal key";
    case "saas":
    case "hosted":
      return "Open instructions";
    case "service":
      return "View progress";
    case "custom":
      return "Open instructions";
  }
}

export function DeliveryTypeIcon({ type, className }: { type: DeliveryType; className?: string }) {
  const Icon = DELIVERY_ICONS[type];
  return <Icon aria-hidden className={className ?? "size-4"} />;
}

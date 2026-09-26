import type { ServiceIconName } from "@/components/site/types";

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

/** DB `services.icon` is free text (docs/05 §10, lucide icon name); fall back to a safe default
 * for anything `ServiceIcon` (src/components/site/ServiceIcon.tsx) can't render. */
export function toServiceIcon(icon: string | null): ServiceIconName {
  return icon && SERVICE_ICON_NAMES.has(icon as ServiceIconName) ? (icon as ServiceIconName) : "sparkles";
}

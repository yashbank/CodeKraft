import { SystemPage, type SystemPageVariant } from "@/components/site/SystemPage";

import { readState, SitePreview, type SearchParams } from "../_shared";

export const metadata = { title: "SCR-SITE-11 System pages" };

const STATES: { id: SystemPageVariant; label: string }[] = [
  { id: "not_found", label: "404 site" },
  { id: "product_not_found", label: "404 product" },
  { id: "error", label: "error.tsx" },
  { id: "forbidden_admin", label: "403 admin" },
  { id: "offline", label: "Offline" },
  { id: "maintenance", label: "Maintenance" },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams, "not_found");
  const variant = (STATES.find((s) => s.id === state)?.id ?? "not_found") as SystemPageVariant;
  return (
    <SitePreview href="/dev/screens/site/system?state=not_found" states={STATES} current={variant}>
      <SystemPage
        key={variant}
        variant={variant}
        reference={variant === "error" ? "a1b2c3d4e5f6" : undefined}
        ownedHref={variant === "product_not_found" ? "/account/purchases/ent_123" : undefined}
        message={
          variant === "maintenance"
            ? "Upgrading the payments service — back by 02:30 IST."
            : undefined
        }
      />
    </SitePreview>
  );
}

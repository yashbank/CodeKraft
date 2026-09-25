import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Banner } from "./Banner";
import { DELIVERY_LABELS, DeliveryTypeIcon } from "./DeliveryTypeIcon";
import { DownloadPanel } from "./delivery/DownloadPanel";
import { HostedPanel } from "./delivery/HostedPanel";
import { InstructionsBlock } from "./delivery/InstructionsBlock";
import { LicensePanel } from "./delivery/LicensePanel";
import { ServicePanel } from "./delivery/ServicePanel";
import { formatDate } from "./format";
import { ProductCover } from "./ProductCover";
import { SubscriptionCard } from "./SubscriptionCard";
import type { EntitlementDetail } from "./types";

const UPDATE_POLICY_COPY = {
  all_free: "All updates included, for life.",
  during_access: "Updates included while your access is active.",
  major_paid: "Minor updates included; major versions are paid upgrades.",
} as const;

export interface EntitlementDetailScreenProps {
  entitlement: EntitlementDetail;
  links: {
    purchases: string;
    order: string;
    invoice?: string;
    newQuery: string;
    renew: string;
  };
  loading?: boolean;
}

/**
 * SCR-ACC-03 — entitlement detail: header card, delivery panel per type (8/12), details card and
 * subscription card (4/12). Phone: details collapse into an accordion under the panel.
 */
export function EntitlementDetailScreen({
  entitlement: e,
  links,
  loading = false,
}: EntitlementDetailScreenProps) {
  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-32" />
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-72 lg:col-span-8" />
          <Skeleton className="h-72 lg:col-span-4" />
        </div>
      </div>
    );
  }

  const ended = e.status === "expired" || e.status === "revoked";

  const panel = ended ? (
    <Banner
      tone={e.status === "revoked" ? "danger" : "neutral"}
      title={
        e.status === "revoked"
          ? "Access revoked"
          : `Access ended on ${e.accessEndsAt ? formatDate(e.accessEndsAt) : "—"}`
      }
      action={
        e.status === "expired" ? (
          <Button size="sm" asChild>
            <Link href={links.renew}>{e.subscription ? "Renew" : "Buy again"}</Link>
          </Button>
        ) : (
          <Button size="sm" variant="secondary" asChild>
            <Link href={links.newQuery}>Contact support</Link>
          </Button>
        )
      }
    >
      {e.status === "revoked"
        ? "This purchase was revoked. Open a query if you think this is a mistake."
        : "Renew to restore downloads, keys and updates."}
    </Banner>
  ) : (
    <>
      {e.deliveryType === "download" ? (
        <DownloadPanel
          files={e.files ?? []}
          changelog={e.changelog}
          downloadsUsed={e.downloadsUsed ?? 0}
          downloadsCap={e.downloadsCap ?? 0}
          queryHref={links.newQuery}
        />
      ) : null}
      {e.deliveryType === "license" ? <LicensePanel licenseKey={e.licenseKey} /> : null}
      {e.deliveryType === "saas" || e.deliveryType === "hosted" ? (
        <HostedPanel
          productName={e.productName}
          provisioningState={e.provisioningState}
          hosted={e.hosted}
        />
      ) : null}
      {e.deliveryType === "service" ? <ServicePanel steps={e.steps ?? []} /> : null}
      {e.deliveryType === "custom" ? (
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h3 text-fg">Custom delivery</h2>
          <StatusBadge kind="entitlements.status" value={e.status} />
        </div>
      ) : null}
      <InstructionsBlock paragraphs={e.instructions} attachments={e.attachments} />
    </>
  );

  const details = (
    <dl className="grid gap-2.5 text-body-sm">
      <Row label="Purchased on" value={formatDate(e.purchasedAt)} />
      <Row label="Access period" value={e.accessLabel} />
      <Row label="Update policy" value={UPDATE_POLICY_COPY[e.updatePolicy]} />
      {e.versionOwned ? <Row label="Version owned" value={e.versionOwned} /> : null}
      {e.licenseType ? <Row label="License type" value={e.licenseType} /> : null}
      <Row
        label="Order"
        value={
          <Link href={links.order} className="font-mono text-accent-text hover:underline">
            {e.orderNumber}
          </Link>
        }
      />
      {e.invoiceNumber ? (
        <Row
          label="Invoice"
          value={
            <Link
              href={links.invoice ?? "#"}
              className="font-mono text-accent-text hover:underline"
            >
              {e.invoiceNumber}
            </Link>
          }
        />
      ) : null}
    </dl>
  );

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-body-sm text-fg-muted">
          <li>
            <Link href={links.purchases} className="hover:text-fg">
              Purchases
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <ChevronRightIcon aria-hidden className="size-3.5" />
            <span aria-current="page" className="font-medium text-fg">
              {e.productName}
            </span>
          </li>
        </ol>
      </nav>

      {e.status === "suspended" ? (
        <Banner
          tone="warning"
          title="Suspended — pay your renewal to restore access"
          action={
            <Button size="sm" asChild>
              <Link href={links.renew}>Renew</Link>
            </Button>
          }
        />
      ) : null}

      <header className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-1 sm:flex-row sm:items-start">
        <ProductCover name={e.productName} className="size-20" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h2 text-fg">
              {e.productHref ? (
                <Link href={e.productHref} className="hover:underline">
                  {e.productName}
                </Link>
              ) : (
                e.productName
              )}
            </h1>
            <StatusBadge kind="entitlements.status" value={e.status} />
          </div>
          <p className="text-body text-fg-muted">{e.offeringName}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <DeliveryTypeIcon type={e.deliveryType} className="size-3.5" />
              {DELIVERY_LABELS[e.deliveryType]}
            </span>
            <span>{e.accessLabel}</span>
            <Link href={links.order} className="font-mono text-accent-text hover:underline">
              {e.orderNumber}
            </Link>
            <Link href={links.newQuery} className="text-accent-text hover:underline">
              Need help? Open a query
            </Link>
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">{panel}</div>
        <aside className="space-y-4 lg:col-span-4">
          <Card className="hidden gap-4 py-5 lg:flex">
            <CardHeader className="px-5">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="px-5">{details}</CardContent>
          </Card>
          <Accordion
            type="single"
            collapsible
            className="rounded-lg border border-border bg-surface px-4 lg:hidden"
          >
            <AccordionItem value="details" className="border-b-0">
              <AccordionTrigger className="text-body font-semibold">Details</AccordionTrigger>
              <AccordionContent>{details}</AccordionContent>
            </AccordionItem>
          </Accordion>
          {e.subscription ? (
            <SubscriptionCard subscription={e.subscription} renewHref={links.renew} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );
}

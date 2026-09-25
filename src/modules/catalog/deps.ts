/**
 * Catalog service dependencies. Every port is an interface so unit tests inject fakes; the defaults
 * resolve sibling services lazily by export name (P3 modules land concurrently — see
 * `modules/approvals/default-deps.ts`) and degrade explicitly when a sibling is still a stub.
 */
import { and, eq } from "drizzle-orm";
import type { Context } from "@/lib/authz/context";
import type { DbOrTx, TxCtx, TxRunner } from "@/lib/db";
import { getFxProvider } from "@/lib/fx";
import { moduleLogger } from "@/lib/logger";
import type { Currency } from "@/lib/money";
import type { AnalyticsService } from "@/modules/analytics/contracts";
import type { ApprovalsService } from "@/modules/approvals/contracts";
import {
  type AuditPort,
  type NotificationsPort,
  isNotImplemented,
  lazyAuditService,
  lazyNotificationsService,
  resolveSibling,
} from "@/modules/approvals/default-deps";
import type { MediaService } from "@/modules/media/contracts";
import type { OfferingsService } from "@/modules/offerings/contracts";
import type { RateLookup } from "@/modules/offerings/pricing";
import type { OwnershipService } from "@/modules/ownership/contracts";
import type { SettingsService } from "@/modules/settings/contracts";
import type { Media } from "../../../drizzle/schema/media";
import { entitlements } from "../../../drizzle/schema/delivery";
import { type Revalidate, nextRevalidate } from "./cache";

export type MediaUrlResolver = (
  media: Pick<Media, "id" | "bucket" | "objectKey" | "visibility">,
  purpose?: "product_presentation",
) => Promise<string>;

export interface CatalogReadDeps {
  /** Site base currency (D-502); default `settings.load().baseCurrency`, else `INR`. */
  baseCurrency: (db: DbOrTx) => Promise<Currency>;
  /** FX rate `1 base = rate quote` as a decimal string; `null` when unavailable. */
  rate: RateLookup;
  mediaUrl: MediaUrlResolver;
  /** Whether `userId` holds an active entitlement for the product (unpublished visibility, API-CAT-31). */
  hasEntitlement: (userId: string, productId: string, db: DbOrTx) => Promise<boolean>;
  offerings: Pick<OfferingsService, "listForProduct">;
  ownership?: Pick<OwnershipService, "createInitial" | "listVersions" | "summaryFor">;
}

export interface CatalogDeps extends CatalogReadDeps {
  audit: AuditPort;
  notifications: NotificationsPort;
  approvals: Pick<ApprovalsService, "request">;
  analytics?: Pick<AnalyticsService, "recordServerEvent">;
  revalidate: Revalidate;
  /** Knowledge re-index port (P3.13); optional until it lands. */
  reindex?: (productId: string, tx: TxCtx) => Promise<void>;
  db?: DbOrTx;
  txRunner?: TxRunner;
  now?: () => Date;
}

const log = moduleLogger("catalog.deps");

export const defaultBaseCurrency: CatalogReadDeps["baseCurrency"] = async (db) => {
  const settings = await resolveSibling<SettingsService>(
    () => import("@/modules/settings/service"),
    "settingsService",
  );
  if (settings !== undefined) {
    try {
      return (await settings.load(db)).baseCurrency;
    } catch (err) {
      if (!isNotImplemented(err)) throw err;
    }
  }
  return "INR";
};

export const defaultRate: RateLookup = async (base, quote) => {
  if (base === quote) return null;
  try {
    return (await getFxProvider().getRate(base, quote)).rate;
  } catch (err) {
    log.warn({ err, base, quote }, "fx rate unavailable; showing base prices");
    return null;
  }
};

export const defaultMediaUrl: MediaUrlResolver = async (media, purpose) => {
  const service = await resolveSibling<MediaService>(
    () => import("@/modules/media/service"),
    "mediaService",
  );
  if (service !== undefined) {
    try {
      return await service.urlFor(media, purpose);
    } catch (err) {
      if (!isNotImplemented(err)) throw err;
    }
  }
  if (media.visibility !== "public") return "";
  const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/${media.objectKey}`;
};

export const defaultHasEntitlement: CatalogReadDeps["hasEntitlement"] = async (
  userId,
  productId,
  db,
) => {
  const [row] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.productId, productId),
        eq(entitlements.status, "active"),
      ),
    )
    .limit(1);
  return row !== undefined;
};

/** Lazy `ownership` port: only the members the catalog uses; absent until P3.8 exports `ownershipService`. */
export function lazyOwnership(): NonNullable<CatalogDeps["ownership"]> {
  const load = () =>
    resolveSibling<OwnershipService>(() => import("@/modules/ownership/service"), "ownershipService");
  const guard = async <T>(fn: (s: OwnershipService) => Promise<T>, fallback: T): Promise<T> => {
    const s = await load();
    if (s === undefined) return fallback;
    try {
      return await fn(s);
    } catch (err) {
      if (isNotImplemented(err)) return fallback;
      throw err;
    }
  };
  return {
    createInitial: (productId, partnerId, tx) =>
      guard((s) => s.createInitial(productId, partnerId, tx), undefined),
    listVersions: (ctx, input, tx) =>
      guard((s) => s.listVersions(ctx, input, tx), { items: [], nextCursor: null }),
    summaryFor: (ids, tx) => guard((s) => s.summaryFor(ids, tx), new Map()),
  };
}

export function lazyAnalytics(): NonNullable<CatalogDeps["analytics"]> {
  return {
    async recordServerEvent(event, tx) {
      const s = await resolveSibling<AnalyticsService>(
        () => import("@/modules/analytics/service"),
        "analyticsService",
      );
      if (s === undefined) return;
      try {
        await s.recordServerEvent(event, tx);
      } catch (err) {
        if (!isNotImplemented(err)) log.warn({ err, name: event.name }, "analytics event failed");
      }
    },
  };
}

export function defaultCatalogDeps(offerings: Pick<OfferingsService, "listForProduct">, approvals: Pick<ApprovalsService, "request">): CatalogDeps {
  return {
    audit: lazyAuditService(),
    notifications: lazyNotificationsService(),
    approvals,
    offerings,
    ownership: lazyOwnership(),
    analytics: lazyAnalytics(),
    baseCurrency: defaultBaseCurrency,
    rate: defaultRate,
    mediaUrl: defaultMediaUrl,
    hasEntitlement: defaultHasEntitlement,
    revalidate: nextRevalidate,
  };
}

export type { Context };

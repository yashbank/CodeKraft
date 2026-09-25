/**
 * `offerings` service (PHASE-03 P3.7) — docs/06 API-CAT-03/04/05, D-110, D-502, D-408,
 * MASTER_SPEC §4.2 (prices live on offerings, never products). Implements the frozen
 * `OfferingsService` contract exactly.
 *
 * Rules: `subscription` needs `billingInterval` and `service` needs ≥ 1 step (Zod); `automated`
 * provisioning needs the `automated_provisioning` flag; an offering is saved `active` only with a
 * base-currency price row (custom quotes excepted); gateway payment methods need their
 * `provider_*` flag and the settings toggle; delete is a hard delete only with zero `order_items`.
 */
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { type DbOrTx, type TxCtx, type TxRunner, db as defaultDb, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { type FlagKey, getFlag } from "@/lib/feature-flags";
import { CURRENCIES, type Currency } from "@/lib/money";
import { type AuditPort, isNotImplemented, lazyAuditService, resolveSibling } from "@/modules/approvals/default-deps";
import { isUniqueViolation } from "@/modules/approvals/pg-errors";
import { type Revalidate, nextRevalidate, productTags } from "@/modules/catalog/cache";
import { defaultBaseCurrency, defaultRate } from "@/modules/catalog/deps";
import { loadProductForWrite } from "@/modules/catalog/scope";
import { OFFERINGS_CACHE_TAGS, type OfferingsService } from "./contracts";
import type { SettingsService } from "@/modules/settings/contracts";
import { orderItems } from "../../../drizzle/schema/commerce";
import { products } from "../../../drizzle/schema/catalog";
import {
  type Offering,
  type OfferingPrice,
  offeringPaymentMethods,
  offeringPrices,
  offerings,
} from "../../../drizzle/schema/offerings";
import { type RateLookup, resolvePrice, toPriceViews } from "./pricing";
import { MANUAL_PAYMENT_METHODS, type OfferingView, type PaymentMethodValue } from "./types";

export interface OfferingsDeps {
  audit: AuditPort;
  revalidate: Revalidate;
  baseCurrency: (db: DbOrTx) => Promise<Currency>;
  rate: RateLookup;
  /** Currencies an offering may be priced in (settings `enabled_currencies`); default all five. */
  enabledCurrencies: (db: DbOrTx) => Promise<readonly Currency[]>;
  /** Methods switched on in settings (`enabled_payment_methods`); default the manual ones. */
  enabledPaymentMethods: (db: DbOrTx) => Promise<readonly PaymentMethodValue[]>;
  flag: (key: FlagKey) => Promise<boolean>;
  db?: DbOrTx;
  txRunner?: TxRunner;
  now?: () => Date;
}

const GATEWAY_FLAG: Partial<Record<PaymentMethodValue, FlagKey>> = {
  razorpay: "provider_razorpay",
  stripe: "provider_stripe",
  paypal: "provider_paypal",
};

function validation(field: string, message: string): AppError {
  return new AppError(ErrorCode.VALIDATION, message, { fieldErrors: { [field]: [message] } });
}

export function toOfferingView(
  row: Offering,
  prices: readonly OfferingPrice[],
  methods: readonly PaymentMethodValue[],
  baseCurrency: Currency,
  displayCurrency: Currency,
  rate: string | null,
): OfferingView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    position: row.position,
    isDefault: row.isDefault,
    purchaseModel: row.purchaseModel,
    billingInterval: row.billingInterval,
    trialDays: row.trialDays,
    licenseType: row.licenseType,
    deliveryType: row.deliveryType,
    deliveryConfig: row.deliveryConfig,
    serviceSteps: row.serviceSteps,
    instructions: row.instructionsJson,
    status: row.status,
    price: resolvePrice(prices, baseCurrency, displayCurrency, rate),
    prices: toPriceViews(prices),
    paymentMethods: [...methods],
  };
}

export function createOfferingsService(deps: OfferingsDeps): OfferingsService {
  const readDb = (): DbOrTx => deps.db ?? defaultDb;
  const now = deps.now ?? (() => new Date());
  const run = <T>(fn: (tx: TxCtx) => Promise<T>, tx?: DbOrTx) =>
    withTx(fn, tx as TxCtx | undefined, deps.txRunner);

  async function lockOffering(offeringId: string, tx: TxCtx): Promise<Offering> {
    const [row] = await tx.select().from(offerings).where(eq(offerings.id, offeringId)).for("update");
    if (row === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Offering not found.");
    return row;
  }

  async function hasBasePrice(offeringId: string, db: DbOrTx): Promise<boolean> {
    const base = await deps.baseCurrency(db);
    const [row] = await db
      .select({ c: offeringPrices.currency })
      .from(offeringPrices)
      .where(and(eq(offeringPrices.offeringId, offeringId), eq(offeringPrices.currency, base)))
      .limit(1);
    return row !== undefined;
  }

  async function revalidateFor(productId: string, tags: readonly string[], db: DbOrTx) {
    const [p] = await db
      .select({ slug: products.slug, status: products.status })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (p === undefined || p.status !== "published") return;
    await deps.revalidate(productTags(tags, p.slug));
  }

  return {
    upsertOffering(ctx, input, tx) {
      return run(async (t) => {
        await loadProductForWrite(ctx, input.productId, t);
        if (input.deliveryConfig.provisioning === "automated" && !(await deps.flag("automated_provisioning"))) {
          throw validation(
            "deliveryConfig.provisioning",
            "Automated provisioning is not enabled (feature flag `automated_provisioning`).",
          );
        }
        const existing = input.offeringId === undefined ? undefined : await lockOffering(input.offeringId, t);
        if (existing !== undefined && existing.productId !== input.productId) {
          throw new AppError(ErrorCode.NOT_FOUND, "Offering not found.");
        }
        if (input.status === "active" && input.purchaseModel !== "custom_quote") {
          const ready = existing !== undefined && (await hasBasePrice(existing.id, t));
          if (!ready) {
            throw validation(
              "status",
              existing === undefined
                ? "Create the offering as inactive, set its base-currency price, then activate it."
                : "An active offering needs a base-currency price (API-CAT-04).",
            );
          }
        }
        if (input.isDefault) {
          await t
            .update(offerings)
            .set({ isDefault: false, updatedAt: now() })
            .where(
              existing === undefined
                ? and(eq(offerings.productId, input.productId), eq(offerings.isDefault, true))
                : and(eq(offerings.productId, input.productId), ne(offerings.id, existing.id)),
            );
        }
        const values = {
          productId: input.productId,
          name: input.name,
          slug: input.slug,
          position: input.position,
          isDefault: input.isDefault,
          purchaseModel: input.purchaseModel,
          billingInterval: input.purchaseModel === "subscription" ? (input.billingInterval ?? null) : null,
          trialDays: input.trialDays ?? null,
          licenseType: input.licenseType ?? null,
          deliveryType: input.deliveryType,
          deliveryConfig: input.deliveryConfig,
          serviceSteps: input.serviceSteps ?? null,
          instructionsJson: input.instructionsJson ?? null,
          status: input.status,
          updatedAt: now(),
        };
        let offering: Offering | undefined;
        try {
          if (existing === undefined) {
            [offering] = await t.insert(offerings).values(values).returning();
          } else {
            [offering] = await t.update(offerings).set(values).where(eq(offerings.id, existing.id)).returning();
          }
        } catch (err) {
          if (isUniqueViolation(err)) {
            throw new AppError(ErrorCode.CONFLICT, "An offering with this slug already exists on the product.");
          }
          throw err;
        }
        if (offering === undefined) throw new AppError(ErrorCode.INTERNAL, "offering write returned no row");
        await deps.audit.log(
          ctx,
          "API-CAT-03 offering.upsert",
          { type: "offering", id: offering.id },
          existing ?? null,
          offering,
          t,
        );
        await revalidateFor(input.productId, OFFERINGS_CACHE_TAGS.upsertOffering, t);
        return { offering };
      }, tx);
    },

    deleteOffering(ctx, input, tx) {
      return run(async (t) => {
        const offering = await lockOffering(input.offeringId, t);
        await loadProductForWrite(ctx, offering.productId, t);
        const [sold] = await t
          .select({ id: orderItems.id })
          .from(orderItems)
          .where(eq(orderItems.offeringId, offering.id))
          .limit(1);
        let result: "deleted" | "inactive";
        if (sold !== undefined) {
          await t
            .update(offerings)
            .set({ status: "inactive", isDefault: false, updatedAt: now() })
            .where(eq(offerings.id, offering.id));
          result = "inactive";
        } else {
          await t.delete(offerings).where(eq(offerings.id, offering.id));
          result = "deleted";
        }
        await deps.audit.log(
          ctx,
          "API-CAT-03 offering.delete",
          { type: "offering", id: offering.id },
          offering,
          { result },
          t,
        );
        await revalidateFor(offering.productId, OFFERINGS_CACHE_TAGS.deleteOffering, t);
        return { result };
      }, tx);
    },

    setOfferingPrices(ctx, input, tx) {
      return run(async (t) => {
        const offering = await lockOffering(input.offeringId, t);
        await loadProductForWrite(ctx, offering.productId, t);
        const base = await deps.baseCurrency(t);
        if (!input.prices.some((p) => p.currency === base)) {
          throw validation("prices", `A ${base} (base currency) price is required.`);
        }
        const enabled = await deps.enabledCurrencies(t);
        const disallowed = input.prices.map((p) => p.currency).filter((c) => !enabled.includes(c));
        if (disallowed.length > 0) {
          throw validation("prices", `Currency not enabled: ${disallowed.join(", ")}.`);
        }
        const before = await t.select().from(offeringPrices).where(eq(offeringPrices.offeringId, offering.id));
        await t.delete(offeringPrices).where(eq(offeringPrices.offeringId, offering.id));
        const prices = await t
          .insert(offeringPrices)
          .values(
            input.prices.map((p) => ({
              offeringId: offering.id,
              currency: p.currency,
              amountMinor: p.amountMinor,
              compareAtMinor: p.compareAtMinor ?? null,
              updatedAt: now(),
            })),
          )
          .returning();
        await deps.audit.log(
          ctx,
          "API-CAT-04 offering.prices.set",
          { type: "offering", id: offering.id },
          before,
          prices,
          t,
        );
        await revalidateFor(offering.productId, OFFERINGS_CACHE_TAGS.setOfferingPrices, t);
        return { prices };
      }, tx);
    },

    setOfferingPaymentMethods(ctx, input, tx) {
      return run(async (t) => {
        const offering = await lockOffering(input.offeringId, t);
        await loadProductForWrite(ctx, offering.productId, t);
        const enabled = await deps.enabledPaymentMethods(t);
        for (const method of input.methods) {
          const flag = GATEWAY_FLAG[method];
          if (flag === undefined) continue;
          if (!(await deps.flag(flag))) {
            throw validation("methods", `${method} is not available (feature flag \`${flag}\` is off).`);
          }
          if (!enabled.includes(method)) {
            throw validation("methods", `${method} is not enabled in settings.`);
          }
        }
        const before = (
          await t.select().from(offeringPaymentMethods).where(eq(offeringPaymentMethods.offeringId, offering.id))
        ).map((m) => m.method);
        await t.delete(offeringPaymentMethods).where(eq(offeringPaymentMethods.offeringId, offering.id));
        await t
          .insert(offeringPaymentMethods)
          .values(input.methods.map((method) => ({ offeringId: offering.id, method })));
        await deps.audit.log(
          ctx,
          "API-CAT-05 offering.methods.set",
          { type: "offering", id: offering.id },
          { methods: before },
          { methods: input.methods },
          t,
        );
        await revalidateFor(offering.productId, OFFERINGS_CACHE_TAGS.setOfferingPaymentMethods, t);
        return { methods: [...input.methods] };
      }, tx);
    },

    async listForProduct(productId, displayCurrency, tx) {
      const db = tx ?? readDb();
      const rows = await db
        .select()
        .from(offerings)
        .where(eq(offerings.productId, productId))
        .orderBy(asc(offerings.position), asc(offerings.createdAt));
      if (rows.length === 0) return [];
      const ids = rows.map((o) => o.id);
      const [priceRows, methodRows, baseCurrency] = await Promise.all([
        db.select().from(offeringPrices).where(inArray(offeringPrices.offeringId, ids)),
        db.select().from(offeringPaymentMethods).where(inArray(offeringPaymentMethods.offeringId, ids)),
        deps.baseCurrency(db),
      ]);
      const rate = await deps.rate(baseCurrency, displayCurrency);
      return rows.map((o) =>
        toOfferingView(
          o,
          priceRows.filter((p) => p.offeringId === o.id),
          methodRows.filter((m) => m.offeringId === o.id).map((m) => m.method),
          baseCurrency,
          displayCurrency,
          rate,
        ),
      );
    },

    async isPublishReady(productId, tx) {
      const base = await deps.baseCurrency(tx);
      const [row] = await tx
        .select({ id: offerings.id })
        .from(offerings)
        .where(
          and(
            eq(offerings.productId, productId),
            eq(offerings.status, "active"),
            sql`exists (select 1 from ${offeringPrices} op where op.offering_id = ${offerings.id} and op.currency = ${base})`,
            sql`exists (select 1 from ${offeringPaymentMethods} pm where pm.offering_id = ${offerings.id})`,
          ),
        )
        .limit(1);
      return row !== undefined;
    },
  };
}

async function loadSettings(db: DbOrTx) {
  const settings = await resolveSibling<SettingsService>(
    () => import("@/modules/settings/service"),
    "settingsService",
  );
  if (settings === undefined) return undefined;
  try {
    return await settings.load(db);
  } catch (err) {
    if (isNotImplemented(err)) return undefined;
    throw err;
  }
}

export const defaultOfferingsDeps: OfferingsDeps = {
  audit: lazyAuditService(),
  revalidate: nextRevalidate,
  baseCurrency: defaultBaseCurrency,
  rate: defaultRate,
  enabledCurrencies: async (db) => (await loadSettings(db))?.enabledCurrencies ?? [...CURRENCIES],
  enabledPaymentMethods: async (db) =>
    (await loadSettings(db))?.enabledPaymentMethods ?? [...MANUAL_PAYMENT_METHODS],
  flag: getFlag,
};

export const offeringsService = createOfferingsService(defaultOfferingsDeps);

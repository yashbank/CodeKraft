/**
 * Offerings service implementation (docs/05 §3, docs/06 §2.2 API-CAT-03..05, PHASE-03 P3.7).
 * Full implementation satisfying OfferingsService contracts.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { getFlag } from "@/lib/feature-flags";
import { revalidateTagSafe } from "@/lib/revalidate";
import type { Currency } from "@/lib/money";
import {
  offerings,
  offeringPrices,
  offeringPaymentMethods,
  type Offering,
  type OfferingPrice,
} from "../../../drizzle/schema/offerings";
import { products } from "../../../drizzle/schema/catalog";
import { orderItems } from "../../../drizzle/schema/commerce";
import type {
  OfferingsService,
  SetOfferingPaymentMethodsInput,
  SetOfferingPricesInput,
  UpsertOfferingInput,
} from "./contracts";
import type { OfferingPriceView, OfferingView, PaymentMethodValue } from "./types";
import { resolveOfferingPrice } from "./pricing";

export class DefaultOfferingsService implements OfferingsService {
  constructor(private readonly getDb?: () => DbOrTx) {}

  private async getDatabase(tx?: DbOrTx): Promise<DbOrTx> {
    if (tx) return tx;
    if (this.getDb) return this.getDb();
    const { db } = await import("@/lib/db");
    return db;
  }

  /**
   * API-CAT-03: Upsert offering with validation and automated provisioning flag checks.
   */
  async upsertOffering(
    ctx: RequestContext,
    input: UpsertOfferingInput,
    tx?: DbOrTx,
  ): Promise<{ offering: Offering }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      // 1. Verify parent product exists
      const [product] = await actionTx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      if (!product) {
        throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
      }

      // 2. Automated provisioning requires 'automated_provisioning' feature flag
      if (input.deliveryConfig.provisioning === "automated") {
        const flagEnabled = await getFlag("automated_provisioning");
        if (!flagEnabled) {
          throw new AppError(
            ErrorCode.FORBIDDEN,
            "Automated provisioning is disabled by feature flag",
          );
        }
      }

      // 3. Unique slug check within product
      const existingSlugQuery = actionTx
        .select({ id: offerings.id })
        .from(offerings)
        .where(
          input.offeringId
            ? and(
                eq(offerings.productId, input.productId),
                eq(offerings.slug, input.slug),
                ne(offerings.id, input.offeringId),
              )
            : and(eq(offerings.productId, input.productId), eq(offerings.slug, input.slug)),
        )
        .limit(1);

      const [slugConflict] = await existingSlugQuery;
      if (slugConflict) {
        throw new AppError(ErrorCode.CONFLICT, `Offering slug '${input.slug}' already in use`);
      }

      // 4. Default offering handling (only one default per product)
      if (input.isDefault) {
        await actionTx
          .update(offerings)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            input.offeringId
              ? and(eq(offerings.productId, input.productId), ne(offerings.id, input.offeringId))
              : eq(offerings.productId, input.productId),
          );
      }

      let resultOffering: Offering;

      if (input.offeringId) {
        const [existing] = await actionTx
          .select()
          .from(offerings)
          .where(eq(offerings.id, input.offeringId))
          .limit(1);

        if (!existing) {
          throw new AppError(ErrorCode.NOT_FOUND, "Offering not found");
        }

        const [updated] = await actionTx
          .update(offerings)
          .set({
            name: input.name,
            slug: input.slug,
            position: input.position,
            isDefault: input.isDefault,
            purchaseModel: input.purchaseModel,
            billingInterval: input.billingInterval ?? null,
            trialDays: input.trialDays ?? null,
            licenseType: input.licenseType ?? null,
            deliveryType: input.deliveryType,
            deliveryConfig: input.deliveryConfig,
            serviceSteps: input.serviceSteps ?? null,
            instructionsJson: input.instructionsJson ?? null,
            status: input.status,
            updatedAt: new Date(),
          })
          .where(eq(offerings.id, input.offeringId))
          .returning();

        if (!updated) {
          throw new AppError(ErrorCode.INTERNAL, "Failed to update offering");
        }

        resultOffering = updated;

        await auditService.log(
          ctx,
          "offering.updated",
          { type: "offering", id: resultOffering.id },
          existing,
          resultOffering,
          actionTx as TxCtx,
        );
      } else {
        const [created] = await actionTx
          .insert(offerings)
          .values({
            productId: input.productId,
            name: input.name,
            slug: input.slug,
            position: input.position,
            isDefault: input.isDefault,
            purchaseModel: input.purchaseModel,
            billingInterval: input.billingInterval ?? null,
            trialDays: input.trialDays ?? null,
            licenseType: input.licenseType ?? null,
            deliveryType: input.deliveryType,
            deliveryConfig: input.deliveryConfig,
            serviceSteps: input.serviceSteps ?? null,
            instructionsJson: input.instructionsJson ?? null,
            status: input.status,
          })
          .returning();

        if (!created) {
          throw new AppError(ErrorCode.INTERNAL, "Failed to create offering");
        }

        resultOffering = created;

        await auditService.log(
          ctx,
          "offering.created",
          { type: "offering", id: resultOffering.id },
          null,
          resultOffering,
          actionTx as TxCtx,
        );
      }

      revalidateTagSafe("catalog");

      return { offering: resultOffering };
    }, outerTx);
  }

  /**
   * API-CAT-03: Delete offering — hard delete only with zero order_items, else demote to inactive.
   */
  async deleteOffering(
    ctx: RequestContext,
    input: { offeringId: string },
    tx?: DbOrTx,
  ): Promise<{ result: "deleted" | "inactive" }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      const [existing] = await actionTx
        .select()
        .from(offerings)
        .where(eq(offerings.id, input.offeringId))
        .limit(1);

      if (!existing) {
        throw new AppError(ErrorCode.NOT_FOUND, "Offering not found");
      }

      const [orderCnt] = await actionTx
        .select({ count: sql<number>`count(*)::int` })
        .from(orderItems)
        .where(eq(orderItems.offeringId, input.offeringId));

      const hasOrders = (orderCnt?.count ?? 0) > 0;

      if (!hasOrders) {
        // Safe to hard delete offering and its dependent prices/methods
        await actionTx
          .delete(offeringPrices)
          .where(eq(offeringPrices.offeringId, input.offeringId));
        await actionTx
          .delete(offeringPaymentMethods)
          .where(eq(offeringPaymentMethods.offeringId, input.offeringId));
        await actionTx.delete(offerings).where(eq(offerings.id, input.offeringId));

        await auditService.log(
          ctx,
          "offering.deleted",
          { type: "offering", id: input.offeringId },
          existing,
          null,
          actionTx as TxCtx,
        );

        revalidateTagSafe("catalog");
        return { result: "deleted" };
      }

      // Demote to inactive
      await actionTx
        .update(offerings)
        .set({ status: "inactive", updatedAt: new Date() })
        .where(eq(offerings.id, input.offeringId));

      await auditService.log(
        ctx,
        "offering.inactivated",
        { type: "offering", id: input.offeringId },
        existing,
        { ...existing, status: "inactive" },
        actionTx as TxCtx,
      );

      revalidateTagSafe("catalog");
      return { result: "inactive" };
    }, outerTx);
  }

  /**
   * API-CAT-04: Set offering prices. Base INR price is mandatory.
   */
  async setOfferingPrices(
    ctx: RequestContext,
    input: SetOfferingPricesInput,
    tx?: DbOrTx,
  ): Promise<{ prices: OfferingPrice[] }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      const [existingOffering] = await actionTx
        .select({ id: offerings.id })
        .from(offerings)
        .where(eq(offerings.id, input.offeringId))
        .limit(1);

      if (!existingOffering) {
        throw new AppError(ErrorCode.NOT_FOUND, "Offering not found");
      }

      // Base currency (INR) row is strictly mandatory
      const hasBasePrice = input.prices.some((p) => p.currency === "INR");
      if (!hasBasePrice) {
        throw new AppError(
          ErrorCode.VALIDATION,
          "A base-currency (INR) price is mandatory for offerings",
        );
      }

      // Validate compareAt > amountMinor
      for (const p of input.prices) {
        if (p.compareAtMinor !== undefined && p.compareAtMinor <= p.amountMinor) {
          throw new AppError(
            ErrorCode.VALIDATION,
            `compareAtMinor (${p.compareAtMinor}) must exceed amountMinor (${p.amountMinor})`,
          );
        }
      }

      // Replace existing price set
      await actionTx.delete(offeringPrices).where(eq(offeringPrices.offeringId, input.offeringId));

      const newRows = await actionTx
        .insert(offeringPrices)
        .values(
          input.prices.map((p) => ({
            offeringId: input.offeringId,
            currency: p.currency,
            amountMinor: p.amountMinor,
            compareAtMinor: p.compareAtMinor ?? null,
          })),
        )
        .returning();

      await auditService.log(
        ctx,
        "offering.prices_updated",
        { type: "offering", id: input.offeringId },
        null,
        { prices: newRows },
        actionTx as TxCtx,
      );

      revalidateTagSafe("catalog");

      return { prices: newRows };
    }, outerTx);
  }

  /**
   * API-CAT-05: Set offering payment methods. Flag-gated gateway methods checked.
   */
  async setOfferingPaymentMethods(
    ctx: RequestContext,
    input: SetOfferingPaymentMethodsInput,
    tx?: DbOrTx,
  ): Promise<{ methods: PaymentMethodValue[] }> {
    assertPermission(ctx, "catalog.write");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      const [existingOffering] = await actionTx
        .select({ id: offerings.id })
        .from(offerings)
        .where(eq(offerings.id, input.offeringId))
        .limit(1);

      if (!existingOffering) {
        throw new AppError(ErrorCode.NOT_FOUND, "Offering not found");
      }

      // Feature flag gating for gateways
      for (const method of input.methods) {
        if (method === "razorpay") {
          const enabled = await getFlag("provider_razorpay");
          if (!enabled) {
            throw new AppError(
              ErrorCode.STATE_INVALID,
              "Payment provider razorpay is disabled by feature flag",
            );
          }
        } else if (method === "stripe") {
          const enabled = await getFlag("provider_stripe");
          if (!enabled) {
            throw new AppError(
              ErrorCode.STATE_INVALID,
              "Payment provider stripe is disabled by feature flag",
            );
          }
        } else if (method === "paypal") {
          const enabled = await getFlag("provider_paypal");
          if (!enabled) {
            throw new AppError(
              ErrorCode.STATE_INVALID,
              "Payment provider paypal is disabled by feature flag",
            );
          }
        }
      }

      // Replace existing methods
      await actionTx
        .delete(offeringPaymentMethods)
        .where(eq(offeringPaymentMethods.offeringId, input.offeringId));

      await actionTx.insert(offeringPaymentMethods).values(
        input.methods.map((method) => ({
          offeringId: input.offeringId,
          method,
        })),
      );

      await auditService.log(
        ctx,
        "offering.payment_methods_updated",
        { type: "offering", id: input.offeringId },
        null,
        { methods: input.methods },
        actionTx as TxCtx,
      );

      revalidateTagSafe("catalog");

      return { methods: input.methods };
    }, outerTx);
  }

  /**
   * Internal read used by catalog public reads and checkout.
   */
  async listForProduct(
    productId: string,
    displayCurrency: Currency,
    tx?: DbOrTx,
  ): Promise<OfferingView[]> {
    const dbClient = await this.getDatabase(tx);

    const rows = await dbClient
      .select()
      .from(offerings)
      .where(and(eq(offerings.productId, productId), eq(offerings.status, "active")))
      .orderBy(offerings.position);

    const views: OfferingView[] = [];

    for (const off of rows) {
      const prices = await dbClient
        .select()
        .from(offeringPrices)
        .where(eq(offeringPrices.offeringId, off.id));

      const basePrice = prices.find((p) => p.currency === "INR");
      const displayPrice = await resolveOfferingPrice(prices, displayCurrency);

      let priceBlock: OfferingView["price"] = null;
      if (basePrice && displayPrice) {
        priceBlock = {
          base: { amountMinor: basePrice.amountMinor, currency: "INR" },
          display: { amountMinor: displayPrice.amountMinor, currency: displayCurrency },
          compareAt:
            displayPrice.compareAtMinor !== null
              ? { amountMinor: displayPrice.compareAtMinor, currency: displayCurrency }
              : null,
          displayIsConverted: !displayPrice.explicit,
        };
      }

      const priceViews: OfferingPriceView[] = prices.map((p) => ({
        currency: p.currency as Currency,
        amountMinor: p.amountMinor,
        compareAtMinor: p.compareAtMinor ?? null,
        explicit: true,
      }));

      const methodRows = await dbClient
        .select()
        .from(offeringPaymentMethods)
        .where(eq(offeringPaymentMethods.offeringId, off.id));

      views.push({
        id: off.id,
        slug: off.slug,
        name: off.name,
        position: off.position,
        isDefault: off.isDefault,
        purchaseModel: off.purchaseModel,
        billingInterval: off.billingInterval,
        trialDays: off.trialDays,
        licenseType: off.licenseType,
        deliveryType: off.deliveryType,
        deliveryConfig: off.deliveryConfig,
        serviceSteps: off.serviceSteps,
        instructions: off.instructionsJson,
        status: off.status,
        price: priceBlock,
        prices: priceViews,
        paymentMethods: methodRows.map((m) => m.method),
      });
    }

    return views;
  }

  /**
   * Internal readiness check for API-CAT-11: ≥ 1 active offering with base price and ≥ 1 method.
   */
  async isPublishReady(productId: string, tx: TxCtx): Promise<boolean> {
    const activeOfferings = await tx
      .select()
      .from(offerings)
      .where(and(eq(offerings.productId, productId), eq(offerings.status, "active")));

    for (const off of activeOfferings) {
      const prices = await tx
        .select()
        .from(offeringPrices)
        .where(eq(offeringPrices.offeringId, off.id));

      const methods = await tx
        .select()
        .from(offeringPaymentMethods)
        .where(eq(offeringPaymentMethods.offeringId, off.id));

      const hasBasePrice = prices.some((p) => p.currency === "INR");
      if (hasBasePrice && methods.length > 0) {
        return true;
      }
    }

    return false;
  }
}

export const offeringsService = new DefaultOfferingsService();

/** Preserved for freeze and contract tests (PHASE-02 P2.8). */
export function createNotImplementedOfferingsService(): OfferingsService {
  return createNotImplemented<OfferingsService>("offerings", "P3", {
    upsertOffering: "async",
    deleteOffering: "async",
    setOfferingPrices: "async",
    setOfferingPaymentMethods: "async",
    listForProduct: "async",
    isPublishReady: "async",
  });
}

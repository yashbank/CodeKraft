/**
 * Offerings & pricing (docs/05 §3). Declares the shared enums `purchase_model`, `billing_interval`,
 * `delivery_type`, `update_policy` and `payment_method` consumed by domains B and C
 * (implementation/PHASE-02.md shared-enum table).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { products, type TiptapDoc } from "./catalog";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const purchaseModel = pgEnum("purchase_model", ["one_time", "subscription", "custom_quote"]);
export const billingInterval = pgEnum("billing_interval", ["monthly", "quarterly", "annual"]);
export const deliveryType = pgEnum("delivery_type", [
  "saas",
  "hosted",
  "download",
  "license",
  "service",
  "custom",
]);
export const updatePolicy = pgEnum("update_policy", ["all_free", "during_access", "major_paid"]);
export const paymentMethod = pgEnum("payment_method", [
  "manual_upi",
  "manual_bank",
  "razorpay",
  "stripe",
  "paypal",
]);
export const offeringStatus = pgEnum("offering_status", ["active", "inactive"]);

export type DeliveryTypeValue = (typeof deliveryType.enumValues)[number];
export type UpdatePolicyValue = (typeof updatePolicy.enumValues)[number];
export type PaymentMethodValue = (typeof paymentMethod.enumValues)[number];

/** `offerings.delivery_config` — keys used depend on `delivery_type` (docs/05 §3, docs/06 §5). */
export interface DeliveryConfig {
  provisioning?: "manual" | "automated";
  instructionsJson?: TiptapDoc;
  /** download: max download count per entitlement (D-606) */
  downloadCap?: number;
  /** null/undefined = lifetime access */
  accessMonths?: number | null;
  updatePolicy?: UpdatePolicyValue;
  /** hosted/saas hints */
  repoUrl?: string;
  appUrl?: string;
  /** hosted: whether the customer supplies the hosting target */
  customerHosted?: boolean;
}

/** `offerings.service_steps` — checklist for service deliveries (D-608). */
export interface ServiceStep {
  key: string;
  title: string;
  description?: string;
}

/** T-offerings — prices, purchase model and delivery live here, never on products (MASTER_SPEC §4.2). */
export const offerings = pgTable(
  "offerings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    purchaseModel: purchaseModel("purchase_model").notNull(),
    billingInterval: billingInterval("billing_interval"),
    trialDays: integer("trial_days"),
    licenseType: text("license_type"),
    deliveryType: deliveryType("delivery_type").notNull(),
    deliveryConfig: jsonb("delivery_config")
      .$type<DeliveryConfig>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    serviceSteps: jsonb("service_steps").$type<ServiceStep[]>(),
    /** Post-purchase instructions shown on the dashboard (A-601). */
    instructionsJson: jsonb("instructions_json").$type<TiptapDoc>(),
    status: offeringStatus("status").notNull().default("active"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("offerings_product_slug_unique").on(t.productId, t.slug),
    index("offerings_product_idx").on(t.productId, t.status, t.position),
  ],
);

/** T-offering_prices — base-currency row mandatory, others optional (D-502, D-408). Money = bigint minor units. */
export const offeringPrices = pgTable(
  "offering_prices",
  {
    offeringId: uuid("offering_id")
      .notNull()
      .references(() => offerings.id, { onDelete: "cascade" }),
    currency: char("currency", { length: 3 }).notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    compareAtMinor: bigint("compare_at_minor", { mode: "number" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.offeringId, t.currency] })],
);

/** T-offering_payment_methods (D-110) */
export const offeringPaymentMethods = pgTable(
  "offering_payment_methods",
  {
    offeringId: uuid("offering_id")
      .notNull()
      .references(() => offerings.id, { onDelete: "cascade" }),
    method: paymentMethod("method").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.offeringId, t.method] })],
);

export type Offering = typeof offerings.$inferSelect;
export type NewOffering = typeof offerings.$inferInsert;
export type OfferingPrice = typeof offeringPrices.$inferSelect;
export type NewOfferingPrice = typeof offeringPrices.$inferInsert;
export type OfferingPaymentMethod = typeof offeringPaymentMethods.$inferSelect;
export type NewOfferingPaymentMethod = typeof offeringPaymentMethods.$inferInsert;

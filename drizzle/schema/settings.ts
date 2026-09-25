/**
 * Site settings (docs/05 §10) and FX rates (docs/05 §7 T-fx_rates; consumed by the `fx` module,
 * P2.5 contracts A). `site_settings` is a key/value store: base_currency, enabled_currencies,
 * tax_rate_bps, gstin, seller_details, upi_vpa, bank_details, default_theme, ai_model,
 * ai_daily_platform_cap, ai_daily_user_cap, feature flags, retention days, seeded_at.
 */
import {
  char,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const siteSettings = pgTable(
  "site_settings",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").$type<JsonValue>().notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("site_settings_updated_by_idx").on(t.updatedBy)],
);

/** T-fx_rates — daily rates; `rate` is `numeric(18,8)` read as a string (src/lib/money.ts FX_RATE_SCALE). */
export const fxRates = pgTable(
  "fx_rates",
  {
    base: char("base", { length: 3 }).notNull(),
    quote: char("quote", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    asOf: date("as_of", { mode: "string" }).notNull(),
    source: text("source").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote, t.asOf] })],
);

export type SiteSetting = typeof siteSettings.$inferSelect;
export type NewSiteSetting = typeof siteSettings.$inferInsert;
export type FxRate = typeof fxRates.$inferSelect;
export type NewFxRate = typeof fxRates.$inferInsert;

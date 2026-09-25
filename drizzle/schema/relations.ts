/**
 * Cross-domain Drizzle `relations()` (query-builder navigation only; the FKs live on the tables and
 * are wired by P2.4). Same-domain relations for domain A are in ./relations-a. Drizzle merges several
 * `relations()` declarations for one table by relation name, so `products`/`offerings` gain their
 * commerce/delivery edges here without touching relations-a.
 */
import { relations } from "drizzle-orm";
import { approvalRequests } from "./approvals";
import { users } from "./auth";
import { products } from "./catalog";
import { orderItems, orders, payments, refunds } from "./commerce";
import { entitlements, subscriptions } from "./delivery";
import { allocations, expenses, ledgerEntries, payouts } from "./finance";
import { creditNotes, invoices } from "./invoices";
import { leads } from "./leads";
import { offerings } from "./offerings";
import { productOwnerships } from "./ownership";
import { partners } from "./users-ext";

export const productsRelationsCross = relations(products, ({ many }) => ({
  orderItems: many(orderItems),
  entitlements: many(entitlements),
  expenses: many(expenses),
  leads: many(leads),
}));

export const offeringsRelationsCross = relations(offerings, ({ many }) => ({
  orderItems: many(orderItems),
  entitlements: many(entitlements),
}));

export const productOwnershipsRelationsCross = relations(productOwnerships, ({ one, many }) => ({
  approvalRequest: one(approvalRequests, {
    fields: [productOwnerships.approvalRequestId],
    references: [approvalRequests.id],
  }),
  orderItems: many(orderItems),
  allocations: many(allocations),
}));

export const partnersRelationsCross = relations(partners, ({ many }) => ({
  ledgerEntries: many(ledgerEntries),
  payouts: many(payouts),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  payments: many(payments),
  refunds: many(refunds),
  invoice: one(invoices, { fields: [orders.id], references: [invoices.orderId] }),
  ledgerEntries: many(ledgerEntries),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  offering: one(offerings, { fields: [orderItems.offeringId], references: [offerings.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  ownership: one(productOwnerships, {
    fields: [orderItems.ownershipId],
    references: [productOwnerships.id],
  }),
  entitlement: one(entitlements, {
    fields: [orderItems.id],
    references: [entitlements.orderItemId],
  }),
  allocations: many(allocations),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  refunds: many(refunds),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  order: one(orders, { fields: [refunds.orderId], references: [orders.id] }),
  payment: one(payments, { fields: [refunds.paymentId], references: [payments.id] }),
  creditNote: one(creditNotes, { fields: [refunds.creditNoteId], references: [creditNotes.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  order: one(orders, { fields: [invoices.orderId], references: [orders.id] }),
  creditNotes: many(creditNotes),
}));

export const creditNotesRelations = relations(creditNotes, ({ one }) => ({
  invoice: one(invoices, { fields: [creditNotes.invoiceId], references: [invoices.id] }),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  partner: one(partners, { fields: [ledgerEntries.partnerId], references: [partners.id] }),
  order: one(orders, { fields: [ledgerEntries.orderId], references: [orders.id] }),
  orderItem: one(orderItems, { fields: [ledgerEntries.orderItemId], references: [orderItems.id] }),
}));

export const allocationsRelations = relations(allocations, ({ one }) => ({
  orderItem: one(orderItems, { fields: [allocations.orderItemId], references: [orderItems.id] }),
  ownership: one(productOwnerships, {
    fields: [allocations.ownershipId],
    references: [productOwnerships.id],
  }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  partner: one(partners, { fields: [payouts.partnerId], references: [partners.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  product: one(products, { fields: [expenses.productId], references: [products.id] }),
}));

export const entitlementsRelations = relations(entitlements, ({ one }) => ({
  user: one(users, { fields: [entitlements.userId], references: [users.id] }),
  offering: one(offerings, { fields: [entitlements.offeringId], references: [offerings.id] }),
  product: one(products, { fields: [entitlements.productId], references: [products.id] }),
  orderItem: one(orderItems, { fields: [entitlements.orderItemId], references: [orderItems.id] }),
  subscription: one(subscriptions, {
    fields: [entitlements.id],
    references: [subscriptions.entitlementId],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  entitlement: one(entitlements, {
    fields: [subscriptions.entitlementId],
    references: [entitlements.id],
  }),
  renewalOrder: one(orders, { fields: [subscriptions.renewalOrderId], references: [orders.id] }),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  product: one(products, { fields: [leads.productId], references: [products.id] }),
  wonOrder: one(orders, { fields: [leads.wonOrderId], references: [orders.id] }),
}));

/**
 * Test data factories (docs/10 §3, PHASE-02 P2.9).
 *
 * Every factory is `create<X>(options?, db?)`: it inserts real rows through Drizzle and returns the
 * inserted row (with the child rows it created, e.g. `prices`, `items`, `lines`). `db` defaults to
 * the pooled app client (`getDb()`); pass a drizzle transaction, or use `withFactories(tx)` with the
 * `postgres` transaction from `withRollback()` (tests/setup/db.ts) to keep a test's rows in a
 * rolled-back transaction. Defaults are deterministic (`resetSequences()` = `faker.seed(1207)`).
 *
 * P2 inserts through Drizzle because the services do not exist yet; P3–P6 swap the bodies for
 * `service.ts` calls without changing these signatures (docs/10 §3).
 */
import { type FactoryDbInput, toFactoryDb } from "./context";
import { createApprovalDecision, createApprovalRequest } from "./approvals";
import { createCategory, createMedia, createProduct } from "./catalog";
import {
  createCoupon,
  createInvoice,
  createOrder,
  createOrderItem,
  createPayment,
  createQuote,
} from "./commerce";
import { createEntitlement, createSubscription } from "./delivery";
import { seedExampleCatalog } from "./example-catalog";
import { createConversation, createLead, createPromptVersion, createQuery } from "./leads";
import { createOffering } from "./offerings";
import { createOwnership } from "./ownership";
import { createAdmin, createPartner, createSuperAdmin, createUser } from "./users";

export * from "./context";
export * from "./users";
export * from "./catalog";
export * from "./offerings";
export * from "./ownership";
export * from "./commerce";
export * from "./delivery";
export * from "./leads";
export * from "./approvals";
export * from "./example-catalog";

/** Every factory bound to one database handle (a transaction, usually). */
export function withFactories(input: FactoryDbInput) {
  const db = toFactoryDb(input);
  return {
    db,
    createUser: (o?: Parameters<typeof createUser>[0]) => createUser(o, db),
    createAdmin: (o?: Parameters<typeof createAdmin>[0]) => createAdmin(o, db),
    createSuperAdmin: (o?: Parameters<typeof createSuperAdmin>[0]) => createSuperAdmin(o, db),
    createPartner: (o?: Parameters<typeof createPartner>[0]) => createPartner(o, db),
    createCategory: (o?: Parameters<typeof createCategory>[0]) => createCategory(o, db),
    createProduct: (o?: Parameters<typeof createProduct>[0]) => createProduct(o, db),
    createMedia: (o?: Parameters<typeof createMedia>[0]) => createMedia(o, db),
    createOffering: (o?: Parameters<typeof createOffering>[0]) => createOffering(o, db),
    createOwnership: (o: Parameters<typeof createOwnership>[0]) => createOwnership(o, db),
    createCoupon: (o?: Parameters<typeof createCoupon>[0]) => createCoupon(o, db),
    createOrder: (o?: Parameters<typeof createOrder>[0]) => createOrder(o, db),
    createOrderItem: (o: Parameters<typeof createOrderItem>[0]) => createOrderItem(o, db),
    createPayment: (o: Parameters<typeof createPayment>[0]) => createPayment(o, db),
    createQuote: (o?: Parameters<typeof createQuote>[0]) => createQuote(o, db),
    createInvoice: (o: Parameters<typeof createInvoice>[0]) => createInvoice(o, db),
    createEntitlement: (o?: Parameters<typeof createEntitlement>[0]) => createEntitlement(o, db),
    createSubscription: (o?: Parameters<typeof createSubscription>[0]) => createSubscription(o, db),
    createLead: (o?: Parameters<typeof createLead>[0]) => createLead(o, db),
    createQuery: (o?: Parameters<typeof createQuery>[0]) => createQuery(o, db),
    createPromptVersion: (o?: Parameters<typeof createPromptVersion>[0]) =>
      createPromptVersion(o, db),
    createConversation: (o?: Parameters<typeof createConversation>[0]) => createConversation(o, db),
    createApprovalRequest: (o?: Parameters<typeof createApprovalRequest>[0]) =>
      createApprovalRequest(o, db),
    createApprovalDecision: (o: Parameters<typeof createApprovalDecision>[0]) =>
      createApprovalDecision(o, db),
    seedExampleCatalog: (o?: Parameters<typeof seedExampleCatalog>[0]) => seedExampleCatalog(o, db),
  };
}

export type Factories = ReturnType<typeof withFactories>;

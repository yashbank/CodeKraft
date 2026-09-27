"use server";

/**
 * `queries` Server Actions — owned by P6 (master plan §3 ownership map). `queriesService` is
 * fully implemented (see `service.ts`); this file adds the `defineAction` wrappers P2.8 left
 * empty (SA-07: every export here must be created with `defineAction` / `definePublicAction`).
 */
import { defineAction } from "@/lib/actions/envelope";
import {
  assignQuerySchema,
  closeQuerySchema,
  createQueryAdminSchema,
  createQuerySchema,
  reopenQuerySchema,
  replyToQuerySchema,
} from "./types";
import { queriesService } from "./service";

export const createQueryAdminAction = defineAction({
  name: "API-CHAT-14 createQueryAdmin",
  input: createQueryAdminSchema,
  permission: "queries.reply",
  handler: (input, ctx) => queriesService.createQueryAdmin(ctx, input),
});

export const replyToQueryAction = defineAction({
  name: "API-CHAT-03 replyToQuery",
  input: replyToQuerySchema,
  permission: "queries.reply",
  handler: (input, ctx) => queriesService.replyToQuery(ctx, input),
});

export const assignQueryAction = defineAction({
  name: "API-CHAT-05 assignQuery",
  input: assignQuerySchema,
  permission: "queries.reply",
  handler: (input, ctx) => queriesService.assignQuery(ctx, input),
});

export const closeQueryAction = defineAction({
  name: "API-CHAT-05 closeQuery",
  input: closeQuerySchema,
  permission: "queries.close",
  handler: (input, ctx) => queriesService.closeQuery(ctx, input),
});

export const reopenQueryAction = defineAction({
  name: "API-CHAT-05 reopenQuery",
  input: reopenQuerySchema,
  permission: "queries.close",
  handler: (input, ctx) => queriesService.reopenQuery(ctx, input),
});

/** API-CHAT-01 `createQuery` — customer (`support.self`), `source` dashboard/order (this app's "New query" sheet only ever sends `dashboard`; `form`/guest submission is a public, unauthenticated path handled elsewhere). */
export const createQueryAction = defineAction({
  name: "API-CHAT-01 query.create",
  input: createQuerySchema,
  permission: "support.self",
  handler: (input, ctx) => queriesService.createQuery(ctx, input),
});

/**
 * Positive fixture for the SA-07 scanner (`tests/static/actions-use-define-action.test.ts`):
 * every value export is a `defineAction` / `definePublicAction` call. Never imported by `src/**`.
 */
import { z } from "zod";
import { type Action, defineAction, definePublicAction } from "@/lib/actions";

export const ping = definePublicAction({
  name: "fixture.ping",
  input: z.strictObject({}),
  handler: () => "pong",
});

export const guarded = defineAction({
  name: "fixture.guarded",
  input: z.strictObject({ id: z.uuid() }),
  permission: "catalog.read",
  handler: (input) => input.id,
});

export const asserted = definePublicAction({
  name: "fixture.asserted",
  input: z.strictObject({}),
  handler: () => 1,
}) satisfies Action<number>;

const local = definePublicAction({
  name: "fixture.local",
  input: z.strictObject({}),
  handler: () => true,
});
export { local as aliased };

export type { Action } from "@/lib/actions";

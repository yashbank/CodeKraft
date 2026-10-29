// @vitest-environment node
import { describe, expect, it } from "vitest";

import { DefaultNotificationsService } from "@/modules/notifications/service";
import {
  channelEnabled,
  resolveCategoryPrefs,
  type StoredPrefs,
} from "@/modules/notifications/preferences";
import { emailOutbox, notifications } from "../../../drizzle/schema/notifications";
import { customerProfiles } from "../../../drizzle/schema/users-ext";

describe("channelEnabled (P14-12b)", () => {
  const off: StoredPrefs = {
    categories: {
      orders: { email: false, inapp: false },
      queries: { email: false },
      marketing: { inapp: false },
    },
  };

  it("defaults to on", () => {
    expect(channelEnabled("order.created", "email", null)).toBe(true);
    expect(channelEnabled("order.created", "inapp", {})).toBe(true);
  });

  it("skips email / in-app per category when switched off", () => {
    expect(channelEnabled("order.created", "email", off)).toBe(false);
    expect(channelEnabled("order.created", "inapp", off)).toBe(false);
    expect(channelEnabled("query.replied", "email", off)).toBe(false);
    expect(channelEnabled("query.replied", "inapp", off)).toBe(true);
    expect(channelEnabled("product.updated", "inapp", off)).toBe(false);
    expect(channelEnabled("product.updated", "email", off)).toBe(true);
  });

  it("always sends transactional types", () => {
    for (const t of ["order.paid", "payment.failed", "invoice.issued", "refund.issued"] as const) {
      expect(channelEnabled(t, "email", off)).toBe(true);
      expect(channelEnabled(t, "inapp", off)).toBe(true);
    }
  });

  it("types without a category (admin alerts) are never filtered", () => {
    expect(channelEnabled("lead.new", "email", off)).toBe(true);
  });

  it("legacy emailProductUpdates=false still switches marketing email off", () => {
    expect(channelEnabled("product.updated", "email", { emailProductUpdates: false })).toBe(false);
    expect(resolveCategoryPrefs({ emailProductUpdates: false }).marketing).toEqual({
      email: false,
      inapp: true,
    });
  });
});

/** Minimal drizzle-ish tx: records inserts, answers the user + profile lookups. */
function fakeTx(prefs: StoredPrefs & { email: boolean; inapp: boolean }) {
  const inserts: unknown[] = [];
  const select = () => {
    let table: unknown;
    const chain: Record<string, unknown> = {};
    chain.from = (t: unknown) => ((table = t), chain);
    chain.where = () => chain;
    chain.limit = () => chain;
    chain.then = (resolve: (v: unknown) => void) =>
      resolve(
        table === customerProfiles
          ? [{ notificationPrefs: prefs }]
          : [{ id: "u1", email: "a@b.test", name: "A" }],
      );
    return chain;
  };
  const insert = (table: unknown) => ({
    values: () => ({
      returning: async () => {
        inserts.push(table);
        return [{ id: `row-${inserts.length}` }];
      },
    }),
  });
  return { tx: { select, insert } as never, inserts };
}

describe("emit enforces preferences (P14-12b)", () => {
  const svc = new DefaultNotificationsService();
  const run = async (type: "order.created" | "order.paid", cats: StoredPrefs["categories"]) => {
    const { tx, inserts } = fakeTx({ email: true, inapp: true, categories: cats });
    await svc.emit("11111111-1111-4111-8111-111111111111", type, { orderNo: "CK-1" }, undefined, tx);
    return { inapp: inserts.includes(notifications), email: inserts.includes(emailOutbox) };
  };

  it("sends both channels by default", async () => {
    expect(await run("order.created", undefined)).toEqual({ inapp: true, email: true });
  });

  it("skips email when the category email switch is off", async () => {
    expect(await run("order.created", { orders: { email: false } })).toEqual({
      inapp: true,
      email: false,
    });
  });

  it("skips the in-app row when the category in-app switch is off", async () => {
    expect(await run("order.created", { orders: { inapp: false } })).toEqual({
      inapp: false,
      email: true,
    });
  });

  it("still sends a transactional email with everything off", async () => {
    expect(await run("order.paid", { orders: { email: false, inapp: false } })).toEqual({
      inapp: true,
      email: true,
    });
  });
});

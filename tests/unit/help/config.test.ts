import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as { key: string; value: unknown }[],
  fail: false,
}));

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => {
          if (state.fail) throw new Error("db down");
          return state.rows;
        },
      }),
    }),
  }),
}));

import {
  HELP_CONFIG_DEFAULTS,
  getHelpConfig,
  getHelpTokenUsage,
  helpMonthlyTokenBudget,
  parseHelpConfig,
} from "@/modules/help/config";

beforeEach(() => {
  state.rows = [];
  state.fail = false;
  delete process.env.HELP_MONTHLY_TOKEN_BUDGET;
});

describe("parseHelpConfig", () => {
  it("defaults: enabled on, Hindi off, AI on", () => {
    expect(parseHelpConfig([])).toEqual({ enabled: true, hindi: false, ai: true });
    expect(HELP_CONFIG_DEFAULTS).toEqual({ enabled: true, hindi: false, ai: true });
  });
  it("reads stored booleans", () => {
    expect(
      parseHelpConfig([
        { key: "help_enabled", value: false },
        { key: "help_hindi_enabled", value: true },
        { key: "help_ai_enabled", value: false },
      ]),
    ).toEqual({ enabled: false, hindi: true, ai: false });
  });
  it("ignores malformed values and unrelated keys", () => {
    expect(
      parseHelpConfig([
        { key: "help_enabled", value: "false" },
        { key: "help_hindi_enabled", value: 1 },
        { key: "help_ai_enabled", value: null },
        { key: "site_name", value: false },
      ]),
    ).toEqual({ enabled: true, hindi: false, ai: true });
  });
});

describe("getHelpConfig", () => {
  it("returns stored values", async () => {
    state.rows = [{ key: "help_hindi_enabled", value: true }];
    expect(await getHelpConfig()).toEqual({ enabled: true, hindi: true, ai: true });
  });
  it("returns safe defaults when the read fails", async () => {
    state.fail = true;
    expect(await getHelpConfig()).toEqual({ enabled: true, hindi: false, ai: true });
  });
});

describe("getHelpTokenUsage", () => {
  it("shows 0 when the monthly bucket does not exist", async () => {
    expect(await getHelpTokenUsage(new Date("2026-11-17T00:00:00Z"))).toEqual({
      used: 0,
      budget: 400_000,
    });
  });
  it("reads the count and honours the budget env", async () => {
    process.env.HELP_MONTHLY_TOKEN_BUDGET = "1000";
    state.rows = [{ key: "x", value: null, count: 42 } as never];
    expect(await getHelpTokenUsage()).toEqual({ used: 42, budget: 1000 });
    expect(helpMonthlyTokenBudget()).toBe(1000);
  });
  it("falls back to 0 on error", async () => {
    state.fail = true;
    expect((await getHelpTokenUsage()).used).toBe(0);
  });
});

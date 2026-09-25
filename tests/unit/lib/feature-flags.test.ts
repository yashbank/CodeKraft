import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FLAG_CACHE_TTL_MS,
  FLAG_DEFAULTS,
  FLAG_KEYS,
  assertFlagKey,
  clearFlagCache,
  flagEnvName,
  getAllFlags,
  getFlag,
  getFlagFromEnv,
  isFlagKey,
  parseFlagValue,
  setFlagLoader,
  setFlagLoaderErrorHandler,
} from "@/lib/feature-flags";

const ENV_NAMES = FLAG_KEYS.map(flagEnvName);

describe("feature flags", () => {
  beforeEach(() => {
    for (const name of ENV_NAMES) Reflect.deleteProperty(process.env, name);
    setFlagLoader(undefined);
    setFlagLoaderErrorHandler(() => undefined);
    clearFlagCache();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("has the ten keys of docs/13 §6 with three_hero the only default-on flag", async () => {
    expect(FLAG_KEYS).toHaveLength(10);
    expect(Object.entries(FLAG_DEFAULTS).filter(([, v]) => v)).toEqual([["three_hero", true]]);
    expect(flagEnvName("phone_otp")).toBe("FEATURE_PHONE_OTP");
    expect(isFlagKey("bundles")).toBe(true);
    expect(isFlagKey("nope")).toBe(false);
    expect(() => assertFlagKey("nope")).toThrow(/unknown feature flag/);
    await expect(getFlag("nope" as never)).rejects.toThrow(/unknown feature flag/);
  });

  it("parses env values", () => {
    expect(parseFlagValue("true")).toBe(true);
    expect(parseFlagValue(" 1 ")).toBe(true);
    expect(parseFlagValue("FALSE")).toBe(false);
    expect(parseFlagValue("0")).toBe(false);
    expect(parseFlagValue("")).toBeUndefined();
    expect(parseFlagValue("yes")).toBeUndefined();
    expect(parseFlagValue(undefined)).toBeUndefined();
  });

  it("falls back to the default when neither env nor loader answers", async () => {
    expect(await getFlag("bundles")).toBe(false);
    expect(await getFlag("three_hero")).toBe(true);
    setFlagLoader(() => Promise.resolve(undefined));
    expect(await getFlag("three_hero")).toBe(true);
  });

  it("env beats loader beats default", async () => {
    const loader = vi.fn(() => Promise.resolve(true));
    setFlagLoader(loader);
    expect(await getFlag("bundles")).toBe(true);
    expect(loader).toHaveBeenCalledWith("bundles");

    process.env.FEATURE_BUNDLES = "false";
    loader.mockClear();
    expect(await getFlag("bundles")).toBe(false);
    expect(loader).not.toHaveBeenCalled();
    expect(getFlagFromEnv("bundles")).toBe(false);
  });

  it("caches loader answers for the TTL and re-reads afterwards", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T00:00:00Z"));
    const loader = vi.fn(() => Promise.resolve(true));
    setFlagLoader(loader);
    expect(await getFlag("phone_otp")).toBe(true);
    expect(await getFlag("phone_otp")).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(FLAG_CACHE_TTL_MS - 1);
    await getFlag("phone_otp");
    expect(loader).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    loader.mockResolvedValueOnce(false);
    expect(await getFlag("phone_otp")).toBe(false);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("clearFlagCache forces the next call to hit the loader", async () => {
    const loader = vi.fn(() => Promise.resolve(false));
    setFlagLoader(loader);
    await getFlag("three_hero");
    clearFlagCache();
    await getFlag("three_hero");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("swallows loader errors, reports them and does not cache the failure", async () => {
    const onError = vi.fn();
    setFlagLoaderErrorHandler(onError);
    const loader = vi.fn(() => Promise.reject(new Error("db down")));
    setFlagLoader(loader);
    expect(await getFlag("bundles")).toBe(false);
    expect(onError).toHaveBeenCalledWith("bundles", expect.any(Error));
    await getFlag("bundles");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("getAllFlags returns every key", async () => {
    process.env.FEATURE_VENDOR_MARKETPLACE = "1";
    const all = await getAllFlags();
    expect(Object.keys(all).sort()).toEqual([...FLAG_KEYS].sort());
    expect(all.vendor_marketplace).toBe(true);
    expect(all.three_hero).toBe(true);
    expect(all.bundles).toBe(false);
  });
});

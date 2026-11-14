import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/app/dev/ui/sections/theme-switcher", () => ({ ThemeSwitcher: () => null }));

import ScreensLayout from "@/app/dev/screens/layout";

const KEYS = ["APP_ENV", "VERCEL", "ENABLE_DEV_SCREENS"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function setEnv(env: Record<string, string | undefined>) {
  for (const k of KEYS) {
    if (env[k] === undefined) Reflect.deleteProperty(process.env, k);
    else process.env[k] = env[k];
  }
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) Reflect.deleteProperty(process.env, k);
    else process.env[k] = saved[k];
  }
});

describe("/dev/screens production guard", () => {
  it("404s in production even on Vercel", () => {
    setEnv({ APP_ENV: "production", VERCEL: "1" });
    expect(() => ScreensLayout({ children: null })).toThrow("NEXT_NOT_FOUND");
  });
  it("404s in production off Vercel", () => {
    setEnv({ APP_ENV: "production" });
    expect(() => ScreensLayout({ children: null })).toThrow("NEXT_NOT_FOUND");
  });
  it("renders in production only with ENABLE_DEV_SCREENS=true", () => {
    setEnv({ APP_ENV: "production", VERCEL: "1", ENABLE_DEV_SCREENS: "true" });
    expect(() => ScreensLayout({ children: null })).not.toThrow();
  });
  it("renders in local and preview", () => {
    setEnv({ APP_ENV: "local" });
    expect(() => ScreensLayout({ children: null })).not.toThrow();
    setEnv({ APP_ENV: "preview", VERCEL: "1" });
    expect(() => ScreensLayout({ children: null })).not.toThrow();
  });
});

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  user: undefined as string | undefined,
}));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({ get: () => (state.cookie ? { value: state.cookie } : undefined) }),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/auth/service", () => ({
  getSession: () => Promise.resolve(state.user ? { user: { displayCurrency: state.user } } : null),
}));
vi.mock("@/modules/settings/service", () => ({
  settingsService: {
    load: () => Promise.resolve({ baseCurrency: "INR", enabledCurrencies: ["INR", "USD"] }),
  },
}));
vi.mock("@/modules/users/site-mutations", () => ({ updateMyAccountSettings: vi.fn() }));

import { CurrencySwitcher } from "@/components/site/CurrencySwitcher";
import { getDisplayCurrency } from "@/lib/display-currency";

describe("getDisplayCurrency precedence (enabled-only)", () => {
  beforeEach(() => {
    state.cookie = undefined;
    state.user = undefined;
  });
  it("user pref beats cookie, cookie beats base", async () => {
    state.cookie = "USD";
    expect((await getDisplayCurrency()).currency).toBe("USD");
    state.user = "INR";
    expect((await getDisplayCurrency()).currency).toBe("INR");
  });
  it("disabled user pref and cookie fall back to base", async () => {
    state.user = "EUR";
    state.cookie = "GBP";
    expect(await getDisplayCurrency()).toEqual({ currency: "INR", enabled: ["INR", "USD"] });
  });
});

describe("static layout / header switcher", () => {
  it("(site) layout does not read cookies", () => {
    const src = readFileSync("src/app/(site)/layout.tsx", "utf8");
    expect(src).not.toMatch(/getDisplayCurrency|next\/headers/);
  });
  it("switcher reads the current value from document.cookie after mount", async () => {
    document.cookie = "ck_currency=USD; path=/";
    render(<CurrencySwitcher currency="INR" options={["INR", "USD"]} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveTextContent("USD"));
    document.cookie = "ck_currency=; path=/; max-age=0";
  });
});

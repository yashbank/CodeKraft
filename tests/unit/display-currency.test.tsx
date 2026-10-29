import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CurrencySelect } from "@/components/account/CurrencySelect";
import { PriceBlock } from "@/components/site/PriceBlock";
import { currencySymbol, resolveDisplayCurrency } from "@/lib/display-currency";
import { setFxProvider, StaticFxProvider } from "@/lib/fx";
import { convertMinor } from "@/lib/money";
import { cardFromPrice, resolveOfferingPrice } from "@/modules/offerings/pricing";

describe("resolveDisplayCurrency", () => {
  it("uses the cookie when enabled", () => {
    expect(resolveDisplayCurrency("USD", ["INR", "USD"], "INR")).toBe("USD");
  });
  it("falls back to base when the cookie currency is disabled or invalid", () => {
    expect(resolveDisplayCurrency("EUR", ["INR", "USD"], "INR")).toBe("INR");
    expect(resolveDisplayCurrency("XXX", ["INR", "USD"], "INR")).toBe("INR");
    expect(resolveDisplayCurrency(undefined, ["INR", "USD"], "INR")).toBe("INR");
  });
  it("symbols", () => {
    expect(currencySymbol("INR")).toBe("₹");
    expect(currencySymbol("USD")).toBe("$");
  });
});

describe("conversion math (2 minor-unit digits, half-up)", () => {
  it("rounds half away from zero in minor units", () => {
    expect(convertMinor(100_000, "0.012")).toBe(1200); // ₹1000 -> $12.00
    expect(convertMinor(1, "0.5")).toBe(1); // 0.5 minor rounds up
    expect(convertMinor(999, "0.012")).toBe(12); // 11.988 -> 12
    expect(convertMinor(41, "0.012")).toBe(0); // 0.492 -> 0
  });
});

describe("CurrencySelect", () => {
  it("lists only the given options", async () => {
    render(<CurrencySelect value="INR" options={["INR", "USD"]} />);
    Element.prototype.scrollIntoView = () => undefined; // jsdom lacks it; Radix calls it on open
    screen.getByRole("combobox").focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["INR", "USD"]);
  });
});

describe("PriceBlock", () => {
  it("shows ≈ only for converted prices", () => {
    const amount = { amountMinor: 1200, currency: "USD" as const };
    const { container, rerender } = render(<PriceBlock amount={amount} approx />);
    expect(container.textContent).toContain("≈ $12.00");
    rerender(<PriceBlock amount={amount} />);
    expect(container.textContent).not.toContain("≈");
  });
});

describe("offering prices", () => {
  setFxProvider(new StaticFxProvider());
  const rows = [
    { amountMinor: 100_000, currency: "INR" },
    { amountMinor: 2_000, currency: "USD" },
  ];
  it("card: explicit native price is not converted", async () => {
    const r = await cardFromPrice(rows, "USD");
    expect(r).toEqual({ money: { amountMinor: 2_000, currency: "USD" }, approx: false });
  });
  it("card: converts INR price with approx flag", async () => {
    const r = await cardFromPrice(rows, "GBP");
    expect(r).toEqual({ money: { amountMinor: 950, currency: "GBP" }, approx: true });
  });
  it("checkout price resolution keeps explicit native price (charge currency unchanged)", async () => {
    const p = await resolveOfferingPrice(
      [
        { currency: "INR", amountMinor: 100_000, compareAtMinor: null },
        { currency: "USD", amountMinor: 2_000, compareAtMinor: null },
      ] as never,
      "USD",
    );
    expect(p).toMatchObject({ currency: "USD", amountMinor: 2_000, explicit: true });
  });
});

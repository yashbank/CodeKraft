"use server";

/**
 * Customer settings Server Actions (API-AUTH-04, PHASE-03 P3.3).
 * Updates user account preferences (displayCurrency, themePref) and refreshes visitor cookies.
 */
import { eq } from "drizzle-orm";
import { defineAction } from "@/lib/actions/envelope";
import { AppError, ErrorCode } from "@/lib/errors";
import { getFlagFromEnv } from "@/lib/feature-flags";
import type { Currency } from "@/lib/money";
import type { ThemeName } from "@/lib/theme";
import { users } from "../../../drizzle/schema/auth";
import { settingsService } from "../settings/service";
import { CURRENCY_COOKIE, VISITOR_COOKIE_MAX_AGE_S } from "../settings/types";
import { updateAccountSettingsSchema } from "./contracts";
import type { AccountSettings } from "./types";

export const updateAccountSettingsAction = defineAction({
  name: "API-AUTH-04 user.updateSettings",
  input: updateAccountSettingsSchema,
  handler: async (
    input,
    ctx,
  ): Promise<{
    settings: AccountSettings;
    cookies: { ck_currency?: string; ck_theme?: string };
  }> => {
    if (input.themePref === "light-editorial") {
      const isEnabled =
        getFlagFromEnv("theme_light_editorial") ??
        (await settingsService.loadFlag("theme_light_editorial")) ??
        false;
      if (!isEnabled) {
        throw new AppError(ErrorCode.FORBIDDEN, "Theme light-editorial is disabled");
      }
    }

    const { db } = await import("@/lib/db");
    const updateValues: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.displayCurrency !== undefined) {
      updateValues.displayCurrency = input.displayCurrency;
    }
    if (input.themePref !== undefined) {
      updateValues.themePref = input.themePref;
    }

    const [updated] = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, ctx.userId))
      .returning({
        displayCurrency: users.displayCurrency,
        themePref: users.themePref,
      });

    const displayCurrency = (updated?.displayCurrency ?? "INR") as Currency;
    const themePref = (updated?.themePref ?? null) as ThemeName | null;

    const cookieValues: { ck_currency?: string; ck_theme?: string } = {
      ck_currency: displayCurrency,
      ck_theme: themePref ?? undefined,
    };

    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      if (cookieValues.ck_currency) {
        cookieStore.set(CURRENCY_COOKIE, cookieValues.ck_currency, {
          maxAge: VISITOR_COOKIE_MAX_AGE_S,
          path: "/",
          sameSite: "lax",
        });
      }
      if (cookieValues.ck_theme) {
        cookieStore.set("ck_theme", cookieValues.ck_theme, {
          maxAge: VISITOR_COOKIE_MAX_AGE_S,
          path: "/",
          sameSite: "lax",
        });
      }
    } catch {
      // In test runner or non-Next runtime, next/headers cookies() may not be available
    }

    return {
      settings: {
        displayCurrency,
        themePref,
      },
      cookies: cookieValues,
    };
  },
});

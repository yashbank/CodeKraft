"use server";

import { eq } from "drizzle-orm";

import { isThemePref } from "@/lib/theme";
import { users } from "../../../drizzle/schema/auth";

/**
 * P14-12b: save the visitor's theme choice. Signed-in users get it stored on `users.theme_pref`
 * (so it follows them across devices, site, account and admin); anonymous visitors keep only the
 * `ck_theme` cookie the client already wrote. Honours the admin "visitors can switch theme" setting.
 */
export async function setThemePreference(raw: unknown): Promise<{ ok: boolean; saved: boolean }> {
  if (!isThemePref(raw)) return { ok: false, saved: false };
  try {
    const { getThemeConfig } = await import("@/lib/site-brand");
    if (!(await getThemeConfig()).themeToggle) return { ok: false, saved: false };
    const { getSession } = await import("@/modules/auth/service");
    const session = await getSession();
    if (!session) return { ok: true, saved: false };
    const { db } = await import("@/lib/db");
    await db
      .update(users)
      .set({ themePref: raw, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
    return { ok: true, saved: true };
  } catch {
    return { ok: false, saved: false };
  }
}

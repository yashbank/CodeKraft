"use server";

/**
 * Thin server-action wrapper around the settings module's `defineAction` mutation, so an admin
 * `"use client"` component can call it directly by name without constructing a `RequestContext`
 * itself. The `settings.write` permission check still happens inside `updateSettingsAction` —
 * this layer only supplies `ctx` and revalidates. Mirrors `src/modules/catalog/admin-mutations.ts`
 * / `src/modules/media/admin-mutations.ts`.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/envelope";
import { fail, validateInput } from "@/lib/actions/envelope";
import { assertPermission } from "@/lib/authz/assert";
import type { Context } from "@/lib/authz/context";
import { razorpayModeSchema } from "./contracts";

async function withCtx<T>(
  action: (raw: unknown, ctx: Context) => Promise<ActionResult<T>>,
  raw: unknown,
): Promise<ActionResult<T>> {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    const result = await action(raw, ctx);
    if (result.ok) {
      revalidatePath("/", "layout");
    }
    return result;
  } catch (err) {
    return fail(err);
  }
}

export async function updateSettings(raw: unknown) {
  const { updateSettingsAction } = await import("./actions");
  return withCtx(updateSettingsAction, raw);
}

/**
 * Admin-UI-facing patch for the Razorpay settings sub-form (`SettingsScreen`'s "Payments"
 * section): `keySecret`/`webhookSecret` are OPTIONAL here — present only when the admin actually
 * typed a replacement. The masked placeholder the form shows (last 4 chars) is never sent back as
 * if it were real; when a secret is omitted, this merges in the current PERSISTED (decrypted)
 * value before delegating to the real `updateSettingsAction`, whose `razorpaySettingsSchema` is a
 * `strictObject` and needs the full triple on every write. `enabled` patches the
 * `provider_razorpay` feature flag via the same `updateSettingsAction.patch.flags` path every
 * other flag write already uses — no new flag-storage mechanism.
 */
const razorpaySettingsPatchInput = z
  .object({
    mode: razorpayModeSchema,
    keyId: z.string().trim().max(200).nullable(),
    keySecret: z.string().trim().max(500).optional(),
    webhookSecret: z.string().trim().max(500).optional(),
    enabled: z.boolean(),
  })
  .strict();

export async function updateRazorpaySettings(raw: unknown) {
  try {
    const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
    const ctx = await getAdminRequestContext();
    // Defense in depth: `updateSettingsAction` enforces this too, but checking first avoids
    // decrypting the current secret below for a caller who isn't allowed to see it at all.
    assertPermission(ctx, "settings.write");

    const input = validateInput(razorpaySettingsPatchInput, raw);
    const { settingsService } = await import("./service");
    const current = await settingsService.load();
    const existing = current.razorpaySettings;

    const nextRazorpaySettings = {
      mode: input.mode,
      keyId: input.keyId && input.keyId.length > 0 ? input.keyId : null,
      keySecret:
        input.keySecret && input.keySecret.length > 0
          ? input.keySecret
          : (existing?.keySecret ?? null),
      webhookSecret:
        input.webhookSecret && input.webhookSecret.length > 0
          ? input.webhookSecret
          : (existing?.webhookSecret ?? null),
    };

    const { updateSettingsAction } = await import("./actions");
    const result = await updateSettingsAction(
      {
        patch: {
          razorpaySettings: nextRazorpaySettings,
          flags: { provider_razorpay: input.enabled },
        },
      },
      ctx,
    );
    if (result.ok) {
      revalidatePath("/", "layout");
    }
    return result;
  } catch (err) {
    return fail(err);
  }
}

"use server";

/**
 * Settings export / import server actions (P14-12a). Super Admin only (checked here on top of
 * `settings.write`, which `updateSettings` enforces). Export and import are both audit-logged;
 * the write itself goes through `updateSettings`, which audits each changed key with before/after.
 */
import { revalidatePath } from "next/cache";
import { fail, ok } from "@/lib/actions/envelope";
import { audit } from "@/lib/audit-port";
import type { RequestContext } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  buildSettingsExport,
  diffSettings,
  parseSettingsImport,
  patchFromDiff,
  type SettingDiff,
} from "./transfer";

async function superAdminCtx(): Promise<RequestContext> {
  const { getAdminRequestContext } = await import("@/lib/authz/admin-request-context");
  const ctx = await getAdminRequestContext();
  if (!ctx.roles.includes("super_admin")) throw new AppError(ErrorCode.FORBIDDEN);
  return ctx;
}

export async function exportSettingsFile() {
  try {
    const ctx = await superAdminCtx();
    const { settingsService } = await import("./service");
    const file = buildSettingsExport(await settingsService.load());
    await audit({
      action: "settings.exported",
      actorId: ctx.userId,
      actorRole: "super_admin",
      subjectType: "settings",
      subjectId: "site_settings",
    });
    return ok({ json: JSON.stringify(file, null, 2), filename: "codekraft-settings.json" });
  } catch (err) {
    return fail(err);
  }
}

async function diffFor(text: string) {
  const parsed = parseSettingsImport(String(text ?? ""));
  if (!parsed.ok) throw new AppError(ErrorCode.VALIDATION, parsed.error);
  const { settingsService } = await import("./service");
  const current = await settingsService.load();
  return { patch: parsed.patch, diff: diffSettings(current, parsed.patch) };
}

/** Validates the file and returns the diff against the live settings; writes nothing. */
export async function previewSettingsImport(text: string) {
  try {
    await superAdminCtx();
    const { diff } = await diffFor(text);
    return ok({ diff: diff satisfies SettingDiff[] });
  } catch (err) {
    return fail(err);
  }
}

/** Re-validates server-side (never trusts the preview) and applies only the changed keys. */
export async function applySettingsImport(text: string) {
  try {
    const ctx = await superAdminCtx();
    const { patch, diff } = await diffFor(text);
    if (diff.length === 0) return ok({ applied: 0 });
    const { updateSettingsAction } = await import("./actions");
    const result = await updateSettingsAction({ patch: patchFromDiff(patch, diff) }, ctx);
    if (!result.ok) return result;
    await audit({
      action: "settings.imported",
      actorId: ctx.userId,
      actorRole: "super_admin",
      subjectType: "settings",
      subjectId: "site_settings",
      meta: { keys: diff.map((d) => d.key) },
    });
    revalidatePath("/", "layout");
    return ok({ applied: diff.length });
  } catch (err) {
    return fail(err);
  }
}

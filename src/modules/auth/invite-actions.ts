"use server";

/** Server-action wrappers for P10 invites / reset links / temp passwords. Secrets are returned once, never logged. */
import { headers } from "next/headers";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { AppError, ErrorCode } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { getSession } from "./service";
import { hasAdminClassRole, loadRoles } from "./roles-port";
import {
  acceptToken,
  completeForcedChange,
  createCustomerInvite,
  createCustomerWithTempPassword,
  generateUserLink,
  regenerateTempPassword,
  type TokenPurpose,
} from "./invites";

const email = z.email().max(254);
const userId = z.uuid();

function linkUrl(token: string, admin: boolean): string {
  const env = getEnv();
  const base = (admin ? env.NEXT_PUBLIC_ADMIN_URL : env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");
  return `${base}/auth/invite/${token}`;
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (err) {
    return fail(err);
  }
}

export async function inviteCustomerLink(raw: unknown) {
  return run(async () => {
    const input = z.strictObject({ email }).parse(raw);
    const { token, expiresAt } = await createCustomerInvite(await getAdminRequestContext(), input);
    return { url: linkUrl(token, false), expiresAt: expiresAt.toISOString() };
  });
}

export async function createCustomerTempPassword(raw: unknown) {
  return run(async () => {
    const input = z.strictObject({ email, name: z.string().trim().min(1).max(120) }).parse(raw);
    return createCustomerWithTempPassword(await getAdminRequestContext(), input);
  });
}

/** Invite (no password yet) or reset (has one) link for an existing user; replaces any earlier link. */
export async function generateAccessLink(raw: unknown) {
  return run(async () => {
    const input = z.strictObject({ userId }).parse(raw);
    const { token, purpose, expiresAt } = await generateUserLink(
      await getAdminRequestContext(),
      input,
    );
    const admin = hasAdminClassRole(await loadRoles(input.userId));
    return {
      url: linkUrl(token, admin),
      purpose: purpose satisfies TokenPurpose,
      expiresAt: expiresAt.toISOString(),
    };
  });
}

export async function issueTempPassword(raw: unknown) {
  return run(async () => {
    const input = z.strictObject({ userId }).parse(raw);
    return regenerateTempPassword(await getAdminRequestContext(), input);
  });
}

/** Public: set a password from an invite/reset link. */
export async function acceptLink(raw: unknown) {
  return run(async () => {
    const input = z
      .strictObject({
        token: z.string().min(20).max(100),
        password: z.string().min(1).max(128),
        name: z.string().trim().max(120).optional(),
      })
      .parse(raw);
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const res = await acceptToken({ ...input, ip });
    return { purpose: res.purpose };
  });
}

/** Authenticated: replace the temporary password and clear must_change_password. */
export async function changeTemporaryPassword(raw: unknown) {
  return run(async () => {
    const input = z
      .strictObject({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(1).max(128),
      })
      .parse(raw);
    const session = await getSession();
    if (!session) throw new AppError(ErrorCode.UNAUTHENTICATED);
    await completeForcedChange({
      userId: session.user.id,
      sessionToken: session.session.token,
      ...input,
    });
    return { ok: true as const };
  });
}

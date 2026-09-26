/**
 * Step 2 — identity (docs/05 §14, docs/10 §3).
 *
 * Super Admins are created through Better Auth (`signUpEmail`) so the credential account, argon2id
 * hash and additional fields are exactly what the app produces; the sign-up auto-session is removed
 * afterwards. Each gets a `super_admin` role row and a `partners` row (first email = CEO, second =
 * CFO). Non-production databases also get the docs/10 §3 test users through the P2.9 factories:
 * `buyer@` (verified customer), `unverified@`, `suspended@` and `partner@` (role `admin` + partner).
 */
import { eq } from "drizzle-orm";

import { getEnv } from "@/lib/env";
import { createAuth } from "@/modules/auth/config";
import { sessions, type User, userRoles, users } from "../../drizzle/schema/auth";
import { type Partner, partners } from "../../drizzle/schema/users-ext";
import {
  type CreateUserOptions,
  createPartner,
  createUser,
  findPartnerByUserId,
  findUserByEmail,
} from "../../tests/factories/users";
import { type SeedContext, tally } from "./shared";

/** Default Super Admin addresses (override with SEED_ADMIN_EMAILS). */
export const DEFAULT_ADMIN_EMAILS = [
  "yashbank2002@gmail.com",
  "sanketshrikant42@gmail.com",
] as const;
/** Default local passphrase (override with SEED_ADMIN_PASSWORD; required in production). */
export const DEFAULT_ADMIN_PASSWORD = "local-super-admin-passphrase-2026";

const PARTNER_DISPLAY_NAMES = ["CEO", "CFO"] as const;

export const TEST_USER_EMAILS = {
  buyer: "buyer@codekraft.test",
  unverified: "unverified@codekraft.test",
  suspended: "suspended@codekraft.test",
  partner: "partner@codekraft.test",
} as const;

export interface SeedAdminsOptions {
  emails: readonly string[];
  password: string;
}

export interface SeededAdmin {
  email: string;
  user: User;
  partner: Partner;
}

export async function seedSuperAdmins(
  ctx: SeedContext,
  opts: SeedAdminsOptions,
): Promise<SeededAdmin[]> {
  const { db } = ctx;
  const env = getEnv();
  const auth = createAuth("site");
  const out: SeededAdmin[] = [];
  let createdUsers = 0;
  let createdRoles = 0;
  let createdPartners = 0;

  for (const [i, email] of opts.emails.entries()) {
    let user = await findUserByEmail(email, db);
    if (user === null) {
      const res = await auth.api.signUpEmail({
        body: {
          email,
          password: opts.password,
          name: PARTNER_DISPLAY_NAMES[i] ?? email.split("@")[0] ?? "admin",
        },
        headers: new Headers({ host: new URL(env.NEXT_PUBLIC_SITE_URL).host }),
      });
      await db.update(users).set({ emailVerified: true }).where(eq(users.id, res.user.id));
      user = await findUserByEmail(email, db);
      if (user === null) throw new Error(`sign-up of ${email} did not persist a users row`);
      createdUsers += 1;
      ctx.log(`created super admin ${email}`);
    }
    // The sign-up auto-session is not wanted for seeds.
    await db.delete(sessions).where(eq(sessions.userId, user.id));

    const inserted = await db
      .insert(userRoles)
      .values({ userId: user.id, roleKey: "super_admin" })
      .onConflictDoNothing()
      .returning({ userId: userRoles.userId });
    createdRoles += inserted.length;

    let partner = await findPartnerByUserId(user.id, db);
    if (partner === null) {
      partner = await createPartner(
        { user, displayName: PARTNER_DISPLAY_NAMES[i] ?? `Partner ${i + 1}` },
        db,
      );
      createdPartners += 1;
    }
    out.push({ email, user, partner });
  }

  tally(ctx, "users", createdUsers);
  tally(ctx, "user_roles", createdRoles);
  tally(ctx, "partners", createdPartners);
  ctx.log(`${opts.emails.length} super admin(s) ensured`);
  return out;
}

/** docs/10 §3 customers + the scoped `partner@` admin — never in production. */
export async function seedTestUsers(ctx: SeedContext, password: string): Promise<void> {
  const { db } = ctx;
  let createdUsers = 0;
  let createdRoles = 0;
  let createdPartners = 0;

  const ensure = async (
    email: string,
    opts: Omit<CreateUserOptions, "email" | "password">,
  ): Promise<User> => {
    const existing = await findUserByEmail(email, db);
    if (existing !== null) return existing;
    const user = await createUser({ ...opts, email, password }, db);
    createdUsers += 1;
    return user;
  };

  await ensure(TEST_USER_EMAILS.buyer, { name: "Buyer", emailVerified: true });
  await ensure(TEST_USER_EMAILS.unverified, { name: "Unverified", emailVerified: false });
  await ensure(TEST_USER_EMAILS.suspended, {
    name: "Suspended",
    emailVerified: true,
    status: "suspended",
  });
  const usersBefore = createdUsers;
  const partnerUser = await ensure(TEST_USER_EMAILS.partner, {
    name: "Partner",
    role: "admin",
    emailVerified: true,
  });
  const partnerCreated = createdUsers > usersBefore; // createUser wrote its `admin` role row
  if ((await findPartnerByUserId(partnerUser.id, db)) === null) {
    await createPartner({ user: partnerUser, displayName: "Partner" }, db);
    createdPartners += 1;
  }
  // `createUser({ role: "admin" })` already wrote the role; this only guards a partner@ row that
  // pre-dates the seed without it (a no-op otherwise).
  const roleRows = await db
    .insert(userRoles)
    .values({ userId: partnerUser.id, roleKey: "admin" })
    .onConflictDoNothing()
    .returning({ userId: userRoles.userId });
  createdRoles += (partnerCreated ? 1 : 0) + roleRows.length;

  const [partnerRow] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(eq(partners.userId, partnerUser.id));
  if (partnerRow === undefined) throw new Error("partner@ has no partners row");

  tally(ctx, "users", createdUsers);
  tally(ctx, "user_roles", createdRoles);
  tally(ctx, "partners", createdPartners);
  ctx.log("test users ensured (buyer@, unverified@, suspended@, partner@)");
}

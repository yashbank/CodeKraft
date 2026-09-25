/**
 * Identity factories (docs/05 §1): users (+ Better Auth credential account, argon2id), roles via
 * `user_roles`, partners. The known password lets e2e/integration sign in as any factory user.
 */
import { eq } from "drizzle-orm";

import { hashPassword } from "@/modules/auth/hash";
import type { Role } from "@/lib/authz/permissions";
import { accounts, type User, userRoles, users } from "../../drizzle/schema/auth";
import { type NewPartner, type Partner, partners } from "../../drizzle/schema/users-ext";
import { type FactoryDb, one, seqLabel, toFactoryDb } from "./context";

/** Every factory user signs in with this passphrase (hashed once per process, argon2id). */
export const FACTORY_PASSWORD = "factory-passphrase-2026";

let cachedHash: Promise<string> | undefined;
/** The argon2id hash of `FACTORY_PASSWORD` (computed once — 64 MiB argon2 is ~100 ms). */
export function factoryPasswordHash(): Promise<string> {
  cachedHash ??= hashPassword(FACTORY_PASSWORD);
  return cachedHash;
}

export type UserStatus = User["status"];

export interface CreateUserOptions {
  /** `customer` (default) gets no `user_roles` row, like a Better Auth sign-up; others get one. */
  role?: Role;
  email?: string;
  name?: string;
  emailVerified?: boolean;
  status?: UserStatus;
  /** Custom password (hashed with argon2id); default `FACTORY_PASSWORD`. */
  password?: string;
  /** `false` skips the `accounts` row (OAuth-only / phone-only style user). */
  withAccount?: boolean;
  /** `user_roles.granted_by` */
  grantedBy?: string | null;
  displayCurrency?: string;
  phoneNumber?: string;
}

export async function createUser(
  opts: CreateUserOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<User> {
  const role = opts.role ?? "customer";
  const label = seqLabel(role === "customer" ? "user" : role.replace("_", "-"));
  const user = one(
    await db
      .insert(users)
      .values({
        email: opts.email ?? `${label}@factory.test`,
        name: opts.name ?? label,
        emailVerified: opts.emailVerified ?? role !== "customer",
        status: opts.status ?? "active",
        displayCurrency: opts.displayCurrency ?? "INR",
        phoneNumber: opts.phoneNumber ?? null,
      })
      .returning(),
    "users",
  );

  if (opts.withAccount !== false) {
    const password =
      opts.password === undefined ? await factoryPasswordHash() : await hashPassword(opts.password);
    await db.insert(accounts).values({
      userId: user.id,
      accountId: user.id, // Better Auth credential provider stores the user id here
      providerId: "credential",
      password,
    });
  }

  if (role !== "customer") {
    await db.insert(userRoles).values({
      userId: user.id,
      roleKey: role,
      grantedBy: opts.grantedBy ?? null,
    });
  }
  return user;
}

/** Verified `admin` user. */
export function createAdmin(
  opts: Omit<CreateUserOptions, "role"> = {},
  db: FactoryDb = toFactoryDb(),
): Promise<User> {
  return createUser({ ...opts, role: "admin" }, db);
}

/** Verified `super_admin` user. */
export function createSuperAdmin(
  opts: Omit<CreateUserOptions, "role"> = {},
  db: FactoryDb = toFactoryDb(),
): Promise<User> {
  return createUser({ ...opts, role: "super_admin" }, db);
}

export interface CreatePartnerOptions {
  /** Existing user (an admin); default creates a verified `admin`. */
  user?: Pick<User, "id" | "name">;
  userId?: string;
  displayName?: string;
  active?: boolean;
  payoutBankDetailsEnc?: NewPartner["payoutBankDetailsEnc"];
}

export async function createPartner(
  opts: CreatePartnerOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<Partner> {
  const user = opts.user ?? (opts.userId === undefined ? await createAdmin({}, db) : undefined);
  const userId = user?.id ?? opts.userId;
  if (userId === undefined) throw new Error("createPartner: userId could not be resolved");
  return one(
    await db
      .insert(partners)
      .values({
        userId,
        displayName: opts.displayName ?? user?.name ?? seqLabel("partner"),
        active: opts.active ?? true,
        payoutBankDetailsEnc: opts.payoutBankDetailsEnc ?? null,
      })
      .returning(),
    "partners",
  );
}

/** Find a user by email (case-insensitive `citext`) or `null`. */
export async function findUserByEmail(email: string, db: FactoryDb = toFactoryDb()) {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

/** Find the partner row for a user or `null`. */
export async function findPartnerByUserId(userId: string, db: FactoryDb = toFactoryDb()) {
  const [row] = await db.select().from(partners).where(eq(partners.userId, userId)).limit(1);
  return row ?? null;
}

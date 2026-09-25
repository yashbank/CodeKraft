/**
 * Idempotent seed (docs/05 §14, P1.11 skeleton). Roles come from migration 0000; this creates the
 * two Super Admin accounts through Better Auth (so hashing/accounts are correct) and assigns roles.
 * P2 extends it with partners, the five example products, content and settings.
 *
 * Env: SEED_ADMIN_EMAILS="ceo@example.com,cfo@example.com" (default two local addresses)
 *      SEED_ADMIN_PASSWORD (default a long local passphrase; NEVER the default in production)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { eq } from "drizzle-orm";

async function main() {
  const [{ getEnv }, { getDb, closeDb }, schema, { createAuth }] = await Promise.all([
    import("../src/lib/env"),
    import("../src/lib/db"),
    import("../drizzle/schema/auth"),
    import("../src/modules/auth/config"),
  ]);
  const env = getEnv();
  const emails = (process.env.SEED_ADMIN_EMAILS ?? "ceo@codekraft.local,cfo@codekraft.local")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const password = process.env.SEED_ADMIN_PASSWORD ?? "local-super-admin-passphrase-2026";
  if (env.APP_ENV === "production" && !process.env.SEED_ADMIN_PASSWORD)
    throw new Error("SEED_ADMIN_PASSWORD is required in production");

  const db = getDb();
  const auth = createAuth("site");
  for (const email of emails) {
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    let userId = existing?.id;
    if (!userId) {
      const res = await auth.api.signUpEmail({
        body: { email, password, name: email.split("@")[0] ?? "admin" },
        headers: new Headers({ host: new URL(env.NEXT_PUBLIC_SITE_URL).host }),
      });
      userId = res.user.id;
      await db.update(schema.users).set({ emailVerified: true }).where(eq(schema.users.id, userId));
      console.log(`[seed] created super admin ${email}`);
    }
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)); // sign-up auto-session is not wanted for seeds
    await db
      .insert(schema.userRoles)
      .values({ userId, roleKey: "super_admin" })
      .onConflictDoNothing();
  }
  console.log(`[seed] ${emails.length} super admin(s) ensured`);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

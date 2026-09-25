/**
 * `pnpm db:anonymise` (docs/12 §5.1) — strip customer PII from a non-production copy of the
 * database (staging is reset weekly from a production snapshot and then anonymised).
 *
 * Row counts and foreign keys are preserved: values are replaced, never deleted, except the
 * auth tokens of anonymised users (sessions, two_factor) and every `verifications` row, which
 * would otherwise let a production token sign in on staging. Append-only tables (invoices,
 * ledger_entries, allocations, payouts, credit_notes, audit_logs — docs/05 §12) are not touched;
 * they carry the legal record and their triggers would reject the update anyway.
 *
 * "Customer" = a user with no `super_admin` / `admin` / `staff` role row. Admin accounts keep their
 * identity (the founders sign in on staging with them); their payout bank details are cleared.
 * The script is re-runnable: numbering restarts from the users' creation order each time.
 */
import { sql } from "drizzle-orm";

import { getEnv } from "@/lib/env";
import { type SeedDb, countRows } from "./shared";
import { PLACEHOLDER_BANK_DETAILS, PLACEHOLDER_UPI_VPA } from "./settings";
import { users } from "../../drizzle/schema/auth";
import { leads } from "../../drizzle/schema/leads";
import { queries } from "../../drizzle/schema/queries";

export const ANON_DOMAIN = "anon.invalid";
export const REDACTED = "[redacted]";
export const ADMIN_CLASS_ROLES = ["super_admin", "admin", "staff"] as const;

export interface AnonymiseOptions {
  db: SeedDb;
  log?: (message: string) => void;
  /** Skip the APP_ENV guard (tests run with APP_ENV=local anyway). */
  allowProduction?: boolean;
}

export interface AnonymiseSummary {
  users: number;
  leads: number;
  queries: number;
  chatMessages: number;
  emails: number;
}

/** Customers = users without an admin-class role. */
const VICTIMS = sql`
  select u.id, row_number() over (order by u.created_at, u.id) as n
  from users u
  where not exists (
    select 1 from user_roles r
    where r.user_id = u.id and r.role_key in ('super_admin', 'admin', 'staff')
  )`;

export async function runAnonymise(opts: AnonymiseOptions): Promise<AnonymiseSummary> {
  const { db } = opts;
  const log = opts.log ?? (() => undefined);
  const appEnv = process.env.APP_ENV ?? getEnv().APP_ENV;
  if (appEnv === "production" && opts.allowProduction !== true)
    throw new Error("db:anonymise refuses to run against a production database");

  const [victimCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sql`(${VICTIMS}) v`);
  const usersBefore = await countRows(db, users);
  const leadsBefore = await countRows(db, leads);
  const queriesBefore = await countRows(db, queries);

  // users — two steps so the unique email index never sees a transient collision.
  await db.execute(sql`
    with v as (${VICTIMS})
    update users u set email = 'tmp-' || u.id::text || '@' || ${ANON_DOMAIN}
    from v where u.id = v.id`);
  await db.execute(sql`
    with v as (${VICTIMS})
    update users u set
      name = 'User ' || v.n::text,
      email = 'user-' || v.n::text || '@' || ${ANON_DOMAIN},
      image = null,
      phone_number = null,
      phone_number_verified = false,
      updated_at = now()
    from v where u.id = v.id`);

  // auth artefacts of anonymised users: no token from the source database may work here.
  await db.execute(sql`
    with v as (${VICTIMS})
    update accounts a set password = null, access_token = null, refresh_token = null, id_token = null,
      updated_at = now()
    from v where a.user_id = v.id`);
  await db.execute(sql`delete from sessions s using (${VICTIMS}) v where s.user_id = v.id`);
  await db.execute(sql`delete from two_factor t using (${VICTIMS}) v where t.user_id = v.id`);
  await db.execute(sql`delete from verifications`);

  await db.execute(sql`
    with v as (${VICTIMS})
    update customer_profiles p set company = null, billing_name = null, billing_address = null,
      gst_number = null, internal_notes = null, updated_at = now()
    from v where p.user_id = v.id`);

  // leads and their activity notes (free text from prospects)
  await db.execute(sql`
    with l as (select id, row_number() over (order by created_at, id) as n from leads)
    update leads x set
      name = 'Lead ' || l.n::text,
      email = case when x.email is null then null else 'lead-' || l.n::text || '@' || ${ANON_DOMAIN} end,
      phone = null,
      company = null,
      message = case when x.message is null then null else ${REDACTED} end,
      updated_at = now()
    from l where x.id = l.id`);
  await db.execute(
    sql`update lead_activities set body = ${REDACTED} where body is not null and body <> ${REDACTED}`,
  );

  // support queries: guest addresses and message bodies
  await db.execute(sql`
    with q as (select id, row_number() over (order by created_at, id) as n from queries where guest_email is not null)
    update queries x set guest_email = 'guest-' || q.n::text || '@' || ${ANON_DOMAIN}, updated_at = now()
    from q where x.id = q.id`);
  await db.execute(sql`
    update query_messages set body_json = ${JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: REDACTED }] }],
    })}::jsonb`);

  // AI transcripts
  const chat = await db.execute(
    sql`update chat_messages set content = ${REDACTED} where content <> ${REDACTED}`,
  );

  // commerce snapshots of anonymised users (orders are not append-only; invoices are and stay)
  await db.execute(sql`
    with v as (${VICTIMS})
    update orders o set
      billing_snapshot = o.billing_snapshot || jsonb_build_object(
        'name', 'User ' || v.n::text,
        'email', 'user-' || v.n::text || '@' || ${ANON_DOMAIN},
        'company', null, 'address', null, 'gst_number', null),
      updated_at = now()
    from v where o.user_id = v.id`);
  await db.execute(sql`
    update orders set
      client_name = case when client_name is null then null else 'Client ' || left(id::text, 8) end,
      client_email = case when client_email is null then null else 'client-' || left(id::text, 8) || '@' || ${ANON_DOMAIN} end,
      client_company = null,
      updated_at = now()
    where client_name is not null or client_email is not null or client_company is not null`);

  // secrets at rest
  await db.execute(
    sql`update entitlements set license_key_enc = null where license_key_enc is not null`,
  );
  await db.execute(
    sql`update partners set payout_bank_details_enc = null where payout_bank_details_enc is not null`,
  );
  await db.execute(sql`
    update site_settings set value = ${JSON.stringify(PLACEHOLDER_BANK_DETAILS)}::jsonb, updated_at = now()
    where key = 'bank_details' and value is not null and value <> 'null'::jsonb`);
  await db.execute(sql`
    update site_settings set value = ${JSON.stringify(PLACEHOLDER_UPI_VPA)}::jsonb, updated_at = now()
    where key = 'upi_vpa' and value is not null and value <> 'null'::jsonb`);

  // outbound email queue (addresses + rendered payloads)
  const emails = await db.execute(sql`
    update email_outbox set to_email = 'outbox-' || left(id::text, 8) || '@' || ${ANON_DOMAIN},
      payload = '{}'::jsonb, last_error = null, updated_at = now()
    where to_email not like '%@' || ${ANON_DOMAIN}`);

  const usersAfter = await countRows(db, users);
  const leadsAfter = await countRows(db, leads);
  const queriesAfter = await countRows(db, queries);
  if (usersAfter !== usersBefore || leadsAfter !== leadsBefore || queriesAfter !== queriesBefore)
    throw new Error("anonymise changed a row count — this must never happen");

  const summary: AnonymiseSummary = {
    users: victimCount?.n ?? 0,
    leads: leadsAfter,
    queries: queriesAfter,
    chatMessages: affected(chat),
    emails: affected(emails),
  };
  log(
    `anonymised ${summary.users} customer(s), ${summary.leads} lead(s), ${summary.queries} quer(y/ies), ${summary.chatMessages} chat message(s), ${summary.emails} outbox row(s)`,
  );
  return summary;
}

/** postgres-js reports affected rows on the result's `count`; other drivers may not. */
function affected(result: unknown): number {
  const count = (result as { count?: unknown }).count;
  return typeof count === "number" ? count : 0;
}

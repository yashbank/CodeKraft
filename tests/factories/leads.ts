/**
 * Leads, support queries and AI conversations (docs/05 §9).
 */
import {
  type Conversation,
  type PromptVersion,
  conversations,
  promptVersions,
} from "../../drizzle/schema/chat";
import { type Lead, leads } from "../../drizzle/schema/leads";
import { type Query, queries } from "../../drizzle/schema/queries";
import {
  type FactoryDb,
  addMonths,
  dateString,
  isoDate,
  nextSeq,
  one,
  seqLabel,
  toFactoryDb,
} from "./context";
import { createUser } from "./users";

export interface CreateLeadOptions {
  source?: Lead["source"];
  name?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  serviceInterest?: string[];
  budgetHint?: string | null;
  status?: Lead["status"];
  priority?: Lead["priority"];
  productId?: string | null;
  userId?: string | null;
  assignedTo?: string | null;
  nextFollowUpAt?: Date | null;
  wonOrderId?: string | null;
  turnstileVerified?: boolean;
}

export async function createLead(
  opts: CreateLeadOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<Lead> {
  const label = seqLabel("lead");
  return one(
    await db
      .insert(leads)
      .values({
        source: opts.source ?? "inquiry_form",
        name: opts.name ?? `Lead ${label.slice(-4)}`,
        email: opts.email === undefined ? `${label}@factory.test` : opts.email,
        phone: opts.phone ?? null,
        company: opts.company ?? null,
        message: opts.message ?? "We need a custom build.",
        serviceInterest: opts.serviceInterest ?? ["custom-development"],
        budgetHint: opts.budgetHint ?? null,
        status: opts.status ?? "new",
        priority: opts.priority ?? "normal",
        productId: opts.productId ?? null,
        userId: opts.userId ?? null,
        assignedTo: opts.assignedTo ?? null,
        nextFollowUpAt: opts.nextFollowUpAt ?? null,
        wonOrderId: opts.wonOrderId ?? null,
        turnstileVerified: opts.turnstileVerified ?? true,
      })
      .returning(),
    "leads",
  );
}

export interface CreateQueryOptions {
  /** Default: a new customer (unless `guestEmail` is given). */
  userId?: string | null;
  guestEmail?: string | null;
  subject?: string;
  source?: Query["source"];
  status?: Query["status"];
  orderId?: string | null;
  productId?: string | null;
  assignedTo?: string | null;
  conversationId?: string | null;
}

export async function createQuery(
  opts: CreateQueryOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<Query> {
  const guestEmail = opts.guestEmail ?? null;
  const userId =
    opts.userId === undefined
      ? guestEmail === null
        ? (await createUser({ emailVerified: true }, db)).id
        : null
      : opts.userId;
  return one(
    await db
      .insert(queries)
      .values({
        userId,
        guestEmail,
        subject: opts.subject ?? `Question ${String(nextSeq()).padStart(4, "0")}`,
        source: opts.source ?? "form",
        status: opts.status ?? "open",
        orderId: opts.orderId ?? null,
        productId: opts.productId ?? null,
        assignedTo: opts.assignedTo ?? null,
        conversationId: opts.conversationId ?? null,
      })
      .returning(),
    "queries",
  );
}

export interface CreatePromptVersionOptions {
  name?: string;
  systemPrompt?: string;
  version?: number;
  /** Only one row may be active (partial unique index); default false. */
  isActive?: boolean;
  createdBy?: string | null;
}

export async function createPromptVersion(
  opts: CreatePromptVersionOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<PromptVersion> {
  const n = nextSeq();
  return one(
    await db
      .insert(promptVersions)
      .values({
        name: opts.name ?? "site-assistant",
        systemPrompt:
          opts.systemPrompt ?? "You are the CodeKraft assistant. Answer from the catalog only.",
        version: opts.version ?? n,
        isActive: opts.isActive ?? false,
        createdBy: opts.createdBy ?? null,
      })
      .returning(),
    "prompt_versions",
  );
}

export interface CreateConversationOptions {
  userId?: string;
  promptVersionId?: string;
  model?: string;
  startedAt?: Date;
  endedAt?: Date | null;
  escalatedQueryId?: string | null;
}

export async function createConversation(
  opts: CreateConversationOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<Conversation> {
  const userId = opts.userId ?? (await createUser({ emailVerified: true }, db)).id;
  const promptVersionId = opts.promptVersionId ?? (await createPromptVersion({}, db)).id;
  const startedAt = opts.startedAt ?? new Date();
  const row = one(
    await db
      .insert(conversations)
      .values({
        userId,
        startedAt,
        endedAt: opts.endedAt ?? null,
        escalatedQueryId: opts.escalatedQueryId ?? null,
        model: opts.model ?? "fake-model",
        promptVersionId,
        purgeAfter: isoDate(addMonths(startedAt, 12)),
      })
      .returning(),
    "conversations",
  );
  return { ...row, purgeAfter: dateString(row.purgeAfter) };
}

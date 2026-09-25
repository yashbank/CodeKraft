/**
 * Lead capture helpers — API-CHAT-08 `lead_intent` (the model's `capture_lead` tool call only
 * signals intent, FR-CHAT-05, TM-08) and API-CHAT-15 `confirmLeadCapture` (the customer confirms,
 * then `leads(source='chatbot')` is written). Pure functions; the service owns the transaction.
 */
import { z } from "zod";
import type { CreateLeadFromChatbotInput } from "@/modules/leads/types";
import type { ConfirmLeadCaptureInput } from "./types";

export interface LeadIntent {
  name?: string;
  email?: string;
  need: string;
}

const toolInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.email().max(254).optional(),
    need: z.string().trim().min(1).max(2000),
  })
  .strip();

/**
 * Validate the model's `capture_lead` input into the `lead_intent` payload. Invalid or empty
 * `need` → `null` (the event is skipped); a malformed optional field is dropped, not fatal.
 */
export function leadIntentFromToolInput(input: Record<string, unknown>): LeadIntent | null {
  const need = typeof input["need"] === "string" ? input["need"].trim() : "";
  if (need === "") return null;
  const parsed = toolInputSchema.safeParse({
    need,
    ...(typeof input["name"] === "string" && input["name"].trim() !== "" ? { name: input["name"] } : {}),
    ...(typeof input["email"] === "string" ? { email: input["email"].trim() } : {}),
  });
  if (parsed.success) {
    const out: LeadIntent = { need: parsed.data.need };
    if (parsed.data.name !== undefined) out.name = parsed.data.name;
    if (parsed.data.email !== undefined) out.email = parsed.data.email;
    return out;
  }
  // Keep the intent, drop whichever optional field failed.
  const out: LeadIntent = { need: need.slice(0, 2000) };
  const name = typeof input["name"] === "string" ? input["name"].trim().slice(0, 120) : "";
  if (name !== "") out.name = name;
  const email = typeof input["email"] === "string" ? input["email"].trim() : "";
  if (z.email().max(254).safeParse(email).success) out.email = email;
  return out;
}

/**
 * `leads.createFromChatbot` input: the confirmed card wins; name/email fall back to the signed-in
 * customer's account (the lead is always tied to `user_id`).
 */
export function toLeadCreateInput(
  input: ConfirmLeadCaptureInput,
  user: { id: string; name: string; email: string },
): CreateLeadFromChatbotInput {
  const name = input.name?.trim() || user.name.trim() || user.email.split("@")[0] || "Customer";
  return {
    source: "chatbot",
    conversationId: input.conversationId,
    userId: user.id,
    name: name.slice(0, 120),
    email: input.email ?? user.email,
    message: input.need,
  };
}

export const LEAD_CAPTURED_SYSTEM_MESSAGE = "lead captured";

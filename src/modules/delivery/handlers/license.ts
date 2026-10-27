import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import {
  deliveryTasks,
  entitlements,
  type Entitlement,
} from "../../../../drizzle/schema/delivery";
import type {
  CustomerDeliveryView,
  CustomerViewSource,
  DeliveryHandler,
  DeliveryHandlerContext,
  GrantOutcome,
  RevocationInput,
  RevokeOutcome,
} from "../handler";
import type { EntitlementAdminAction } from "@/modules/entitlements/types";

/** Crockford-ish alphabet: no 0/O/1/I/L to avoid transcription mistakes. */
const KEY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** `CK-XXXX-XXXX-XXXX-XXXX` — 16 random symbols (~79 bits) from a CSPRNG. */
export function generateLicenseKey(): string {
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join("");
  return `CK-${chars.match(/.{4}/g)!.join("-")}`;
}

/** `•••• •••• •••• 4F2A` — the real last 4 of the stored key; `null` when it can't be read. */
export function maskLicenseKey(licenseKeyEnc: string): string | null {
  try {
    const key = decrypt(licenseKeyEnc).replace(/[^A-Za-z0-9]/g, "");
    return key.length >= 4 ? `•••• •••• •••• ${key.slice(-4)}` : "••••";
  } catch {
    return null;
  }
}

export class LicenseDeliveryHandler implements DeliveryHandler<"license"> {
  readonly type = "license" as const;

  async onGranted(
    ctx: DeliveryHandlerContext,
    entitlement: Entitlement,
    tx: TxCtx,
  ): Promise<GrantOutcome> {
    // R8-03: "Automated" provisioning issues a key the moment payment is confirmed, so the
    // customer sees it on Account -> Purchases straight away. No task is opened.
    if (ctx.offering.deliveryConfig.provisioning === "automated") {
      await tx
        .update(entitlements)
        .set({ licenseKeyEnc: encrypt(generateLicenseKey()), updatedAt: new Date() })
        .where(eq(entitlements.id, entitlement.id));
      return { status: "active", provisioningState: "done", taskIds: [], emails: [] };
    }

    // Manual: active with provisioning_state='pending' and an open 'provision' task; an admin
    // sets the key from Admin -> Entitlements ("Set licence key", API-DEL-08).
    const [task] = await tx
      .insert(deliveryTasks)
      .values({
        entitlementId: entitlement.id,
        kind: "provision",
        status: "open",
      })
      .returning({ id: deliveryTasks.id });

    return {
      status: "active",
      provisioningState: "pending",
      taskIds: task ? [task.id] : [],
      emails: [],
    };
  }

  async onRevoked(
    _ctx: DeliveryHandlerContext,
    _entitlement: Entitlement,
    _revocation: RevocationInput,
    _tx: TxCtx,
  ): Promise<RevokeOutcome> {
    return {
      automatic: true,
    };
  }

  customerView(source: CustomerViewSource): CustomerDeliveryView {
    const isSuspendedOrRevoked =
      source.entitlement.status === "suspended" ||
      source.entitlement.status === "expired" ||
      source.entitlement.status === "revoked";

    const keyIssued = Boolean(source.entitlement.licenseKeyEnc);

    // Masked view: •••• •••• •••• 4F2A or null
    let licenseKeyMasked: string | null = null;
    if (!isSuspendedOrRevoked && source.entitlement.licenseKeyEnc) {
      licenseKeyMasked = maskLicenseKey(source.entitlement.licenseKeyEnc);
    }

    return {
      type: "license",
      licenseKeyMasked,
      keyIssued,
    };
  }

  adminActions(entitlement: Entitlement): EntitlementAdminAction[] {
    const isRevoked = entitlement.status === "revoked";
    return [
      {
        key: "set_license_key",
        label: "Set License Key",
        apiId: "API-DEL-08",
        enabled: !isRevoked,
      },
      {
        key: "extend_access",
        label: "Extend Access",
        apiId: "API-DEL-14",
        enabled: !isRevoked,
      },
      {
        key: "revoke",
        label: "Revoke Access",
        apiId: "API-DEL-12",
        enabled: !isRevoked,
      },
    ];
  }

  isFulfilled(entitlement: Entitlement): boolean {
    return Boolean(entitlement.licenseKeyEnc);
  }
}

export const licenseDeliveryHandler = new LicenseDeliveryHandler();

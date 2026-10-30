// @vitest-environment node
import { describe, expect, it } from "vitest";

import { SITE_SETTINGS_DEFAULTS } from "@/modules/settings/contracts";
import {
  buildSettingsExport,
  diffSettings,
  parseSettingsImport,
  patchFromDiff,
} from "@/modules/settings/transfer";
import type { SiteSettings } from "@/modules/settings/types";

const withSecrets: SiteSettings = {
  ...SITE_SETTINGS_DEFAULTS,
  razorpaySettings: { mode: "test", keyId: "rzp_test_x", keySecret: "s3cret", webhookSecret: "w" },
  bankDetails: {
    accountName: "CodeKraft",
    accountNumber: "123456789012",
    ifsc: "HDFC0001234",
    bankName: "HDFC",
  },
};

describe("P14-12a settings export/import", () => {
  it("export drops secrets", () => {
    const file = buildSettingsExport(withSecrets, new Date("2026-10-30T00:00:00Z"));
    expect(file.settings).not.toHaveProperty("razorpaySettings");
    expect(file.settings).not.toHaveProperty("bankDetails");
    expect(JSON.stringify(file)).not.toMatch(/s3cret|123456789012/);
    expect(file.settings.siteName).toBe("CodeKraft");
  });

  it("round-trips: an unchanged export imports with an empty diff", () => {
    const text = JSON.stringify(buildSettingsExport(withSecrets));
    const parsed = parseSettingsImport(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(diffSettings(withSecrets, parsed.patch)).toEqual([]);
  });

  it("rejects bad JSON, wrong format, unknown keys, invalid values and secrets", () => {
    const base = buildSettingsExport(withSecrets);
    const wrap = (settings: Record<string, unknown>) => JSON.stringify({ ...base, settings });
    expect(parseSettingsImport("{nope")).toMatchObject({ ok: false });
    expect(parseSettingsImport(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false });
    expect(parseSettingsImport(wrap({ notASetting: 1 }))).toMatchObject({ ok: false });
    expect(parseSettingsImport(wrap({ taxRateBps: 99999999 }))).toMatchObject({ ok: false });
    expect(parseSettingsImport(wrap({ gstin: "bad" }))).toMatchObject({ ok: false });
    const sec = parseSettingsImport(wrap({ razorpaySettings: withSecrets.razorpaySettings }));
    expect(sec).toMatchObject({ ok: false });
    expect(sec.ok === false && sec.error).toMatch(/Secrets/);
  });

  it("diff + patch cover only what changes, flags per flag", () => {
    const text = JSON.stringify(
      buildSettingsExport({
        ...withSecrets,
        siteName: "Renamed",
        flags: { ...withSecrets.flags, bundles: true },
      }),
    );
    const parsed = parseSettingsImport(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const diff = diffSettings(withSecrets, parsed.patch);
    expect(diff.map((d) => d.key).sort()).toEqual(["flags.bundles", "siteName"]);
    expect(patchFromDiff(parsed.patch, diff)).toEqual({
      siteName: "Renamed",
      flags: { bundles: true },
    });
  });
});

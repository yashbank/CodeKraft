import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

process.env.APP_ENCRYPTION_KEY ??= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
import { encrypt } from "@/lib/crypto";
import { downloadDeliveryHandler } from "@/modules/delivery/handlers/download";
import { licenseDeliveryHandler } from "@/modules/delivery/handlers/license";
import { LicensePanel } from "@/components/account/delivery/LicensePanel";
import { DownloadPanel } from "@/components/account/delivery/DownloadPanel";

const rf = (version: string) => ({
  mediaId: `m-${version}`,
  version,
  name: `app-${version}.zip`,
  sizeBytes: 1024,
  releasedAt: new Date("2026-10-01"),
  notes: null,
});
const src = (status: string, extra: Record<string, unknown> = {}) =>
  ({
    entitlement: { status, downloadsUsed: 0, downloadCap: null, ...extra },
    releaseFiles: [rf("2.0.0"), rf("1.0.0")],
  }) as never;
const KEY = "CK-AAAA-BBBB-CCCC-9F2Q";

describe("P8-02 customer views", () => {
  afterEach(cleanup);

  it("active download entitlement lists every provided version", () => {
    const v = downloadDeliveryHandler.customerView(src("active"));
    expect(v.type === "download" && v.downloads.files.map((f) => f.version)).toEqual([
      "2.0.0",
      "1.0.0",
    ]);
  });

  it("unpaid (pending) download entitlement lists none", () => {
    const v = downloadDeliveryHandler.customerView(src("pending"));
    expect(v.type === "download" && v.downloads.files).toEqual([]);
  });

  it("licence: key present is revealable, absent is 'being prepared', unpaid shows nothing", () => {
    const withKey = licenseDeliveryHandler.customerView(
      src("active", { licenseKeyEnc: encrypt(KEY) }),
    );
    expect(withKey.type === "license" && withKey.licenseKeyMasked).toBe("•••• •••• •••• 9F2Q");
    const broken = licenseDeliveryHandler.customerView(src("active", { licenseKeyEnc: "bad" }));
    expect(broken.type === "license" && broken.licenseKeyMasked).toBeTruthy();
    const none = licenseDeliveryHandler.customerView(src("active", { licenseKeyEnc: null }));
    expect(none.type === "license" && none.licenseKeyMasked).toBeNull();
    const unpaid = licenseDeliveryHandler.customerView(
      src("pending", { licenseKeyEnc: encrypt(KEY) }),
    );
    expect(unpaid.type === "license" && unpaid.licenseKeyMasked).toBeNull();
  });

  it("panels render version rows and the no-key state", () => {
    render(
      <DownloadPanel
        files={[
          { id: "a", name: "a.zip", version: "2.0.0", sizeLabel: "1 KB", releasedAt: "2026-10-01" },
          { id: "b", name: "b.zip", version: "1.0.0", sizeLabel: "1 KB", releasedAt: "2026-09-01" },
        ]}
        downloadsUsed={0}
        downloadsCap={0}
        queryHref="/q"
      />,
    );
    expect(screen.getAllByRole("button", { name: /download/i })).toHaveLength(2);
    cleanup();
    render(<LicensePanel />);
    expect(screen.getByText(/Being prepared/)).toBeTruthy();
  });
});

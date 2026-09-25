import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { catalogService } from "@/modules/catalog/service";
import { AppError } from "@/lib/errors";
import { createAdmin } from "../../factories/users";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { db } from "@/lib/db";
import { media } from "../../../drizzle/schema/media";
import { releaseFiles } from "../../../drizzle/schema/delivery";
import { products } from "../../../drizzle/schema/catalog";

describe("product versions and release files (API-CAT-07, D-604, PHASE-03 P3.7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("creates a product version with release file and updates current_version", async () => {
    await truncateAll();
    const admin = await createAdmin();
    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-version-release" },
      roles: ["admin"],
    });

    const prodRes = await catalogService.createProduct(adminCtx, {
      name: "Versioned Product",
      slug: "versioned-product",
      shortDescription: "Product testing version and release file creation",
    });

    // Create a dummy private media row for the release file
    const [mediaRow] = await db
      .insert(media)
      .values({
        bucket: "private",
        objectKey: "media/2026/09/build-v1-0-0.zip",
        mime: "application/zip",
        sizeBytes: 15_000_000,
        checksum: "abc1234567890abcdef",
        visibility: "private",
        uploadedBy: admin.id,
      })
      .returning();

    // Create version 1.0.0 with release file
    const v1 = await catalogService.createProductVersion(adminCtx, {
      productId: prodRes.productId,
      version: "1.0.0",
      changelogJson: {
        summary: "Initial production release",
        added: ["Core features", "Next.js support"],
      },
      releaseFile: {
        mediaId: mediaRow!.id,
        notes: "MD5 checksum verified",
      },
    });

    expect(v1.version.version).toBe("1.0.0");

    // Verify release_files row
    const [rf] = await db
      .select()
      .from(releaseFiles)
      .where(eq(releaseFiles.productId, prodRes.productId));
    expect(rf).toBeDefined();
    expect(rf?.version).toBe("1.0.0");
    expect(rf?.mediaId).toBe(mediaRow!.id);
    expect(rf?.notes).toBe("MD5 checksum verified");

    // Verify products.current_version
    const [p] = await db
      .select({ currentVersion: products.currentVersion })
      .from(products)
      .where(eq(products.id, prodRes.productId));
    expect(p?.currentVersion).toBe("1.0.0");

    // Creating duplicate version 1.0.0 should fail with CONFLICT
    await expect(
      catalogService.createProductVersion(adminCtx, {
        productId: prodRes.productId,
        version: "1.0.0",
        changelogJson: {
          summary: "Duplicate version attempt",
        },
      }),
    ).rejects.toThrow(AppError);
  });
});

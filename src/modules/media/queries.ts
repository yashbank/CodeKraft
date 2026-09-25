/**
 * `media` read-only queries — owned by P3 (master plan §3 ownership map).
 *
 * Implements storage usage query for system widget (PHASE-03 P3.5).
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { media } from "../../../drizzle/schema/media";

export interface StorageUsageSummary {
  publicBytes: number;
  privateBytes: number;
  totalBytes: number;
  warnAtBytes: number;
  isOverWarningThreshold: boolean;
}

const STORAGE_WARN_THRESHOLD_BYTES = 7 * 1024 * 1024 * 1024; // 7 GB per P3.5

export const getStorageUsage = defineAction({
  permission: "media.upload",
  input: z.object({}),
  async handler(_input, _ctx) {
    const { db } = await import("@/lib/db");

    const rows = await db
      .select({
        bucket: media.bucket,
        visibility: media.visibility,
        totalBytes: sql<string>`coalesce(sum(${media.sizeBytes}), 0)`,
      })
      .from(media)
      .groupBy(media.bucket, media.visibility);

    let publicBytes = 0;
    let privateBytes = 0;

    for (const r of rows) {
      const bytes = Number(r.totalBytes);
      if (r.visibility === "public") {
        publicBytes += bytes;
      } else {
        privateBytes += bytes;
      }
    }

    const totalBytes = publicBytes + privateBytes;

    return {
      publicBytes,
      privateBytes,
      totalBytes,
      warnAtBytes: STORAGE_WARN_THRESHOLD_BYTES,
      isOverWarningThreshold: totalBytes >= STORAGE_WARN_THRESHOLD_BYTES,
    };
  },
});

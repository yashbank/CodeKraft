/**
 * Media (docs/05 §2 T-media): one row per stored object in MinIO/S3. The `media_kind` and
 * `media_visibility` enums are declared here and consumed by catalog, content and delivery
 * (implementation/PHASE-02.md shared-enum table).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/** Role a media object plays when attached to a product (T-product_media.kind). */
export const mediaKind = pgEnum("media_kind", [
  "image",
  "screenshot",
  "gallery",
  "video_embed",
  "video_file",
  "presentation",
  "attachment",
  "og",
]);

export const mediaVisibility = pgEnum("media_visibility", ["public", "private"]);

export const media = pgTable(
  "media",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    bucket: text("bucket").notNull(),
    objectKey: text("object_key").notNull().unique(),
    mime: text("mime").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    /** Whole seconds, video/audio only. */
    durationS: integer("duration_s"),
    /** Hex SHA-256 of the object, computed on finalize. */
    checksum: text("checksum").notNull(),
    /** BlurHash placeholder for images (docs/07 image loading). */
    blurHash: text("blur_hash"),
    visibility: mediaVisibility("visibility").notNull().default("private"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("media_uploaded_by_idx").on(t.uploadedBy),
    index("media_visibility_idx").on(t.visibility),
  ],
);

export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;

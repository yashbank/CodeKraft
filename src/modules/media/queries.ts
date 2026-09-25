/**
 * `media` read models — storage usage for the System widget (`dashboard.admin`; warns at 7 GB,
 * NFR-OPS-03) and a product's media block (`catalog.read`).
 */
import { z } from "zod";
import { defineAction } from "@/lib/actions/envelope";
import { uuidSchema } from "@/modules/_shared/zod";
import { mediaService } from "./service";

export const getStorageUsage = defineAction({
  name: "API-ADM-14 media.storage_usage",
  permission: "dashboard.admin",
  input: z.strictObject({}).optional(),
  handler: (_input, ctx) => mediaService.storageUsage(ctx),
});

export const listProductMedia = defineAction({
  name: "API-CAT-19 product_media.list",
  permission: "catalog.read",
  input: z.strictObject({ productId: uuidSchema }),
  handler: (input) => mediaService.listProductMedia(input.productId),
});

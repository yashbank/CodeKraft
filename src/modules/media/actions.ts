/**
 * `media` Server Actions — API-CAT-06 `attachProductMedia` / `reorderProductMedia` /
 * `detachProductMedia` (`catalog.write`, `T: catalog`), API-CAT-21 `createUploadIntent` /
 * `completeUpload` (admin `media.upload` or customer purposes; checked in the service) and the
 * §3.5 private link (`catalog.read` | `invoices.read`, audited).
 */
import { revalidateTag } from "next/cache";
import { defineAction } from "@/lib/actions/envelope";
import {
  MEDIA_CACHE_TAGS,
  attachProductMediaSchema,
  completeUploadSchema,
  createUploadIntentSchema,
  detachProductMediaSchema,
  privateMediaLinkSchema,
  reorderProductMediaSchema,
} from "./contracts";
import { mediaService } from "./service";

export const attachProductMedia = defineAction({
  name: "API-CAT-06 product_media.attach",
  permission: "catalog.write",
  input: attachProductMediaSchema,
  handler: async (input, ctx) => {
    const result = await mediaService.attachProductMedia(ctx, input);
    for (const tag of MEDIA_CACHE_TAGS.attachProductMedia) revalidateTag(tag);
    return result;
  },
});

export const reorderProductMedia = defineAction({
  name: "API-CAT-06 product_media.reorder",
  permission: "catalog.write",
  input: reorderProductMediaSchema,
  handler: async (input, ctx) => {
    const result = await mediaService.reorderProductMedia(ctx, input);
    for (const tag of MEDIA_CACHE_TAGS.reorderProductMedia) revalidateTag(tag);
    return result;
  },
});

export const detachProductMedia = defineAction({
  name: "API-CAT-06 product_media.detach",
  permission: "catalog.write",
  input: detachProductMediaSchema,
  handler: async (input, ctx) => {
    const result = await mediaService.detachProductMedia(ctx, input);
    for (const tag of MEDIA_CACHE_TAGS.detachProductMedia) revalidateTag(tag);
    return result;
  },
});

export const createUploadIntent = defineAction({
  name: "API-CAT-21 media.upload_intent",
  input: createUploadIntentSchema,
  handler: (input, ctx) => mediaService.createUploadIntent(ctx, input),
});

export const completeUpload = defineAction({
  name: "API-CAT-21 media.upload_complete",
  input: completeUploadSchema,
  handler: (input, ctx) => mediaService.completeUpload(ctx, input),
});

export const getPrivateMediaUrl = defineAction({
  name: "API-CAT-21 media.private_link",
  permission: ["catalog.read", "invoices.read"],
  input: privateMediaLinkSchema,
  handler: (input, ctx) => mediaService.getPrivateMediaUrl(ctx, input),
});

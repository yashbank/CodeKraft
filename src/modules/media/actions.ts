/**
 * `media` Server Actions — owned by P3 (master plan §3 ownership map).
 *
 * Wrapped with defineAction per SA-07.
 */
import { defineAction } from "@/lib/actions/envelope";
import { mediaService } from "./service";
import {
  attachProductMediaSchema,
  completeUploadSchema,
  createUploadIntentSchema,
  detachProductMediaSchema,
  reorderProductMediaSchema,
} from "./contracts";

export const createUploadIntentAction = defineAction({
  input: createUploadIntentSchema,
  async handler(input, ctx) {
    return await mediaService.createUploadIntent(ctx, input);
  },
});

export const completeUploadAction = defineAction({
  input: completeUploadSchema,
  async handler(input, ctx) {
    return await mediaService.completeUpload(ctx, input);
  },
});

export const attachProductMediaAction = defineAction({
  permission: "catalog.write",
  input: attachProductMediaSchema,
  async handler(input, ctx) {
    return await mediaService.attachProductMedia(ctx, input);
  },
});

export const reorderProductMediaAction = defineAction({
  permission: "catalog.write",
  input: reorderProductMediaSchema,
  async handler(input, ctx) {
    return await mediaService.reorderProductMedia(ctx, input);
  },
});

export const detachProductMediaAction = defineAction({
  permission: "catalog.write",
  input: detachProductMediaSchema,
  async handler(input, ctx) {
    return await mediaService.detachProductMedia(ctx, input);
  },
});

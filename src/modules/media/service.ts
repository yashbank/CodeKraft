/**
 * `media` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `MediaService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { MediaService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "media.<method> not implemented (P3)")`. */
export function createNotImplementedMediaService(): MediaService {
  return createNotImplemented<MediaService>("media", "P3", {
    attachProductMedia: "async",
    reorderProductMedia: "async",
    detachProductMedia: "async",
    createUploadIntent: "async",
    completeUpload: "async",
    getPrivateMediaUrl: "async",
    urlFor: "async",
    deleteObjects: "async",
  });
}

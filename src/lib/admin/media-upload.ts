/**
 * Shared presigned-PUT upload flow used by the Product Editor's Media tab and the Landing
 * Editor's hero image picker. Does the network/data flow only — callers own their own UI
 * (dropzone, progress bar, alt-text prompt, etc.).
 */
import { completeMediaUpload, createMediaUploadIntent } from "@/modules/media/admin-mutations";

export interface UploadedMedia {
  mediaId: string;
  url?: string;
}

/** `purpose` must match a key in `UPLOAD_RULES` (src/modules/media/types.ts) — e.g.
 * "product_image", "product_video", "product_presentation", "content_media". */
export async function uploadMediaFile(file: File, purpose: string): Promise<UploadedMedia> {
  const intentResult = await createMediaUploadIntent({
    purpose,
    filename: file.name,
    mime: file.type,
    sizeBytes: file.size,
  });
  if (!intentResult.ok) throw new Error(intentResult.error.message);
  const { intentId, uploadUrl, headers } = intentResult.data;

  const putRes = await fetch(uploadUrl, { method: "PUT", headers, body: file });
  if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

  const completeResult = await completeMediaUpload({ intentId });
  if (!completeResult.ok) throw new Error(completeResult.error.message);
  return completeResult.data;
}

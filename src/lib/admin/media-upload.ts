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

  let putRes: Response;
  try {
    putRes = await fetch(uploadUrl, { method: "PUT", headers, body: file });
  } catch {
    // `fetch` *throwing* here (as opposed to resolving with a non-ok response, handled below)
    // means the browser never got an HTTP response back from the storage bucket at all — the
    // near-universal cause is a CORS preflight rejection: this PUT goes directly from the
    // browser to the R2 bucket's own origin (docs/12-DEVOPS-DEPLOYMENT.md §6 "CORS (public and
    // private buckets)"), which requires the bucket's CORS policy to explicitly allow this
    // site's origin. That's infra config on the bucket itself (Cloudflare dashboard), not
    // something this app's code, `tsc`, server logs or curl can set or detect — CORS is
    // enforced entirely client-side, so a bare "Failed to fetch" here told the admin nothing.
    throw new Error(
      "Upload couldn't reach storage. This usually means the storage bucket's CORS policy " +
        "doesn't allow this site's origin yet — check the browser DevTools Console/Network tab " +
        "for a message containing \"CORS\", then add this origin to the bucket's CORS settings.",
    );
  }
  if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

  const completeResult = await completeMediaUpload({ intentId });
  if (!completeResult.ok) throw new Error(completeResult.error.message);
  return completeResult.data;
}

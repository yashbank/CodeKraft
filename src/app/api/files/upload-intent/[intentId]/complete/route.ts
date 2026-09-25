/**
 * `POST /api/files/upload-intent/<intentId>/complete` (docs/06 §3.5): HEADs the object, verifies
 * size/MIME/magic bytes, inserts `media` and marks the intent consumed. 404 unknown, 409
 * `STATE_INVALID` consumed/expired, 400 `VALIDATION` on mismatch (object deleted).
 */
import { validateInput } from "@/lib/actions/envelope";
import { requireContext } from "@/lib/authz/context";
import { completeUploadSchema } from "@/modules/media/contracts";
import { handleRoute } from "@/modules/media/http";
import { mediaService } from "@/modules/media/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ intentId: string }> }) {
  return handleRoute(req, async (ctx) => {
    const { intentId } = await context.params;
    const input = validateInput(completeUploadSchema, { intentId });
    return mediaService.completeUpload(requireContext(ctx), input);
  });
}

/**
 * `POST /api/files/upload-intent` (docs/06 §3.5, API-CAT-21): auth `media.upload` (admin) or a
 * customer session for `query_attachment` / `avatar`; validates purpose/MIME/size, writes
 * `files_upload_intents` and returns a 15-minute presigned PUT. Rate class `upload`.
 */
import { validateInput } from "@/lib/actions/envelope";
import { requireContext } from "@/lib/authz/context";
import { createUploadIntentSchema } from "@/modules/media/contracts";
import { handleRoute, readJsonBody } from "@/modules/media/http";
import { mediaService } from "@/modules/media/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleRoute(req, async (ctx) => {
    const input = validateInput(createUploadIntentSchema, await readJsonBody(req));
    return mediaService.createUploadIntent(requireContext(ctx), input);
  });
}

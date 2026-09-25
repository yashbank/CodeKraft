/**
 * `POST /api/files/complete` with `{ intentId }` — body-form alias of
 * `/api/files/upload-intent/<intentId>/complete` (same handler, docs/06 §3.5).
 */
import { validateInput } from "@/lib/actions/envelope";
import { requireContext } from "@/lib/authz/context";
import { completeUploadSchema } from "@/modules/media/contracts";
import { handleRoute, readJsonBody } from "@/modules/media/http";
import { mediaService } from "@/modules/media/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleRoute(req, async (ctx) => {
    const input = validateInput(completeUploadSchema, await readJsonBody(req));
    return mediaService.completeUpload(requireContext(ctx), input);
  });
}

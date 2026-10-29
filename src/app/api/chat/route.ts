/**
 * POST /api/chat — docs/06 §3.2, PHASE-06 P6.7.
 * Server-Sent Events stream for AI chatbot completions.
 */
import { NextResponse } from "next/server";
import { resolveRouteContext } from "@/lib/authz/resolve-route-context";
import { requireContext } from "@/lib/authz/context";
import { ErrorCode, isAppError } from "@/lib/errors";
import { getDb } from "@/lib/db";
import { resolveOwnAttachments } from "@/modules/media/attachments";
import { chatService } from "@/modules/chat/service";
import { getLLMProvider } from "@/modules/chat/providers";
import { encodeSse } from "@/modules/chat/sse";
import { sendMessageSchema } from "@/modules/chat/types";

export async function POST(req: Request) {
  try {
    const ctx = await resolveRouteContext(req);
    const authedCtx = requireContext(ctx);

    const body = await req.json();
    const parse = sendMessageSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: ErrorCode.VALIDATION,
            message: parse.error.issues[0]?.message ?? "Invalid chat input",
          },
        },
        { status: 400 },
      );
    }

    // P14-06: reject bad attachments with a clear 400 before the stream opens.
    await resolveOwnAttachments(getDb(), authedCtx.userId, parse.data.attachments ?? []);

    const provider = getLLMProvider();
    const eventStream = chatService.sendMessage(authedCtx, parse.data, provider);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const sseEvent of eventStream) {
            controller.enqueue(encodeSse(sseEvent));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (caught) {
    const err = caught as { statusCode?: number; code?: string; message?: string };
    const status = isAppError(caught) ? caught.httpStatus : (err.statusCode ?? 500);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: err.code ?? ErrorCode.INTERNAL,
          message: err.message ?? "Chat streaming failed",
        },
      },
      { status },
    );
  }
}

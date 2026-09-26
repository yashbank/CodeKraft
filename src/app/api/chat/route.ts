/**
 * POST /api/chat — docs/06 §3.2, PHASE-06 P6.7.
 * Server-Sent Events stream for AI chatbot completions.
 */
import { NextResponse } from "next/server";
import { resolveRouteContext } from "@/lib/authz/resolve-route-context";
import { requireContext } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";
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

    const provider = getLLMProvider();
    const eventStream = chatService.sendMessage(authedCtx, parse.data, provider);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const sseEvent of eventStream) {
            controller.enqueue(encodeSse(sseEvent));
          }
          controller.close();
        } catch (err: any) {
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
  } catch (err: any) {
    const status = err.statusCode ?? 500;
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

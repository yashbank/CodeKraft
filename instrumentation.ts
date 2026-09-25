import * as Sentry from "@sentry/nextjs";

/** Next.js instrumentation hook: loads Sentry per runtime and wires app-level ports once per process. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    const { bootstrapPorts } = await import("./src/lib/bootstrap");
    bootstrapPorts();
  }
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

export const onRequestError = Sentry.captureRequestError;

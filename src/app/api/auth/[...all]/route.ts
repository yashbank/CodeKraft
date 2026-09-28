import type { NextRequest } from "next/server";

import { bootstrapPorts } from "@/lib/bootstrap";
import { getAuth } from "@/modules/auth/config";
import { hostFromHeaders } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  // Belt-and-suspenders: instrumentation.ts's register() should wire this once per
  // process, but its timing isn't guaranteed on every platform. bootstrapPorts() is
  // idempotent (its own `done` guard), so calling it here too is cheap and makes real
  // auth mail delivery not depend on that hook actually having fired.
  bootstrapPorts();
  const auth = await getAuth(hostFromHeaders(req.headers));
  return auth.handler(req);
}

export { handle as GET, handle as POST };

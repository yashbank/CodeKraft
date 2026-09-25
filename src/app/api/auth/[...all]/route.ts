import type { NextRequest } from "next/server";

import { getAuth } from "@/modules/auth/config";
import { hostFromHeaders } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const auth = await getAuth(hostFromHeaders(req.headers));
  return auth.handler(req);
}

export { handle as GET, handle as POST };

"use server";

import { issueFormToken } from "./form-guard";

/** Browser-callable: returns a signed render timestamp for the time trap (see form-guard.ts). */
export async function issueFormGuardToken(): Promise<string> {
  return issueFormToken();
}

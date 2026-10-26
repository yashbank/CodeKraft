import { notFound } from "next/navigation";
import { QueryThreadScreen } from "@/components/account/QueriesScreen";
import { mapQueryThreadToSummary } from "@/lib/account/queries-view";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { ErrorCode } from "@/lib/errors";
import { getMyQueryQuery } from "@/modules/queries/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * SCR-ACC-05 (thread) — `/account/queries/[id]` (BUG-007). The list screen already links each row
 * to `${links.query}/${q.id}`, but this route never existed; `getMyQuery` is scoped to
 * `ctx.userId` and returns `NOT_FOUND` for a thread that doesn't exist or isn't the caller's, same
 * 404 handling as `purchases/[id]`.
 */
export default async function QueryThreadPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getSiteRequestContext();

  const result = await getMyQueryQuery({ queryId: id }, ctx);

  if (!result.ok) {
    if (result.error.code === ErrorCode.NOT_FOUND || result.error.code === ErrorCode.VALIDATION) {
      notFound();
    }
    throw new Error(result.error.message);
  }

  const query = mapQueryThreadToSummary(result.data);

  return (
    <QueryThreadScreen
      query={query}
      now={new Date().toISOString()}
      links={{ queries: "/account/queries" }}
    />
  );
}

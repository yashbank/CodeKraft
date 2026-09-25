/**
 * Daily knowledge reindex job — docs/06 §3.3, docs/04 §9, PHASE-03 P3.13.
 * Rebuilds knowledge_chunks table and records execution in job_runs.
 */
import { jobRuns } from "../../drizzle/schema/ops";
import { reindexAll, reindexSource, type KnowledgeSource } from "@/modules/search/indexer";

async function getDb() {
  const { db } = await import("@/lib/db");
  return db;
}

export const knowledgeReindexJob = {
  key: "knowledge.reindex" as const,

  async run(
    _now: Date = new Date(),
    options?: { sourceType?: KnowledgeSource },
  ): Promise<{ chunks: number }> {
    const startedAt = new Date();
    const db = await getDb();
    let status: "ok" | "error" = "ok";
    let chunks = 0;
    let error: string | undefined;

    try {
      if (options?.sourceType) {
        const res = await reindexSource(db, options.sourceType);
        chunks = res.chunksWritten;
      } else {
        const res = await reindexAll(db);
        chunks = res.chunks;
      }

      return { chunks };
    } catch (err: unknown) {
      status = "error";
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      try {
        await db.insert(jobRuns).values({
          job: "knowledge.reindex",
          startedAt,
          finishedAt: new Date(),
          status,
          detail: {
            chunks,
            sourceType: options?.sourceType ?? "all",
            error,
          },
        });
      } catch {
        // Non-fatal
      }
    }
  },
};

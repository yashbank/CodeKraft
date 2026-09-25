/**
 * Cron job `fx.refresh` (`daily`, docs/06 §3.3, docs/12 §2.3): fetch `open.er-api.com` base INR
 * for every enabled currency into `fx_rates`; on failure keep the previous rates and raise
 * `N: system.fx_stale` when the last success is older than 3 days. Idempotent per IST day: the
 * runner's `job_runs` window check plus `ON CONFLICT` upserts make a re-run a no-op.
 */
import { isoDate } from "@/lib/dates";
import { withTx } from "@/lib/db";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import { fxService } from "@/modules/fx/service";
import { FX_REFRESH_JOB_KEY, type FxRefreshResult } from "@/modules/fx/types";
import { settingsService } from "@/modules/settings/service";

export const key = FX_REFRESH_JOB_KEY;

export interface FxRefreshDetail extends Record<string, unknown> {
  asOf: string;
  currencies: string[];
  written: number;
  stale: boolean;
  error?: string;
}

export interface FxJobDeps {
  fx: Pick<typeof fxService, "run">;
  settings: Pick<typeof settingsService, "load">;
  tx?: <T>(fn: Parameters<typeof withTx<T>>[0]) => Promise<T>;
}

export function createFxJob(deps: FxJobDeps) {
  return async function run(ctx: JobContext): Promise<JobOutcome<FxRefreshDetail>> {
    const asOf = isoDate(ctx.now);
    const inTx = deps.tx ?? (<T>(fn: Parameters<typeof withTx<T>>[0]) => withTx(fn));
    const result: FxRefreshResult = await inTx(async (tx) => {
      const settings = await deps.settings.load(tx);
      return deps.fx.run({ asOf, currencies: settings.enabledCurrencies }, tx);
    });
    const settings = await deps.settings.load();
    const detail: FxRefreshDetail = {
      asOf,
      currencies: [...settings.enabledCurrencies],
      written: result.written,
      stale: result.stale,
    };
    if (result.error !== undefined) detail.error = result.error;
    const warnings = result.error === undefined ? undefined : [result.error];
    return {
      status: result.written === 0 && result.error !== undefined ? "error" : "ok",
      detail,
      ...(warnings === undefined ? {} : { warnings }),
    };
  };
}

export const run = createFxJob({ fx: fxService, settings: settingsService });

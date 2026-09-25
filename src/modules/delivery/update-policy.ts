/**
 * `update_policy` filter for downloadable builds — D-604, docs/06 §5.7 step 1, PHASE-05 P5.3.
 *
 *   all_free       every release file of the product
 *   during_access  files released before `access_ends_at` (lifetime → all)
 *   major_paid     files whose major version equals the major purchased at grant time
 *
 * The purchased major is derived from the release history: the newest file released at or before
 * `access_starts_at` (the grant instant); when nothing had been released yet, the earliest file.
 * Pure — the service loads `release_files` once and filters here.
 */
import type { UpdatePolicy } from "@/modules/entitlements/types";

export interface ReleaseFileLike {
  version: string;
  releasedAt: Date;
}

export interface PolicyWindow {
  updatePolicy: UpdatePolicy;
  accessStartsAt: Date;
  accessEndsAt: Date | null;
}

/** Leading integer of a version string (`v2.1.0` → 2, `3` → 3, `beta` → null). */
export function parseMajor(version: string): number | null {
  const m = /^\s*v?(\d+)/i.exec(version);
  if (m === null) return null;
  const major = Number.parseInt(m[1] as string, 10);
  return Number.isSafeInteger(major) ? major : null;
}

/** Major version the buyer purchased: newest release at/before the grant, else the earliest. */
export function purchasedMajor(files: readonly ReleaseFileLike[], accessStartsAt: Date): number | null {
  if (files.length === 0) return null;
  const sorted = [...files].sort((a, b) => a.releasedAt.getTime() - b.releasedAt.getTime());
  let candidate: ReleaseFileLike | undefined;
  for (const file of sorted) {
    if (file.releasedAt.getTime() <= accessStartsAt.getTime()) candidate = file;
  }
  return parseMajor((candidate ?? (sorted[0] as ReleaseFileLike)).version);
}

export function isReleaseAllowed(
  file: ReleaseFileLike,
  window: PolicyWindow,
  allFiles: readonly ReleaseFileLike[],
): boolean {
  switch (window.updatePolicy) {
    case "all_free":
      return true;
    case "during_access":
      return (
        window.accessEndsAt === null || file.releasedAt.getTime() <= window.accessEndsAt.getTime()
      );
    case "major_paid": {
      const bought = purchasedMajor(allFiles, window.accessStartsAt);
      const own = parseMajor(file.version);
      return bought !== null && own !== null && own === bought;
    }
  }
}

/** The subset of `files` a buyer may download under `window`, in the input order. */
export function filterReleaseFiles<T extends ReleaseFileLike>(
  files: readonly T[],
  window: PolicyWindow,
): T[] {
  return files.filter((file) => isReleaseAllowed(file, window, files));
}

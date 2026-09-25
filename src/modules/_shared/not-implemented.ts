/**
 * `NotImplemented` service skeletons (PHASE-02 P2.8).
 *
 * Every module ships a `service.ts` whose factory returns an object typed against the module's
 * frozen `*Service` contract with every member throwing
 * `AppError(INTERNAL, "<module>.<method> not implemented (<phase>)")`. P3–P6 replace the bodies
 * without changing a signature; until then the object satisfies the interface at compile time
 * and fails loudly at runtime.
 *
 * `shape` names every member of `T` exactly once (`-?` mapped type + excess-property checks), so
 * a contract change that adds or removes a member fails `tsc` in the stub as well.
 */
import { AppError, ErrorCode } from "@/lib/errors";

type AnyFn = (...args: never[]) => unknown;
type AsyncFn = (...args: never[]) => Promise<unknown>;

/**
 * Per member: `"async"` for Promise-returning methods (the stub rejects), `"sync"` for plain
 * functions (the stub throws), `{ value }` for non-function members (nested registries).
 */
export type NotImplementedShape<T> = {
  [K in keyof T]-?: T[K] extends AsyncFn ? "async" : T[K] extends AnyFn ? "sync" : { value: T[K] };
};

export function notImplementedError(module: string, method: string, phase: string): AppError {
  return new AppError(ErrorCode.INTERNAL, `${module}.${method} not implemented (${phase})`);
}

export function createNotImplemented<T extends object>(
  module: string,
  phase: string,
  shape: NotImplementedShape<T>,
): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    const kind = (shape as Record<string, "async" | "sync" | { value: unknown }>)[key];
    if (kind === "async") {
      out[key] = () => Promise.reject(notImplementedError(module, key, phase));
    } else if (kind === "sync") {
      out[key] = () => {
        throw notImplementedError(module, key, phase);
      };
    } else {
      out[key] = kind?.value;
    }
  }
  return Object.freeze(out) as T;
}

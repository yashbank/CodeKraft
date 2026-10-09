/** Narrow `T | undefined` to `T`, failing the test with a clear message. */
export function defined<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Expected ${what} to be defined`);
  }
  return value;
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/**
 * Finance toolbars keep their state in the URL (`?from=&to=&type=...`): the server page reads the
 * same params (see `lib/admin/finance-filters.ts`), so a reload or shared link shows the same
 * filtered rows and the controls reflect them.
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const get = (key: string) => sp.get(key) ?? "";

  const set = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(sp.toString());
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
      next.delete("cursor");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  const clear = (keys: string[]) => {
    const next = new URLSearchParams(sp.toString());
    for (const k of keys) next.delete(k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return { get, set, clear, active: (keys: string[]) => keys.some((k) => sp.has(k)) };
}

/** Search box state: typed locally, written to the URL 300 ms after the last keystroke. */
export function useUrlSearch(key = "q") {
  const { get, set } = useUrlFilters();
  const urlValue = get(key);
  const [value, setValue] = React.useState(urlValue);
  React.useEffect(() => setValue(urlValue), [urlValue]);
  React.useEffect(() => {
    if (value === urlValue) return;
    const t = setTimeout(() => set(key, value.trim()), 300);
    return () => clearTimeout(t);
  }, [value, urlValue, key, set]);
  return [value, setValue] as const;
}

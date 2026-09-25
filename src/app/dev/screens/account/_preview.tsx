import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Resolve `?state=` against the allowed list (first entry is the default). */
export async function readState<const T extends readonly string[]>(
  searchParams: SearchParams,
  states: T,
): Promise<T[number]> {
  const raw = (await searchParams).state;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && (states as readonly string[]).includes(value) ? value : (states[0] as T[number]);
}

/**
 * Preview chrome: screen id, spec path and the state switcher (links with `?state=`), then the
 * screen itself. Kept outside the account shell so it never leaks into the real components.
 */
export function PreviewFrame({
  id,
  title,
  spec,
  href,
  states,
  current,
  children,
}: {
  id: string;
  title: string;
  spec: string;
  href: string;
  states: readonly string[];
  current: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="border-b border-border bg-elevated/60">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-body-sm">
          <span className="font-mono text-caption text-fg-subtle">{id}</span>
          <span className="font-medium text-fg">{title}</span>
          <span className="hidden font-mono text-caption text-fg-subtle md:inline">{spec}</span>
          <nav aria-label="Preview state" className="ml-auto flex flex-wrap gap-1">
            {states.map((s) => (
              <Link
                key={s}
                href={`${href}?state=${s}`}
                aria-current={s === current ? "true" : undefined}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-caption font-semibold",
                  s === current
                    ? "border-accent bg-accent-soft text-accent-text"
                    : "border-border text-fg-muted hover:text-fg",
                )}
              >
                {s}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      {children}
    </>
  );
}

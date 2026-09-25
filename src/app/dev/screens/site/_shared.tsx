import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { SiteShell } from "@/components/site/SiteShell";
import { cn } from "@/components/ui/_utils";

import { SERVICE_OPTIONS } from "../_fixtures/site";

/** Height of the /dev/screens bar so the sticky site header sits below it. */
const DEV_BAR_OFFSET = { "--site-header-top": "41px" } as CSSProperties;

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function readState(searchParams: SearchParams, fallback = "default"): Promise<string> {
  const sp = await searchParams;
  const raw = sp.state;
  return (Array.isArray(raw) ? raw[0] : raw) ?? fallback;
}

/**
 * Preview frame: the real `SiteShell` (header + footer) around the screen, plus a small state
 * switcher so every designed state is one click away.
 */
export function SitePreview({
  href,
  states,
  current,
  transparentHeader = false,
  currentPath,
  children,
}: {
  href: string;
  states?: { id: string; label: string }[];
  current?: string;
  transparentHeader?: boolean;
  currentPath?: string;
  children: ReactNode;
}) {
  return (
    <div style={DEV_BAR_OFFSET}>
      {states && states.length > 1 ? (
        <nav aria-label="Preview states" className="border-b border-border bg-surface">
          <ul className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2 text-body-sm">
            <li className="text-fg-subtle">State:</li>
            {states.map((s) => {
              const active = (current ?? "default") === s.id;
              return (
                <li key={s.id}>
                  <Link
                    href={s.id === "default" ? href : `${href}?state=${s.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-7 items-center rounded-full border px-3 transition-colors",
                      active
                        ? "border-accent bg-accent-soft text-accent-text"
                        : "border-border text-fg-muted hover:text-fg",
                    )}
                  >
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
      <SiteShell
        serviceOptions={SERVICE_OPTIONS}
        transparentAtTop={transparentHeader}
        currentPath={currentPath}
      >
        {children}
      </SiteShell>
    </div>
  );
}

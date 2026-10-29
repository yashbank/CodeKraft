"use client";

import { BookmarkIcon, Trash2Icon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { deleteView, listViews, saveView, type SavedView } from "@/lib/admin/saved-views";

/** Current admin's id, provided by AdminShell so saved views are per user. */
export const AdminUserIdContext = React.createContext<string>("anon");

export function SavedViews({ screen }: Readonly<{ screen: string }>) {
  const userId = React.useContext(AdminUserIdContext);
  const router = useRouter();
  const pathname = usePathname();
  const qs = useSearchParams().toString();
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [name, setName] = React.useState("");
  React.useEffect(() => setViews(listViews(localStorage, userId, screen)), [userId, screen]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkIcon aria-hidden /> Views{views.length ? ` (${views.length})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <ul aria-label="Saved views" className="space-y-1">
          {views.length === 0 ? (
            <li className="text-body-sm text-fg-muted">No saved views yet.</li>
          ) : null}
          {views.map((v) => (
            <li key={v.id} className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="min-w-0 flex-1 justify-start truncate"
                onClick={() => router.replace(v.query ? `${pathname}?${v.query}` : pathname)}
              >
                {v.name}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete view ${v.name}`}
                onClick={() => setViews(deleteView(localStorage, userId, screen, v.id))}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setViews(saveView(localStorage, userId, screen, name, qs));
            setName("");
          }}
        >
          <Input
            aria-label="View name"
            placeholder="Name this view"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Save
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

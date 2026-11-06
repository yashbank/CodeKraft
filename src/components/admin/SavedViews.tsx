"use client";

import { BookmarkIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { undoToast } from "@/lib/admin/undo";
import {
  deleteView,
  listViews,
  restoreView,
  saveView,
  type SavedView,
} from "@/lib/admin/saved-views";

import { RowActions } from "./RowActions";

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
              {/* The view name is the apply target; everything else sits in the one row menu. */}
              <button
                type="button"
                className="min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-body-sm hover:bg-accent-soft"
                onClick={() => router.replace(v.query ? `${pathname}?${v.query}` : pathname)}
              >
                {v.name}
              </button>
              <RowActions
                label={`Actions for view ${v.name}`}
                actions={[
                  {
                    label: "Delete view",
                    destructive: true,
                    onSelect: () => {
                      setViews(deleteView(localStorage, userId, screen, v.id));
                      undoToast(`View “${v.name}” deleted`, () => {
                        setViews(restoreView(localStorage, userId, screen, v));
                      });
                    },
                  },
                ]}
              />
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

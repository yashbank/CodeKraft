"use client";

import * as React from "react";
import { toast } from "sonner";

import { Banner } from "../Banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RESET_CATEGORIES,
  RESET_CATEGORY_LABELS,
  expandCategories,
  type ResetCategory,
} from "@/modules/settings/site-reset-plan";
import {
  backupSiteReset,
  previewSiteReset,
  requestSiteResetAction,
} from "@/modules/settings/site-reset-actions";

/** Super-admin "Reset site data": pick, preview, download backup, type the site name, request approval. */
export function DangerZoneSection({ siteName }: { siteName: string }) {
  const [picked, setPicked] = React.useState<ResetCategory[]>([]);
  const [preview, setPreview] = React.useState<{ table: string; count: number }[] | null>(null);
  const [backedUp, setBackedUp] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const categories = expandCategories(picked); // picked + their required dependencies
  const implied = categories.filter((c) => !picked.includes(c));

  function toggle(c: ResetCategory, on: boolean) {
    setPicked((p) => (on ? [...p, c] : p.filter((x) => x !== c)));
    setPreview(null);
    setBackedUp(false); // the backup must match the current selection
  }

  async function runPreview() {
    setBusy(true);
    const res = await previewSiteReset({ categories });
    setBusy(false);
    if (res.ok) setPreview(res.data);
    else toast.error(res.error.message);
  }

  async function download() {
    setBusy(true);
    const res = await backupSiteReset({ categories });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error.message);
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackedUp(true);
  }

  async function request() {
    setBusy(true);
    const res = await requestSiteResetAction({ categories, confirmName: typed.trim() });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error.message);
    toast.success("Reset requested", { description: "Another super admin must approve it." });
    setPicked([]);
    setPreview(null);
    setBackedUp(false);
    setTyped("");
  }

  const canRequest = categories.length > 0 && backedUp && typed.trim() === siteName && !busy;

  return (
    <div className="space-y-4">
      <Banner tone="warning">
        Permanently deletes the selected data after a different super admin approves. Super admin
        accounts, settings, roles, legal pages and the audit log are always kept.
      </Banner>
      <fieldset className="space-y-2">
        <legend className="text-body-sm font-medium">Data to delete</legend>
        {RESET_CATEGORIES.map((c) => (
          <label key={c} className="flex items-center gap-2 text-body-sm">
            <Checkbox checked={picked.includes(c)} onCheckedChange={(v) => toggle(c, v === true)} />
            {RESET_CATEGORY_LABELS[c]}
          </label>
        ))}
      </fieldset>
      {implied.length ? (
        <p className="text-body-sm text-fg-muted">
          Also removed because they depend on it:{" "}
          {implied.map((c) => RESET_CATEGORY_LABELS[c]).join(", ")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!categories.length || busy}
          onClick={() => void runPreview()}
        >
          Preview row counts
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!categories.length || busy}
          onClick={() => void download()}
        >
          Download backup (JSON)
        </Button>
        {backedUp ? (
          <span className="self-center text-caption text-fg-muted">Backup downloaded</span>
        ) : null}
      </div>
      {preview ? (
        <ul className="grid gap-x-6 text-body-sm sm:grid-cols-2" aria-label="Rows to delete">
          {preview.map((r) => (
            <li key={r.table} className="flex justify-between font-mono">
              <span>{r.table}</span>
              <span>{r.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="reset-confirm">
          Type <strong>{siteName}</strong> to confirm
        </Label>
        <Input
          id="reset-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </div>
      <Button
        type="button"
        variant="destructive"
        disabled={!canRequest}
        onClick={() => void request()}
      >
        Request site reset
      </Button>
    </div>
  );
}

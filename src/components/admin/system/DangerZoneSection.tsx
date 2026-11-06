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
  groupPreview,
  resetTableLabel,
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

  // Show the counts as soon as a selection exists, so nothing is requested blind.
  const key = categories.join(",");
  React.useEffect(() => {
    if (!key) return;
    let live = true;
    void previewSiteReset({ categories: key.split(",") }).then((res) => {
      if (live && res.ok) setPreview(res.data);
    });
    return () => {
      live = false;
    };
  }, [key]);

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

  // Each unmet requirement is listed so a disabled button is never a mystery (the backup is required).
  const blockers = [
    categories.length ? null : "Select the data to delete.",
    backedUp ? null : "Download the backup (JSON) for this selection.",
    typed.trim() === siteName ? null : "Type the exact site name.",
  ].filter(Boolean);
  const canRequest = blockers.length === 0 && !busy;

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
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!categories.length || busy}
          onClick={() => void runPreview()}
        >
          Preview row counts
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
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
        <div className="space-y-3" aria-label="Rows to delete" role="group">
          <p className="text-body-sm font-medium">
            Rows that will be deleted:{" "}
            <span className="font-mono">{preview.reduce((n, r) => n + r.count, 0)}</span> in total
          </p>
          {groupPreview(preview).map((g) => (
            <section key={g.category} data-testid={`reset-preview-${g.category}`}>
              <h4 className="flex justify-between gap-3 text-body-sm font-medium">
                <span>{RESET_CATEGORY_LABELS[g.category]}</span>
                <span className="font-mono">{g.total}</span>
              </h4>
              <ul className="mt-1 space-y-0.5 text-body-sm">
                {g.rows.map((r, i) => (
                  <li key={`${r.table}-${i}`} className="flex justify-between gap-3">
                    <span className="min-w-0 break-words">{resetTableLabel(r.table)}</span>
                    <span className="shrink-0 font-mono">{r.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="reset-confirm" className="block break-words">
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
        className="w-full sm:w-auto"
        disabled={!canRequest}
        onClick={() => void request()}
      >
        Request site reset
      </Button>
      {blockers.length ? (
        <ul data-testid="reset-blockers" className="list-disc pl-5 text-caption text-fg-muted">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import { DownloadIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  applySettingsImport,
  exportSettingsFile,
  previewSettingsImport,
} from "@/modules/settings/transfer-actions";
import type { SettingDiff } from "@/modules/settings/transfer";

const show = (v: unknown) => (v === undefined ? "—" : JSON.stringify(v));

/** Settings JSON export / import (Super Admin). Import is preview-then-confirm. */
export function SettingsTransfer() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [diff, setDiff] = React.useState<SettingDiff[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onExport() {
    const res = await exportSettingsFile();
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    const url = URL.createObjectURL(new Blob([res.data.json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Settings exported (secrets are not included)");
  }

  async function onPreview() {
    setBusy(true);
    setError(null);
    const res = await previewSettingsImport(text);
    setBusy(false);
    if (!res.ok) {
      setDiff(null);
      setError(res.error.message);
      return;
    }
    setDiff(res.data.diff);
  }

  async function onApply() {
    setBusy(true);
    const res = await applySettingsImport(text);
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    toast.success(`Imported ${res.data.applied} setting${res.data.applied === 1 ? "" : "s"}`);
    setOpen(false);
    setText("");
    setDiff(null);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => void onExport()}>
        <DownloadIcon aria-hidden /> Export
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setDiff(null);
            setError(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <UploadIcon aria-hidden /> Import
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import settings</DialogTitle>
            <DialogDescription>
              Choose a file exported from CodeKraft. You will see what changes before anything is
              saved. Payment gateway and bank secrets are never imported.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="settings-import-file">Settings file (.json)</Label>
            <input
              id="settings-import-file"
              type="file"
              accept="application/json,.json"
              className="block w-full text-body-sm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                setDiff(null);
                setError(null);
                setText(f ? await f.text() : "");
              }}
            />
          </div>
          {error ? (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          ) : null}
          {diff ? (
            diff.length === 0 ? (
              <p className="text-body-sm text-fg-muted">No differences: nothing to import.</p>
            ) : (
              <table className="w-full text-body-sm" data-testid="settings-diff">
                <caption className="sr-only">Changes this import will make</caption>
                <thead>
                  <tr className="text-left text-caption text-fg-muted">
                    <th>Setting</th>
                    <th>Now</th>
                    <th>Import</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((d) => (
                    <tr key={d.key} className="align-top">
                      <td className="pr-2 font-mono">{d.key}</td>
                      <td className="max-w-40 pr-2 break-words text-fg-muted">
                        {show(d.before).slice(0, 80)}
                      </td>
                      <td className="max-w-40 break-words">{show(d.after).slice(0, 80)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            {diff && diff.length > 0 ? (
              <Button onClick={() => void onApply()} disabled={busy}>
                Confirm import ({diff.length})
              </Button>
            ) : (
              <Button onClick={() => void onPreview()} disabled={busy || text === ""}>
                Preview changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

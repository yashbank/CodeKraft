"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ThemeName } from "@/lib/theme";
import {
  DEFAULT_STUDIO,
  STUDIO_GROUPS,
  addPreset,
  removePreset,
  type StudioValues,
  type ThemePreset,
} from "@/lib/theme-studio";
import { updateSettings } from "@/modules/settings/admin-mutations";
import { ThemePreview } from "./ThemePreview";
import { ThemeSelect } from "./ThemeSelect";

/**
 * Theme studio (P14-07): one searchable dropdown per group, a live preview that updates before
 * saving, reset to defaults and named presets. The parent owns the draft `values` and persists
 * them with the section's "Save changes"; presets are saved immediately on their own.
 */
export function ThemeStudio({
  values,
  onChange,
  theme,
  presets: initialPresets,
  disabled,
}: {
  values: StudioValues;
  onChange: (v: StudioValues) => void;
  theme: ThemeName;
  presets: ThemePreset[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [presets, setPresets] = React.useState(initialPresets);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function persist(next: ThemePreset[], done: string) {
    setBusy(true);
    try {
      const res = await updateSettings({ patch: { themePresets: next } });
      if (!res.ok) return void toast.error(res.error.message);
      setPresets(next);
      toast.success(done);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  const savePreset = () => {
    if (!name.trim()) return void toast.error("Name the preset first");
    void persist(addPreset(presets, name, values), `Preset "${name.trim()}" saved`).then(() =>
      setName(""),
    );
  };

  return (
    <div className="grid gap-5">
      <div className="bg-canvas sticky top-0 z-10 -mx-1 max-h-[46vh] overflow-y-auto px-1 pb-2">
        <ThemePreview values={values} theme={theme} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(DEFAULT_STUDIO)}
        >
          Reset to defaults
        </Button>
        <span className="text-caption text-fg-muted">
          Changes preview instantly; they go live when you press Save changes.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {STUDIO_GROUPS.map((g) => (
          <ThemeSelect
            key={g.key}
            label={g.label}
            note={g.note}
            ids={g.ids}
            labelOf={g.labelOf}
            value={values[g.key]}
            disabled={disabled}
            onChange={(id) => onChange({ ...values, [g.key]: id })}
          />
        ))}
      </div>

      <fieldset className="grid gap-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-body-sm font-medium">Saved presets</legend>
        <p className="text-caption text-fg-muted">
          Saves every choice above under a name so you can switch looks in one click. Applying a
          preset previews it; press Save changes to publish.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Preset name"
            placeholder="Preset name"
            value={name}
            maxLength={40}
            disabled={disabled || busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                savePreset();
              }
            }}
            className="max-w-64"
          />
          <Button type="button" size="sm" disabled={disabled || busy} onClick={savePreset}>
            Save current as preset
          </Button>
        </div>
        {presets.length ? (
          <ul className="grid gap-2">
            {presets.map((p) => (
              <li
                key={p.name}
                data-preset={p.name}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="truncate text-body-sm font-medium">{p.name}</span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled}
                    aria-label={`Apply preset ${p.name}`}
                    onClick={() => onChange(p.values)}
                  >
                    Apply
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled || busy}
                    aria-label={`Delete preset ${p.name}`}
                    onClick={() => void persist(removePreset(presets, p.name), "Preset deleted")}
                  >
                    Delete
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-fg-muted">No presets yet.</p>
        )}
      </fieldset>
    </div>
  );
}

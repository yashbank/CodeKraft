"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { ThemeName } from "@/lib/theme";
import { previewVars, studioFontsHref, studioAttrs, type StudioValues } from "@/lib/theme-studio";

const FONT_LINK_ID = "ck-studio-preview-fonts";

/** kebab-case CSS properties -> React style keys; custom properties pass through. */
export const toStyle = (v: Record<string, string>): React.CSSProperties =>
  Object.fromEntries(
    Object.entries(v).map(([k, x]) => [
      k.startsWith("--") ? k : k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()),
      x,
    ]),
  ) as React.CSSProperties;

/**
 * Live preview: the unsaved choices are applied as CSS variables on this container only, so every
 * sample below updates instantly and nothing outside it (or on the site) changes before saving.
 */
export function ThemePreview({ values, theme }: { values: StudioValues; theme: ThemeName }) {
  const href = studioFontsHref(values);
  React.useEffect(() => {
    let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
    if (!href) return link?.remove();
    if (!link) {
      link = document.createElement("link");
      link.id = FONT_LINK_ID;
      link.rel = "stylesheet";
      document.head.append(link);
    }
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  }, [href]);

  return (
    <div
      data-testid="theme-preview"
      role="group"
      aria-label="Live preview"
      data-theme={theme}
      {...studioAttrs(values)}
      style={{ ...toStyle(previewVars(values, theme)), fontFamily: "var(--ck-font-body)" }}
      className="bg-canvas text-fg grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2"
    >
      <section
        data-sample="hero"
        className="border-border bg-surface grid gap-3 rounded-xl border p-6 sm:col-span-2"
      >
        <p className="text-caption text-accent-text font-semibold uppercase tracking-wide">
          Landing hero
        </p>
        <h3 className="font-display text-h2">Software that ships, crafted for you</h3>
        <p className="text-body-sm text-fg-muted">
          Premium builds, templates and a team that answers in hours, not weeks.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button">Start a project</Button>
          <Button type="button" variant="secondary">
            Browse catalogue
          </Button>
          <Button type="button" variant="outline">
            Outline
          </Button>
        </div>
      </section>

      <Card data-sample="product">
        <CardHeader>
          <div className="bg-accent-soft h-16 rounded-md" aria-hidden />
          <CardTitle className="font-display">Starter storefront</CardTitle>
          <CardDescription>Product card</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2">
          <span className="font-semibold">₹24,999</span>
          <Button type="button" size="sm">
            Add to cart
          </Button>
        </CardContent>
      </Card>

      <Card data-sample="blog">
        <CardHeader>
          <CardDescription>Blog card · 4 min read</CardDescription>
          <CardTitle className="font-display">Shipping faster with small teams</CardTitle>
        </CardHeader>
        <CardContent className="text-body-sm text-fg-muted">
          How we cut review time in half by writing less code and testing more of it.
        </CardContent>
      </Card>

      <Card data-sample="form">
        <CardHeader>
          <CardTitle className="font-display">Contact form</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1">
            <Label htmlFor="tp-name">Your name</Label>
            <Input id="tp-name" placeholder="Ada Lovelace" tabIndex={-1} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tp-mail">Email</Label>
            <Input id="tp-mail" placeholder="ada@example.com" tabIndex={-1} />
          </div>
          <Button type="button">Send message</Button>
        </CardContent>
      </Card>

      <Card data-sample="widget">
        <CardHeader>
          <CardDescription>Dashboard widget</CardDescription>
          <CardTitle className="font-display">Revenue this month</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <span className="font-display text-h2">₹4,82,000</span>
          <Progress value={68} aria-label="Target progress" />
          <span className="text-caption text-fg-muted">68% of target</span>
        </CardContent>
      </Card>
    </div>
  );
}

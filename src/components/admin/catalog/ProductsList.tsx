"use client";

import Link from "next/link";
import * as React from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FilterIcon,
  PackageIcon,
  PlusIcon,
  StarIcon,
  EyeOffIcon,
  ClockIcon,
  RotateCcwIcon,
  ReceiptIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/_utils";
import { STATUS_ENUMS } from "@/lib/status-tone";
import { ApprovalGateNotice } from "../Banner";
import { DataToolbar, ToolbarField } from "../DataToolbar";
import { EmptyState } from "../EmptyState";
import { FilterChips } from "../FilterChips";
import { money, timeAgo } from "../format";
import { PageHeader } from "../PageHeader";
import { RowActions } from "../RowActions";
import type { CategoryNode, ProductFlag, ProductRow, ProductStatus } from "../types";

const FLAG_ICON: Record<ProductFlag, { Icon: typeof StarIcon; label: string }> = {
  is_featured: { Icon: StarIcon, label: "Featured" },
  is_unlisted: { Icon: EyeOffIcon, label: "Unlisted" },
  is_coming_soon: { Icon: ClockIcon, label: "Coming soon" },
  is_refundable: { Icon: RotateCcwIcon, label: "Refundable" },
  tax_enabled: { Icon: ReceiptIcon, label: "Tax enabled" },
};

export interface ProductsListProps {
  products: ProductRow[];
  categories: CategoryNode[];
  tags: string[];
  now: string;
  editorHref: string;
  approvalsHref: string;
  approvers: string[];
  /** Show the categories & tags panel beside the table (`/categories`). */
  showCategories?: boolean;
}

/**
 * SCR-ADM-03 — products list with status count chips, faceted toolbar, DataTable with
 * StatusBadge + flag icons, bulk selection and approval-gated row actions; plus the
 * categories & tags side panel (`/categories`).
 */
export function ProductsList({
  products,
  categories,
  tags,
  now,
  editorHref,
  approvalsHref,
  approvers,
  showCategories = true,
}: ProductsListProps) {
  const [status, setStatus] = React.useState<ProductStatus | null>(null);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [flagFilter, setFlagFilter] = React.useState<ReadonlySet<ProductFlag>>(new Set());
  const [dialog, setDialog] = React.useState<{
    kind: "archive" | "delete" | "submit";
    product: ProductRow;
  } | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(showCategories);

  const counts = STATUS_ENUMS["products.status"].map((s) => ({
    value: s,
    label: statusLabel(s),
    count: products.filter((p) => p.status === s).length,
  }));
  const rows = products
    .filter((p) => (status ? p.status === status : p.status !== "archived"))
    .filter((p) => [...flagFilter].every((f) => p.flags.includes(f)));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <TooltipProvider>
      <PageHeader
        title="Products"
        description="Manage the catalog. Archive, delete and publish are dual-approved (BR-13)."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
            >
              Categories & tags
            </Button>
            <Button asChild size="sm">
              <Link href={editorHref}>
                <PlusIcon aria-hidden /> New product
              </Link>
            </Button>
          </>
        }
      />
      <FilterChips label="Filter by status" chips={counts} value={status} onChange={setStatus} />
      <div className={cn("mt-4 grid gap-6", panelOpen && "xl:grid-cols-[1fr_360px]")}>
        <div className="min-w-0">
          <DataToolbar
            searchId="products-search"
            searchPlaceholder="Search name, slug…"
            filters={
              <>
                <ToolbarField id="products-category" label="Category">
                  <Select>
                    <SelectTrigger id="products-category" size="sm" className="w-44">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.flatMap((c) => [
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>,
                        ...(c.children ?? []).map((ch) => (
                          <SelectItem
                            key={ch.id}
                            value={ch.id}
                          >{`${c.name} › ${ch.name}`}</SelectItem>
                        )),
                      ])}
                    </SelectContent>
                  </Select>
                </ToolbarField>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="self-end">
                      <FilterIcon aria-hidden /> Flags
                      {flagFilter.size > 0 ? ` (${flagFilter.size})` : ""}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 space-y-2">
                    {(Object.keys(FLAG_ICON) as ProductFlag[]).map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <Checkbox
                          id={`flag-${f}`}
                          checked={flagFilter.has(f)}
                          onCheckedChange={(v) =>
                            setFlagFilter((prev) => {
                              const next = new Set(prev);
                              if (v === true) next.add(f);
                              else next.delete(f);
                              return next;
                            })
                          }
                        />
                        <Label htmlFor={`flag-${f}`}>{FLAG_ICON[f].label}</Label>
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
              </>
            }
          />
          {selected.size > 0 ? (
            <div
              className="mb-3 flex items-center gap-3 rounded-md border border-accent bg-accent-soft px-3 py-2 text-body-sm"
              role="status"
            >
              <span className="font-medium text-accent-text">{selected.size} selected</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toast.success(`Submitted ${selected.size} products for approval`)}
              >
                Submit for approval
              </Button>
              <Button size="sm" variant="secondary">
                Unpublish
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          ) : null}
          {rows.length === 0 ? (
            <EmptyState
              icon={PackageIcon}
              title={products.length === 0 ? "No products yet" : "No products match"}
              body={
                products.length === 0
                  ? "Create your first product to start selling."
                  : "Try another status or clear the flag filters."
              }
            />
          ) : (
            <div className="rounded-lg border border-border bg-surface">
              <Table>
                <TableCaption className="sr-only">Products</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Select all products"
                        checked={allSelected ? true : selected.size > 0 ? "indeterminate" : false}
                        onCheckedChange={(v) =>
                          setSelected(v === true ? new Set(rows.map((r) => r.id)) : new Set())
                        }
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Offerings</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${p.name}`}
                          checked={selected.has(p.id)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (v === true) next.add(p.id);
                              else next.delete(p.id);
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className="grid size-9 shrink-0 place-items-center rounded-sm bg-elevated text-fg-subtle"
                          >
                            <PackageIcon className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <Link
                              href={editorHref}
                              className="block truncate font-medium text-fg hover:text-accent-text"
                            >
                              {p.name}
                            </Link>
                            <span className="block truncate font-mono text-caption text-fg-muted">
                              /{p.slug}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-fg-muted">{p.category}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge kind="products.status" value={p.status} />
                          {p.awaitingApprovalId ? (
                            <Link href={approvalsHref}>
                              <StatusBadge
                                kind="approval_requests.status"
                                value="pending"
                                size="sm"
                                className="hover:underline"
                              />
                            </Link>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex gap-1">
                          {p.flags.map((f) => {
                            const { Icon, label } = FLAG_ICON[f];
                            return (
                              <Tooltip key={f}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="grid size-6 place-items-center rounded-xs bg-elevated text-fg-muted"
                                  >
                                    <Icon aria-hidden className="size-3.5" />
                                    <span className="sr-only">{label}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>{label}</TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        {p.offerings}
                        {p.fromPrice ? (
                          <span className="text-fg-muted"> · from {money(p.fromPrice)}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono">{p.version}</TableCell>
                      <TableCell className="text-fg-muted">
                        <time dateTime={p.updatedAt} title={p.updatedAt}>
                          {timeAgo(p.updatedAt, now)}
                        </time>{" "}
                        by {p.updatedBy}
                      </TableCell>
                      <TableCell>
                        <RowActions
                          label={`Actions for ${p.name}`}
                          actions={[
                            { label: "Edit", href: editorHref },
                            {
                              label: "Preview on site",
                              onSelect: () => toast("Opens a signed preview link in a new tab"),
                            },
                            {
                              label: "Submit for approval",
                              onSelect: () => setDialog({ kind: "submit", product: p }),
                              disabled: p.status !== "draft" && p.status !== "unpublished",
                            },
                            {
                              label: "Unpublish",
                              onSelect: () => toast.success(`${p.name} unpublished`),
                              disabled: p.status !== "published",
                            },
                            {
                              label: "Request archive",
                              onSelect: () => setDialog({ kind: "archive", product: p }),
                              separatorBefore: true,
                              disabled: p.status === "archived",
                            },
                            {
                              label: "Request delete",
                              onSelect: () => setDialog({ kind: "delete", product: p }),
                              destructive: true,
                              disabled: p.orderCount > 0,
                            },
                            {
                              label: "Duplicate as draft",
                              onSelect: () => toast.success(`Copied ${p.name} as a draft`),
                              separatorBefore: true,
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-body-sm text-fg-muted">
                <span>
                  {rows.length} of {products.length} products
                </span>
                <span>25 per page</span>
              </div>
            </div>
          )}
        </div>
        {panelOpen ? <CategoriesPanel categories={categories} tags={tags} /> : null}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {dialog.kind === "delete"
                    ? `Delete ${dialog.product.name}?`
                    : dialog.kind === "archive"
                      ? `Archive ${dialog.product.name}?`
                      : `Submit ${dialog.product.name} for approval?`}
                </DialogTitle>
                <DialogDescription>
                  {dialog.kind === "delete"
                    ? `This product has ${dialog.product.orderCount} orders, so deletion is allowed. Another admin must approve.`
                    : dialog.kind === "archive"
                      ? `It has ${dialog.product.orderCount} orders, so it can't be deleted. Existing customers keep access. Another admin must approve.`
                      : "Readiness: offering with base price and method ✔ · image with alt text ✔ · ownership sums to 100 % ✔."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="approval-comment" required>
                  Comment to approver
                </Label>
                <Textarea
                  id="approval-comment"
                  required
                  aria-required
                  placeholder="Why now, anything to check…"
                />
              </div>
              <ApprovalGateNotice
                approvers={approvers}
                what={
                  dialog.kind === "submit"
                    ? "Publishing"
                    : dialog.kind === "archive"
                      ? "Archiving"
                      : "Deleting"
                }
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button
                  variant={dialog.kind === "delete" ? "destructive" : "primary"}
                  onClick={() => {
                    toast.success(
                      `Approval requested — waiting for ${approvers[0] ?? "another admin"}`,
                    );
                    setDialog(null);
                  }}
                >
                  Request approval
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function statusLabel(s: ProductStatus): string {
  return {
    draft: "Draft",
    pending_approval: "Pending approval",
    scheduled: "Scheduled",
    published: "Published",
    unpublished: "Unpublished",
    archived: "Archived",
  }[s];
}

/** Categories tree (max depth 2) + tags editor — the `/categories` half of SCR-ADM-03. */
export function CategoriesPanel({
  categories,
  tags,
}: {
  categories: CategoryNode[];
  tags: string[];
}) {
  const [open, setOpen] = React.useState<ReadonlySet<string>>(new Set(categories.map((c) => c.id)));
  const [selected, setSelected] = React.useState<CategoryNode | null>(
    categories[0]?.children?.[0] ?? null,
  );
  const [tagList, setTagList] = React.useState(tags);
  const [newTag, setNewTag] = React.useState("");

  return (
    <aside
      aria-labelledby="categories-title"
      className="space-y-4 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-center justify-between">
        <h2 id="categories-title" className="text-h4">
          Categories & tags
        </h2>
        <Button size="sm" variant="ghost">
          <PlusIcon aria-hidden /> Category
        </Button>
      </div>
      <ul role="tree" aria-label="Category tree" className="space-y-0.5 text-body-sm">
        {categories.map((c) => {
          const expanded = open.has(c.id);
          return (
            <li
              key={c.id}
              role="treeitem"
              aria-expanded={expanded}
              aria-selected={selected?.id === c.id}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={expanded ? `Collapse ${c.name}` : `Expand ${c.name}`}
                  onClick={() =>
                    setOpen((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                  className="grid size-6 place-items-center rounded-xs text-fg-muted hover:bg-accent-soft"
                >
                  {expanded ? (
                    <ChevronDownIcon aria-hidden className="size-4" />
                  ) : (
                    <ChevronRightIcon aria-hidden className="size-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className={cn(
                    "flex flex-1 items-center justify-between rounded-sm px-2 py-1 text-left hover:bg-accent-soft",
                    selected?.id === c.id && "bg-accent-soft text-accent-text",
                  )}
                >
                  <span>{c.name}</span>
                  <span className="font-mono text-caption text-fg-muted">{c.productCount}</span>
                </button>
              </div>
              {expanded && c.children ? (
                <ul role="group" className="ml-7 border-l border-border pl-2">
                  {c.children.map((ch) => (
                    <li key={ch.id} role="treeitem" aria-selected={selected?.id === ch.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(ch)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-sm px-2 py-1 text-left hover:bg-accent-soft",
                          selected?.id === ch.id && "bg-accent-soft text-accent-text",
                        )}
                      >
                        <span>{ch.name}</span>
                        <span className="font-mono text-caption text-fg-muted">
                          {ch.productCount}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      {selected ? (
        <form
          className="space-y-3 border-t border-border pt-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cat-name" required>
              Name
            </Label>
            <Input id="cat-name" defaultValue={selected.name} key={`n-${selected.id}`} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-slug" required>
              Slug
            </Label>
            <Input
              id="cat-slug"
              defaultValue={selected.slug}
              key={`s-${selected.id}`}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-parent">Parent</Label>
            <Select defaultValue="none">
              <SelectTrigger id="cat-parent" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— top level —</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-caption text-fg-muted">
              Max depth 2. Delete is blocked while products reference a category.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              Save
            </Button>
            <Button size="sm" variant="ghost" type="button" disabled={selected.productCount > 0}>
              Delete
            </Button>
          </div>
        </form>
      ) : null}
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-body-sm font-semibold">Tags</h3>
        <ul className="flex flex-wrap gap-1.5">
          {tagList.map((t) => (
            <li key={t}>
              <Badge tone="neutral" className="gap-1 pr-1">
                {t}
                <button
                  type="button"
                  aria-label={`Remove tag ${t}`}
                  onClick={() => setTagList((l) => l.filter((x) => x !== t))}
                  className="grid size-4 place-items-center rounded-full hover:bg-danger-soft hover:text-danger"
                >
                  ×
                </button>
              </Badge>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = newTag.trim().toLowerCase();
            if (v && !tagList.includes(v)) setTagList((l) => [...l, v].sort());
            setNewTag("");
          }}
        >
          <Label htmlFor="new-tag" className="sr-only">
            New tag
          </Label>
          <Input
            id="new-tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag"
            className="h-8"
          />
          <Button size="sm" type="submit" variant="secondary">
            Add
          </Button>
        </form>
        <Button size="sm" variant="link">
          Merge tags…
        </Button>
      </div>
    </aside>
  );
}

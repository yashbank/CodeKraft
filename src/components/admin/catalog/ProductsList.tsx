"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  removeCategory,
  requestProductArchive,
  requestProductDelete,
  saveCategory,
  saveTag,
  submitProductForApproval,
  unpublishProduct,
} from "@/modules/catalog/admin-mutations";
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

type LifecycleDialogKind = "archive" | "delete" | "submit" | "unpublish";

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

function flattenCategoryNames(nodes: CategoryNode[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of nodes) {
    out.set(c.id, c.name);
    for (const ch of c.children ?? []) out.set(ch.id, `${c.name} › ${ch.name}`);
  }
  return out;
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
  const router = useRouter();
  const [status, setStatus] = React.useState<ProductStatus | null>(null);
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [flagFilter, setFlagFilter] = React.useState<ReadonlySet<ProductFlag>>(new Set());
  const [dialog, setDialog] = React.useState<{
    kind: LifecycleDialogKind;
    product: ProductRow;
  } | null>(null);
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(showCategories);
  // Keep in sync with the route-driven prop: /products and /categories render this same
  // component, and Next.js can reuse the instance across that client-side navigation, so a
  // useState initial value alone would stick to whichever page mounted it first.
  React.useEffect(() => {
    setPanelOpen(showCategories);
  }, [showCategories]);

  const categoryNameById = React.useMemo(() => flattenCategoryNames(categories), [categories]);
  const productHref = (id: string) => `${editorHref}/${id}`;

  const counts = STATUS_ENUMS["products.status"].map((s) => ({
    value: s,
    label: statusLabel(s),
    count: products.filter((p) => p.status === s).length,
  }));
  const rows = products
    .filter((p) => (status ? p.status === status : p.status !== "archived"))
    .filter((p) => [...flagFilter].every((f) => p.flags.includes(f)))
    .filter((p) => !categoryFilter || p.category === categoryNameById.get(categoryFilter));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function openDialog(kind: LifecycleDialogKind, product: ProductRow) {
    setReason("");
    setDialog({ kind, product });
  }

  async function confirmDialog() {
    if (!dialog) return;
    if (dialog.kind !== "submit" && reason.trim().length === 0) {
      toast.error("A reason is required.");
      return;
    }
    setSubmitting(true);
    const productId = dialog.product.id;
    const result =
      dialog.kind === "submit"
        ? await submitProductForApproval({ productId })
        : dialog.kind === "unpublish"
          ? await unpublishProduct({ productId, reason: reason.trim() })
          : dialog.kind === "archive"
            ? await requestProductArchive({ productId, reason: reason.trim() })
            : await requestProductDelete({ productId, reason: reason.trim() });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    if (dialog.kind === "unpublish") {
      toast.success(`${dialog.product.name} unpublished`);
    } else {
      toast.success(`Approval requested — waiting for ${approvers[0] ?? "another admin"}`);
    }
    setDialog(null);
    router.refresh();
  }

  async function bulkSubmitForApproval() {
    const targets = rows.filter(
      (r) => selected.has(r.id) && (r.status === "draft" || r.status === "unpublished"),
    );
    if (targets.length === 0) {
      toast.error("None of the selected products can be submitted for approval.");
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    for (const p of targets) {
      const result = await submitProductForApproval({ productId: p.id });
      if (result.ok) ok += 1;
    }
    setBulkBusy(false);
    toast.success(`Submitted ${ok} of ${targets.length} for approval`);
    setSelected(new Set());
    router.refresh();
  }

  async function bulkUnpublish() {
    const targets = rows.filter((r) => selected.has(r.id) && r.status === "published");
    if (targets.length === 0) {
      toast.error("None of the selected products are published.");
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    for (const p of targets) {
      const result = await unpublishProduct({
        productId: p.id,
        reason: "Bulk unpublish from the products list",
      });
      if (result.ok) ok += 1;
    }
    setBulkBusy(false);
    toast.success(`Unpublished ${ok} of ${targets.length}`);
    setSelected(new Set());
    router.refresh();
  }

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
              <Link href={productHref("new")}>
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
                  <Select
                    value={categoryFilter ?? "all"}
                    onValueChange={(v) => setCategoryFilter(v === "all" ? null : v)}
                  >
                    <SelectTrigger id="products-category" size="sm" className="w-44">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
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
              <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={bulkSubmitForApproval}>
                Submit for approval
              </Button>
              <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={bulkUnpublish}>
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
                              href={productHref(p.id)}
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
                            { label: "Edit", href: productHref(p.id) },
                            {
                              label: "Preview on site",
                              onSelect: () => toast("Opens a signed preview link in a new tab"),
                            },
                            {
                              label: "Submit for approval",
                              onSelect: () => openDialog("submit", p),
                              disabled: p.status !== "draft" && p.status !== "unpublished",
                            },
                            {
                              label: "Unpublish",
                              onSelect: () => openDialog("unpublish", p),
                              disabled: p.status !== "published",
                            },
                            {
                              label: "Request archive",
                              onSelect: () => openDialog("archive", p),
                              separatorBefore: true,
                              disabled: p.status === "archived",
                            },
                            {
                              label: "Request delete",
                              onSelect: () => openDialog("delete", p),
                              destructive: true,
                              disabled: p.orderCount > 0,
                            },
                            {
                              label: "Duplicate as draft",
                              disabled: true,
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

      <Dialog
        open={dialog !== null}
        onOpenChange={(o) => {
          if (!o) setDialog(null);
        }}
      >
        <DialogContent>
          {dialog ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {dialog.kind === "delete"
                    ? `Delete ${dialog.product.name}?`
                    : dialog.kind === "archive"
                      ? `Archive ${dialog.product.name}?`
                      : dialog.kind === "unpublish"
                        ? `Unpublish ${dialog.product.name}?`
                        : `Submit ${dialog.product.name} for approval?`}
                </DialogTitle>
                <DialogDescription>
                  {dialog.kind === "delete"
                    ? `This product has ${dialog.product.orderCount} orders, so deletion is allowed. Another admin must approve.`
                    : dialog.kind === "archive"
                      ? `It has ${dialog.product.orderCount} orders, so it can't be deleted. Existing customers keep access. Another admin must approve.`
                      : dialog.kind === "unpublish"
                        ? "The product page stops serving immediately. Existing customers keep access."
                        : "Submitting sends the product to an approver before it goes live."}
                </DialogDescription>
              </DialogHeader>
              {dialog.kind === "submit" ? null : (
                <div className="space-y-1.5">
                  <Label htmlFor="lifecycle-reason" required>
                    Reason
                  </Label>
                  <Textarea
                    id="lifecycle-reason"
                    required
                    aria-required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why now, anything to check…"
                  />
                </div>
              )}
              {dialog.kind !== "unpublish" ? (
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
              ) : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button
                  variant={dialog.kind === "delete" ? "destructive" : "primary"}
                  disabled={submitting}
                  onClick={confirmDialog}
                >
                  {dialog.kind === "unpublish" ? "Unpublish" : "Request approval"}
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
  const router = useRouter();
  const [open, setOpen] = React.useState<ReadonlySet<string>>(new Set(categories.map((c) => c.id)));
  const [selected, setSelected] = React.useState<CategoryNode | null>(
    categories[0]?.children?.[0] ?? categories[0] ?? null,
  );
  const [creatingNew, setCreatingNew] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [tagList, setTagList] = React.useState(tags);
  const [newTag, setNewTag] = React.useState("");
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSaveCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const slug = String(data.get("slug") ?? "").trim();
    const parentRaw = String(data.get("parentId") ?? "none");
    if (!name || !slug) {
      toast.error("Name and slug are required.");
      return;
    }
    setSaving(true);
    const result = await saveCategory({
      id: creatingNew ? undefined : selected?.id,
      parentId: parentRaw === "none" ? null : parentRaw,
      name,
      slug,
      position: 0,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(creatingNew ? "Category created" : "Category saved");
    setCreatingNew(false);
    router.refresh();
  }

  async function handleDeleteCategory() {
    if (!selected) return;
    const result = await removeCategory({ categoryId: selected.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Category deleted");
    setSelected(null);
    router.refresh();
  }

  const formTarget = creatingNew ? null : selected;

  return (
    <aside
      aria-labelledby="categories-title"
      className="space-y-4 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-center justify-between">
        <h2 id="categories-title" className="text-h4">
          Categories & tags
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSelected(null);
            setCreatingNew(true);
          }}
        >
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
                  onClick={() => {
                    setCreatingNew(false);
                    setSelected(c);
                  }}
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
                        onClick={() => {
                          setCreatingNew(false);
                          setSelected(ch);
                        }}
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
      {formTarget || creatingNew ? (
        <form
          ref={formRef}
          className="space-y-3 border-t border-border pt-4"
          onSubmit={handleSaveCategory}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cat-name" required>
              Name
            </Label>
            <Input
              id="cat-name"
              name="name"
              defaultValue={formTarget?.name ?? ""}
              key={`n-${formTarget?.id ?? "new"}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-slug" required>
              Slug
            </Label>
            <Input
              id="cat-slug"
              name="slug"
              defaultValue={formTarget?.slug ?? ""}
              key={`s-${formTarget?.id ?? "new"}`}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-parent">Parent</Label>
            <Select name="parentId" defaultValue="none">
              <SelectTrigger id="cat-parent" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— top level —</SelectItem>
                {categories
                  .filter((c) => !formTarget || c.id !== formTarget.id)
                  .map((c) => (
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
            <Button size="sm" type="submit" disabled={saving}>
              Save
            </Button>
            {formTarget ? (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={formTarget.productCount > 0 || saving}
                onClick={handleDeleteCategory}
              >
                Delete
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setCreatingNew(false)}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : null}
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-body-sm font-semibold">Tags</h3>
        {tagList.length === 0 ? (
          <p className="text-caption text-fg-muted">
            No tags to show yet — there is no list-all-tags query, so this fills in as tags are
            added below or used on a product.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {tagList.map((t) => (
              <li key={t}>
                <Badge tone="neutral" className="gap-1 pr-1">
                  {t}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = newTag.trim().toLowerCase();
            if (!v || tagList.includes(v)) {
              setNewTag("");
              return;
            }
            const result = await saveTag({
              name: v,
              slug: v.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
            });
            if (!result.ok) {
              toast.error(result.error.message);
              return;
            }
            setTagList((l) => [...l, v].sort());
            setNewTag("");
            toast.success(`Tag "${v}" created`);
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
      </div>
    </aside>
  );
}

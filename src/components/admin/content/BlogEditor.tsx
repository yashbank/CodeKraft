"use client";

import * as React from "react";
import { PlusIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { blogSeo } from "@/lib/seo";
import { Field, RichTextField } from "../RichTextField";
import { SeoPreview } from "../SeoPreview";
import { RowActions } from "../RowActions";
import { ContentEditorFrame } from "./ContentEditorFrame";
import { fromPlainText, toPlainText } from "@/modules/content/plain-text";
import { slugify } from "@/modules/catalog/slugs";
import type { AdminBlogList, AdminBlogPost } from "@/modules/blog/types";
import {
  publishProductBlogById,
  saveProductBlog,
  unpublishProductBlogById,
} from "@/modules/catalog/admin-mutations";

/** Standalone blog editor (BUG-067). Posts are `product_blogs` rows: one per product. */
export function BlogEditor({ posts: initial, productsWithoutBlog }: AdminBlogList) {
  const router = useRouter();
  const [posts, setPosts] = React.useState(initial);
  const [free, setFree] = React.useState(productsWithoutBlog);
  const [editing, setEditing] = React.useState<AdminBlogPost | "new" | null>(null);
  const [productId, setProductId] = React.useState("");
  const [cover, setCover] = React.useState<{ mediaId?: string; url?: string }>({});
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const post = editing && editing !== "new" ? editing : null;

  function openEdit(item: AdminBlogPost | "new") {
    setEditing(item);
    const row = item === "new" ? null : item;
    setProductId(row?.productId ?? "");
    setCover({ mediaId: row?.coverMediaId, url: row?.coverUrl });
  }

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { uploadMediaFile } = await import("@/lib/admin/media-upload");
      const up = await uploadMediaFile(file, "product_image");
      setCover({ mediaId: up.mediaId, url: up.url ?? URL.createObjectURL(file) });
      toast.success("Cover uploaded — save the post to apply it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const slug = String(data.get("slug") ?? "").trim() || slugify(title);
    const excerpt = String(data.get("excerpt") ?? "").trim();
    const seoTitle = String(data.get("seoTitle") ?? "").trim();
    const seoDescription = String(data.get("seoDescription") ?? "").trim();
    if (!productId) {
      toast.error("Choose the product this post is about.");
      return;
    }
    if (!title || !slug || !excerpt) {
      toast.error("Title, slug and excerpt are required.");
      return;
    }
    const bodyJson = fromPlainText(String(data.get("body") ?? ""));
    setSaving(true);
    const result = await saveProductBlog({
      productId,
      slug,
      title,
      excerpt,
      bodyJson,
      coverMediaId: cover.mediaId,
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    const b = result.data.blog;
    const productName =
      post?.productName ?? free.find((p) => p.id === productId)?.name ?? "Product";
    const saved: AdminBlogPost = {
      productId,
      productName,
      productStatus: post?.productStatus ?? "draft",
      status: b.status,
      slug: b.slug,
      title: b.title,
      excerpt: b.excerpt ?? "",
      bodyJson: b.bodyJson as unknown as AdminBlogPost["bodyJson"],
      coverMediaId: cover.mediaId,
      coverUrl: cover.url,
      seoTitle: b.seoTitle ?? "",
      seoDescription: b.seoDescription ?? "",
      publishedAt: b.publishedAt ? new Date(b.publishedAt).toISOString() : null,
      updatedAt: new Date(b.updatedAt).toISOString(),
    };
    setPosts((all) =>
      all.some((x) => x.productId === productId)
        ? all.map((x) => (x.productId === productId ? saved : x))
        : [saved, ...all],
    );
    setFree((all) => all.filter((p) => p.id !== productId));
    toast.success("Blog post saved");
    setEditing(null);
    router.refresh();
  }

  async function togglePublish(item: AdminBlogPost) {
    const publishing = item.status !== "published";
    const result = publishing
      ? await publishProductBlogById({ productId: item.productId })
      : await unpublishProductBlogById({ productId: item.productId });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    const b = result.data.blog;
    setPosts((all) =>
      all.map((x) =>
        x.productId === item.productId
          ? {
              ...x,
              status: b.status,
              publishedAt: b.publishedAt ? new Date(b.publishedAt).toISOString() : null,
            }
          : x,
      ),
    );
    toast.success(publishing ? "Blog published" : "Blog unpublished");
    router.refresh();
  }

  return (
    <ContentEditorFrame
      title="Blog"
      description="Each post belongs to one product. A post can only be published while its product is published."
      hideSaveBar
      headerActions={
        <Button size="sm" onClick={() => openEdit("new")} disabled={free.length === 0}>
          <PlusIcon aria-hidden /> New post
        </Button>
      }
    >
      {posts.length === 0 ? <p className="text-body-sm text-fg-muted">No blog posts yet</p> : null}
      <ul className="space-y-2" aria-label="Blog posts">
        {posts.map((item) => (
          <li
            key={item.productId}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-semibold">{item.title}</p>
              <p className="line-clamp-2 text-caption text-fg-muted">{item.excerpt}</p>
              <p className="mt-1 flex items-center gap-1">
                <StatusBadge kind="product_blogs.status" value={item.status} size="sm" />
                <Badge tone="ghost" size="sm">
                  {item.productName}
                </Badge>
                <span className="font-mono text-caption text-fg-subtle">/blog/{item.slug}</span>
              </p>
            </div>
            <RowActions
              label={`Actions for ${item.title}`}
              actions={[
                { label: "Edit", onSelect: () => openEdit(item) },
                {
                  label: item.status === "published" ? "Unpublish" : "Publish",
                  onSelect: () => togglePublish(item),
                },
              ]}
            />
          </li>
        ))}
      </ul>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="overflow-y-auto lg:w-[640px] tv:w-[760px]">
          <SheetHeader>
            <SheetTitle>{post ? "Edit post" : "New post"}</SheetTitle>
            <SheetDescription>
              Changing the slug of a published post keeps the old URL redirecting.
            </SheetDescription>
          </SheetHeader>
          <form
            key={post?.productId ?? "new"}
            ref={formRef}
            className="space-y-4 px-4 pb-6"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Field id="blog-product" label="Product" required>
              {post ? (
                <Input id="blog-product" value={post.productName} disabled readOnly />
              ) : (
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger id="blog-product">
                    <SelectValue placeholder="Choose a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {free.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="blog-title" label="Title" required>
                <Input id="blog-title" name="title" maxLength={160} defaultValue={post?.title} />
              </Field>
              <Field id="blog-slug" label="Slug">
                <Input id="blog-slug" name="slug" className="font-mono" defaultValue={post?.slug} />
              </Field>
            </div>
            <Field id="blog-excerpt" label="Excerpt" required>
              <Textarea
                id="blog-excerpt"
                name="excerpt"
                rows={2}
                maxLength={300}
                defaultValue={post?.excerpt}
              />
            </Field>
            <RichTextField
              id="blog-body"
              name="body"
              label="Body"
              defaultValue={post ? toPlainText(post.bodyJson) : ""}
            />
            <div className="space-y-2">
              <Label>Cover image</Label>
              <p className="text-caption text-fg-muted">
                Shown on this post&apos;s card on /blog and the home page blog section, and as the
                wide banner at the top of the post. Landscape, at least 1600×900.
              </p>
              <div className="flex items-center gap-3">
                {cover.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover.url} alt="" className="h-16 w-16 rounded-md object-cover" />
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCover}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <UploadIcon aria-hidden />
                  {uploading ? "Uploading…" : "Upload cover"}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="blog-seo-title" label="SEO title" optional>
                <Input
                  id="blog-seo-title"
                  name="seoTitle"
                  maxLength={70}
                  defaultValue={post?.seoTitle}
                />
              </Field>
              <Field id="blog-seo-description" label="SEO description" optional>
                <Input
                  id="blog-seo-description"
                  name="seoDescription"
                  maxLength={160}
                  defaultValue={post?.seoDescription}
                />
              </Field>
            </div>
            {post ? (
              <SeoPreview
                input={blogSeo({
                  slug: post.slug,
                  title: post.title,
                  excerpt: post.excerpt,
                  seoTitle: post.seoTitle,
                  seoDescription: post.seoDescription,
                })}
              />
            ) : null}
            <Button type="submit" disabled={saving}>
              Save post
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </ContentEditorFrame>
  );
}

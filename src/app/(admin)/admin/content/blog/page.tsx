import { BlogEditor } from "@/components/admin/content/BlogEditor";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { blogService } from "@/modules/blog/service";

export const dynamic = "force-dynamic";

export default async function AdminBlogEditorPage() {
  const ctx = await getAdminRequestContext();
  const list = await blogService.listBlogsAdmin(ctx);
  return <BlogEditor posts={list.posts} productsWithoutBlog={list.productsWithoutBlog} />;
}

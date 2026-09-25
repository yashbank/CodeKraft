import { BlogIndexPage } from "@/components/site/BlogIndexPage";

import { BLOG_POSTS } from "../../_fixtures/site";
import { readState, SitePreview, type SearchParams } from "../_shared";

export const metadata = { title: "SCR-SITE-07 Blog index" };

const STATES = [
  { id: "default", label: "Default" },
  { id: "loading", label: "Loading" },
  { id: "empty", label: "Empty" },
  { id: "paginated", label: "Pagination (1/page)" },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams);
  return (
    <SitePreview href="/dev/screens/site/blog" states={STATES} current={state} currentPath="/blog">
      <BlogIndexPage
        key={state}
        posts={state === "empty" ? [] : BLOG_POSTS}
        loading={state === "loading"}
        pageSize={state === "paginated" ? 1 : 12}
      />
    </SitePreview>
  );
}

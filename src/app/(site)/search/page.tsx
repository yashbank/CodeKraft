import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

/** BUG-026 — no site-wide search engine exists; `/search?q=` hands the query to /products. */
export default async function SearchRedirectPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  redirect(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
}

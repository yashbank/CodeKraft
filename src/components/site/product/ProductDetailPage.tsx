import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { BlogTeaserCard } from "../BlogTeaserCard";
import { Container } from "../Container";
import { CtaBand } from "../CtaBand";
import { InquiryTrigger } from "../InquiryTrigger";
import type { ProductDetail, ServiceOption } from "../types";
import { MediaGallery } from "./MediaGallery";
import { OfferingPanel, type OfferingPanelProps } from "./OfferingPanel";
import { ProductTabs } from "./ProductTabs";

export interface ProductDetailPageProps extends Omit<
  OfferingPanelProps,
  "product" | "serviceOptions"
> {
  product: ProductDetail;
  serviceOptions: ServiceOption[];
}

/**
 * SCR-SITE-04 — breadcrumb (collapses to "‹ Products" on phones), 60/40 gallery + sticky offering
 * panel at lg, tabs/accordion sections, blog teaser card (card + link only, D-804), closing
 * "Request customisation" band. Never shows partner/ownership (BR-02); no related products/ratings.
 */
export function ProductDetailPage({ product, serviceOptions, ...panel }: ProductDetailPageProps) {
  const p = product;
  return (
    <>
      <Container className="pt-6 lg:pt-8">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-body-sm text-fg-muted hover:text-fg md:hidden"
        >
          <ChevronLeftIcon aria-hidden className="size-4" /> Products
        </Link>
        <Breadcrumb className="hidden md:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/products">Products</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/products?category=${p.category.slug}`}>{p.category.name}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{p.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Container>

      <Container className="mt-6 grid gap-8 md:grid-cols-2 lg:grid-cols-5 lg:gap-12">
        <div className="lg:col-span-3 2xl:max-w-[960px]">
          <MediaGallery media={p.media} />
        </div>
        <div className="lg:col-span-2 2xl:max-w-[480px]">
          <OfferingPanel product={p} serviceOptions={serviceOptions} {...panel} />
        </div>
      </Container>

      <Container className="mt-16 lg:mt-24">
        <ProductTabs product={p} />
      </Container>

      {p.blog ? (
        <Container className="mt-16 lg:mt-24">
          <section aria-labelledby="product-blog-title" className="space-y-6">
            <div className="space-y-2">
              <p className="text-overline font-semibold tracking-wider text-accent-text uppercase">
                From the blog
              </p>
              <h2 id="product-blog-title" className="text-h2">
                Read the full article
              </h2>
            </div>
            <BlogTeaserCard post={p.blog} featured />
          </section>
        </Container>
      ) : null}

      <CtaBand
        title={`Need ${p.name} tailored to you?`}
        body="Extra modules, integrations or a white-label build — tell us what you'd change and we'll scope it."
        actions={
          <InquiryTrigger
            size="lg"
            sheet={{
              serviceOptions,
              source: "product_cta",
              title: `Customisation for ${p.name}`,
              defaults: { message: `Customisation for ${p.name}: ` },
            }}
          >
            Request customisation
          </InquiryTrigger>
        }
      />
    </>
  );
}

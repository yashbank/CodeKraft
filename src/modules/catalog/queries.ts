"use server";

/**
 * Catalog read-only queries (API-CAT-18..19, 31..32, 34, 36, PHASE-03 P3.6).
 * Public queries use definePublicAction; authenticated queries use defineAction (SA-07).
 */
import { z } from "zod";
import { defineAction, definePublicAction } from "@/lib/actions/envelope";
import {
  getProductAdminSchema,
  getProductBySlugSchema,
  listFeaturedProductsSchema,
  listMyWishlistSchema,
  listProductsAdminSchema,
} from "./contracts";
import { catalogService } from "./service";

export const listProductsAdminQuery = defineAction({
  name: "API-CAT-18 listProductsAdmin",
  input: listProductsAdminSchema,
  permission: "catalog.read",
  handler: (input, ctx) => catalogService.listProductsAdmin(ctx, input),
});

export const getProductAdminQuery = defineAction({
  name: "API-CAT-19 getProductAdmin",
  input: getProductAdminSchema,
  permission: "catalog.read",
  handler: (input, ctx) => catalogService.getProductAdmin(ctx, input),
});

export const getProductBySlugQuery = definePublicAction({
  name: "API-CAT-31 getProductBySlug",
  input: getProductBySlugSchema,
  handler: (input, ctx) => catalogService.getProductBySlug(ctx, input),
});

export const listCategoriesQuery = definePublicAction({
  name: "API-CAT-32 listCategories",
  input: z.object({}),
  handler: (_input, ctx) => catalogService.listCategories(ctx),
});

export const listFeaturedProductsQuery = definePublicAction({
  name: "API-CAT-34 listFeaturedProducts",
  input: listFeaturedProductsSchema,
  handler: (input, ctx) => catalogService.listFeaturedProducts(ctx, input),
});

export const listMyWishlistQuery = defineAction({
  name: "API-CAT-36 listMyWishlist",
  input: listMyWishlistSchema,
  permission: "account.self",
  handler: (input, ctx) => catalogService.listMyWishlist(ctx, input),
});

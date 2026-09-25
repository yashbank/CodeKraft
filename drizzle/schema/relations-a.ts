/**
 * Drizzle `relations()` for schema domain A (query-builder navigation only; FKs are on the tables).
 * Cross-domain relations (approval_requests, orders, entitlements) are added by their owning domain.
 */
import { relations } from "drizzle-orm";
import { users } from "./auth";
import {
  categories,
  featuredProducts,
  productBlogs,
  productFaqs,
  productMedia,
  productTags,
  productTestimonials,
  productVersions,
  products,
  tags,
  wishlists,
} from "./catalog";
import {
  caseStudies,
  clientLogos,
  faqs,
  legalPageVersions,
  legalPages,
  testimonials,
} from "./content";
import { media } from "./media";
import { offeringPaymentMethods, offeringPrices, offerings } from "./offerings";
import { productOwnershipLines, productOwnerships } from "./ownership";
import { customerProfiles, partners } from "./users-ext";

export const usersRelationsA = relations(users, ({ one, many }) => ({
  partner: one(partners, { fields: [users.id], references: [partners.userId] }),
  customerProfile: one(customerProfiles, {
    fields: [users.id],
    references: [customerProfiles.userId],
  }),
  wishlists: many(wishlists),
  uploadedMedia: many(media),
}));

export const partnersRelations = relations(partners, ({ one, many }) => ({
  user: one(users, { fields: [partners.userId], references: [users.id] }),
  ownershipLines: many(productOwnershipLines),
}));

export const customerProfilesRelations = relations(customerProfiles, ({ one }) => ({
  user: one(users, { fields: [customerProfiles.userId], references: [users.id] }),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  uploader: one(users, { fields: [media.uploadedBy], references: [users.id] }),
  productMedia: many(productMedia),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_children",
  }),
  children: many(categories, { relationName: "category_children" }),
  products: many(products),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  productTags: many(productTags),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  ogImage: one(media, { fields: [products.ogImageMediaId], references: [media.id] }),
  creator: one(users, { fields: [products.createdBy], references: [users.id] }),
  productTags: many(productTags),
  versions: many(productVersions),
  faqs: many(productFaqs),
  testimonials: many(productTestimonials),
  media: many(productMedia),
  blog: one(productBlogs, { fields: [products.id], references: [productBlogs.productId] }),
  offerings: many(offerings),
  ownerships: many(productOwnerships),
  featured: one(featuredProducts, {
    fields: [products.id],
    references: [featuredProducts.productId],
  }),
  wishlists: many(wishlists),
  siteTestimonials: many(testimonials),
  siteFaqs: many(faqs),
}));

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, { fields: [productTags.productId], references: [products.id] }),
  tag: one(tags, { fields: [productTags.tagId], references: [tags.id] }),
}));

export const productVersionsRelations = relations(productVersions, ({ one }) => ({
  product: one(products, { fields: [productVersions.productId], references: [products.id] }),
  creator: one(users, { fields: [productVersions.createdBy], references: [users.id] }),
}));

export const productFaqsRelations = relations(productFaqs, ({ one }) => ({
  product: one(products, { fields: [productFaqs.productId], references: [products.id] }),
}));

export const productTestimonialsRelations = relations(productTestimonials, ({ one }) => ({
  product: one(products, { fields: [productTestimonials.productId], references: [products.id] }),
  avatar: one(media, { fields: [productTestimonials.avatarMediaId], references: [media.id] }),
}));

export const productMediaRelations = relations(productMedia, ({ one }) => ({
  product: one(products, { fields: [productMedia.productId], references: [products.id] }),
  media: one(media, { fields: [productMedia.mediaId], references: [media.id] }),
}));

export const productBlogsRelations = relations(productBlogs, ({ one }) => ({
  product: one(products, { fields: [productBlogs.productId], references: [products.id] }),
  cover: one(media, { fields: [productBlogs.coverMediaId], references: [media.id] }),
  author: one(users, { fields: [productBlogs.authorId], references: [users.id] }),
}));

export const featuredProductsRelations = relations(featuredProducts, ({ one }) => ({
  product: one(products, { fields: [featuredProducts.productId], references: [products.id] }),
}));

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  user: one(users, { fields: [wishlists.userId], references: [users.id] }),
  product: one(products, { fields: [wishlists.productId], references: [products.id] }),
}));

export const offeringsRelations = relations(offerings, ({ one, many }) => ({
  product: one(products, { fields: [offerings.productId], references: [products.id] }),
  prices: many(offeringPrices),
  paymentMethods: many(offeringPaymentMethods),
}));

export const offeringPricesRelations = relations(offeringPrices, ({ one }) => ({
  offering: one(offerings, { fields: [offeringPrices.offeringId], references: [offerings.id] }),
}));

export const offeringPaymentMethodsRelations = relations(offeringPaymentMethods, ({ one }) => ({
  offering: one(offerings, {
    fields: [offeringPaymentMethods.offeringId],
    references: [offerings.id],
  }),
}));

export const productOwnershipsRelations = relations(productOwnerships, ({ one, many }) => ({
  product: one(products, { fields: [productOwnerships.productId], references: [products.id] }),
  creator: one(users, { fields: [productOwnerships.createdBy], references: [users.id] }),
  lines: many(productOwnershipLines),
}));

export const productOwnershipLinesRelations = relations(productOwnershipLines, ({ one }) => ({
  ownership: one(productOwnerships, {
    fields: [productOwnershipLines.ownershipId],
    references: [productOwnerships.id],
  }),
  partner: one(partners, { fields: [productOwnershipLines.partnerId], references: [partners.id] }),
}));

export const caseStudiesRelations = relations(caseStudies, ({ one }) => ({
  cover: one(media, { fields: [caseStudies.coverMediaId], references: [media.id] }),
}));

export const testimonialsRelations = relations(testimonials, ({ one }) => ({
  avatar: one(media, { fields: [testimonials.avatarMediaId], references: [media.id] }),
  product: one(products, { fields: [testimonials.productId], references: [products.id] }),
}));

export const clientLogosRelations = relations(clientLogos, ({ one }) => ({
  media: one(media, { fields: [clientLogos.mediaId], references: [media.id] }),
}));

export const faqsRelations = relations(faqs, ({ one }) => ({
  product: one(products, { fields: [faqs.productId], references: [products.id] }),
}));

export const legalPagesRelations = relations(legalPages, ({ many }) => ({
  versions: many(legalPageVersions),
}));

export const legalPageVersionsRelations = relations(legalPageVersions, ({ one }) => ({
  page: one(legalPages, { fields: [legalPageVersions.legalPageId], references: [legalPages.id] }),
  publisher: one(users, { fields: [legalPageVersions.publishedBy], references: [users.id] }),
}));

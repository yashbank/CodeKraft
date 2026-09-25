"use server";

/**
 * Content read-only queries (API-CONT-09, PHASE-03 P3.11).
 * All public queries use definePublicAction (SA-07).
 */
import { z } from "zod";
import { definePublicAction } from "@/lib/actions/envelope";
import {
  getCaseStudyBySlugSchema,
  getLegalPageSchema,
  listCaseStudiesSchema,
  listFaqsSchema,
  listTestimonialsSchema,
} from "./contracts";
import { contentService } from "./service";

export const getLandingContentQuery = definePublicAction({
  name: "API-CONT-09 getLandingContent",
  input: z.object({}),
  handler: (_input, ctx) => contentService.getLandingContent(ctx),
});

export const listServicesQuery = definePublicAction({
  name: "API-CONT-09 listServices",
  input: z.object({}),
  handler: (_input, ctx) => contentService.listServices(ctx),
});

export const listCaseStudiesQuery = definePublicAction({
  name: "API-CONT-09 listCaseStudies",
  input: listCaseStudiesSchema,
  handler: (input, ctx) => contentService.listCaseStudies(ctx, input),
});

export const getCaseStudyBySlugQuery = definePublicAction({
  name: "API-CONT-09 getCaseStudyBySlug",
  input: getCaseStudyBySlugSchema,
  handler: (input, ctx) => contentService.getCaseStudyBySlug(ctx, input),
});

export const listTestimonialsQuery = definePublicAction({
  name: "API-CONT-09 listTestimonials",
  input: listTestimonialsSchema,
  handler: (input, ctx) => contentService.listTestimonials(ctx, input),
});

export const listClientLogosQuery = definePublicAction({
  name: "API-CONT-09 listClientLogos",
  input: z.object({}),
  handler: (_input, ctx) => contentService.listClientLogos(ctx),
});

export const listFaqsQuery = definePublicAction({
  name: "API-CONT-09 listFaqs",
  input: listFaqsSchema,
  handler: (input, ctx) => contentService.listFaqs(ctx, input),
});

export const getLegalPageQuery = definePublicAction({
  name: "API-CONT-09 getLegalPage",
  input: getLegalPageSchema,
  handler: (input, ctx) => contentService.getLegalPage(ctx, input),
});

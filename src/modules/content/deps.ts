/** Dependencies of the content service (`createContentService(deps)`); fakes in unit tests. */
import { can } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";
import { type AuditPort, auditPort } from "./audit";
import { type MediaUrlResolver, defaultMediaUrl } from "./internal";

export interface ContentDeps {
  audit: AuditPort;
  mediaUrl: MediaUrlResolver;
  now: () => Date;
}

export const defaultContentDeps: ContentDeps = {
  audit: auditPort,
  mediaUrl: defaultMediaUrl,
  now: () => new Date(),
};

export function withDefaults(deps: Partial<ContentDeps> = {}): ContentDeps {
  return { ...defaultContentDeps, ...deps };
}

/**
 * docs/06 §2.10: `content.write` saves drafts; flipping a `published` flag needs
 * `content.publish`. `previous` is `undefined` for a new row.
 */
export function assertPublishFlag(
  ctx: RequestContext,
  previous: boolean | undefined,
  next: boolean,
): void {
  if (next === (previous ?? false)) return;
  if (!can(ctx, "content.publish")) {
    throw new AppError(ErrorCode.FORBIDDEN, "Publishing needs the content.publish permission", {
      cause: { missing: "content.publish" },
    });
  }
}

/** `content.publish` for the explicit publish/unpublish verbs (checked again in the service). */
export function assertCanPublish(ctx: RequestContext): void {
  if (!can(ctx, "content.publish")) {
    throw new AppError(ErrorCode.FORBIDDEN, undefined, { cause: { missing: "content.publish" } });
  }
}

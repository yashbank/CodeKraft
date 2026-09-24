import { describe, expect, it } from "vitest";
import { type Context, anonymousContext, buildContext } from "@/lib/authz/context";
import { type Role } from "@/lib/authz/permissions";
import { isUnscoped, leadScope, ledgerScope, orderScope, productScope } from "@/lib/authz/scope";
import { AppError, ErrorCode } from "@/lib/errors";

const as = (roles: Role[], partnerId?: string): Context =>
  buildContext({ user: { id: "u1" }, session: { id: "s" }, roles, partnerId });

const superAdmin = as(["super_admin"], "p-founder");
const superAdminNoPartner = as(["super_admin"]);
const admin = as(["admin"], "p-partner");
const adminNoPartner = as(["admin"]);
const staff = as(["staff"]);
const customer = as(["customer"]);
const anon = anonymousContext();

function forbidden(fn: () => unknown, subject: string): void {
  try {
    fn();
    expect.unreachable("expected FORBIDDEN");
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe(ErrorCode.FORBIDDEN);
    expect((err as AppError).cause).toEqual({ scope: subject });
  }
}

describe.each([
  ["productScope", productScope, "product"],
  ["orderScope", orderScope, "order"],
  ["ledgerScope", ledgerScope, "ledger"],
] as const)("%s (D-512)", (_name, resolve, subject) => {
  it("super_admin is never scoped, with or without a partner record", () => {
    expect(resolve(superAdmin)).toBe("all");
    expect(resolve(superAdminNoPartner)).toBe("all");
  });
  it("staff has ● cells → all", () => {
    expect(resolve(staff)).toBe("all");
  });
  it("admin is scoped to its partner", () => {
    expect(resolve(admin)).toEqual({ partnerId: "p-partner" });
  });
  it("admin without a partner record is refused", () => {
    forbidden(() => resolve(adminNoPartner), subject);
  });
  it("customer and anonymous are refused", () => {
    forbidden(() => resolve(customer), subject);
    forbidden(() => resolve(anon), subject);
  });
  it("super_admin + admin together resolves to all", () => {
    expect(resolve(as(["admin", "super_admin"], "p"))).toBe("all");
  });
});

describe("leadScope (FR-LEAD-10)", () => {
  it("super_admin and staff see all", () => {
    expect(leadScope(superAdmin)).toBe("all");
    expect(leadScope(staff)).toBe("all");
  });
  it("admin sees assigned-or-pool, regardless of partner record", () => {
    expect(leadScope(admin)).toEqual({ assignedTo: "u1", orUnassigned: true });
    expect(leadScope(adminNoPartner)).toEqual({ assignedTo: "u1", orUnassigned: true });
  });
  it("customer and anonymous are refused", () => {
    forbidden(() => leadScope(customer), "lead");
    forbidden(() => leadScope(anon), "lead");
  });
});

describe("isUnscoped", () => {
  it("distinguishes the all sentinel from descriptors", () => {
    expect(isUnscoped("all")).toBe(true);
    expect(isUnscoped({ partnerId: "p" })).toBe(false);
    expect(isUnscoped({ assignedTo: "u", orUnassigned: true })).toBe(false);
  });
});

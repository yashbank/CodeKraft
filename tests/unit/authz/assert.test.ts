import { describe, expect, it } from "vitest";
import {
  assertAdminClass,
  assertAnyPermission,
  assertPermission,
  assertRole,
  assertSelfOr,
  can,
  canAny,
  hasRole,
  isAdminClass,
} from "@/lib/authz/assert";
import { type Context, anonymousContext, buildContext } from "@/lib/authz/context";
import { type Role } from "@/lib/authz/permissions";
import { AppError, ErrorCode } from "@/lib/errors";

const as = (roles: Role[], userId = "u1"): Context =>
  buildContext({ user: { id: userId }, session: { id: "s" }, roles });

const anon = anonymousContext();
const superAdmin = as(["super_admin"]);
const admin = as(["admin"]);
const staff = as(["staff"]);
const customer = as(["customer"]);

function codeOf(fn: () => void): ErrorCode | undefined {
  try {
    fn();
    return undefined;
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return (err as AppError).code;
  }
}

describe("can / canAny / hasRole / isAdminClass", () => {
  it("reads the permission set", () => {
    expect(can(superAdmin, "settings.write")).toBe(true);
    expect(can(admin, "settings.write")).toBe(false);
    expect(can(anon, "account.self")).toBe(false);
    expect(canAny(staff, ["settings.write", "catalog.write"])).toBe(true);
    expect(canAny(customer, ["settings.write", "catalog.write"])).toBe(false);
    expect(canAny(customer, [])).toBe(false);
  });

  it("classifies roles", () => {
    expect(hasRole(admin, "admin")).toBe(true);
    expect(hasRole(admin, "staff")).toBe(false);
    expect(isAdminClass(superAdmin)).toBe(true);
    expect(isAdminClass(admin)).toBe(true);
    expect(isAdminClass(staff)).toBe(false);
    expect(isAdminClass(customer)).toBe(false);
    expect(isAdminClass(anon)).toBe(false);
  });
});

describe("assertPermission", () => {
  it("passes when held", () => {
    expect(codeOf(() => assertPermission(admin, "approvals.decide"))).toBeUndefined();
  });
  it("throws FORBIDDEN when missing, with the permission in cause", () => {
    expect(codeOf(() => assertPermission(staff, "approvals.decide"))).toBe(ErrorCode.FORBIDDEN);
    try {
      assertPermission(staff, "approvals.decide");
    } catch (err) {
      expect((err as AppError).cause).toEqual({ missing: "approvals.decide" });
      expect((err as AppError).message).toBe("You do not have permission to do that.");
    }
  });
  it("throws UNAUTHENTICATED for anonymous callers", () => {
    expect(codeOf(() => assertPermission(anon, "catalog.read"))).toBe(ErrorCode.UNAUTHENTICATED);
  });
});

describe("assertAnyPermission", () => {
  it("passes when any is held", () => {
    expect(
      codeOf(() => assertAnyPermission(staff, ["settings.write", "settings.read"])),
    ).toBeUndefined();
  });
  it("throws FORBIDDEN when none are held", () => {
    expect(codeOf(() => assertAnyPermission(customer, ["settings.write", "settings.read"]))).toBe(
      ErrorCode.FORBIDDEN,
    );
  });
  it("throws UNAUTHENTICATED for anonymous callers", () => {
    expect(codeOf(() => assertAnyPermission(anon, ["account.self"]))).toBe(
      ErrorCode.UNAUTHENTICATED,
    );
  });
});

describe("assertRole / assertAdminClass", () => {
  it("accepts a single role or a list", () => {
    expect(codeOf(() => assertRole(admin, "admin"))).toBeUndefined();
    expect(codeOf(() => assertRole(staff, ["admin", "staff"]))).toBeUndefined();
  });
  it("throws FORBIDDEN for other roles", () => {
    expect(codeOf(() => assertRole(customer, "admin"))).toBe(ErrorCode.FORBIDDEN);
    expect(codeOf(() => assertRole(customer, ["admin", "staff"]))).toBe(ErrorCode.FORBIDDEN);
  });
  it("throws UNAUTHENTICATED for anonymous callers", () => {
    expect(codeOf(() => assertRole(anon, "customer"))).toBe(ErrorCode.UNAUTHENTICATED);
  });
  it("assertAdminClass admits super_admin and admin only", () => {
    expect(codeOf(() => assertAdminClass(superAdmin))).toBeUndefined();
    expect(codeOf(() => assertAdminClass(admin))).toBeUndefined();
    expect(codeOf(() => assertAdminClass(staff))).toBe(ErrorCode.FORBIDDEN);
    expect(codeOf(() => assertAdminClass(customer))).toBe(ErrorCode.FORBIDDEN);
    expect(codeOf(() => assertAdminClass(anon))).toBe(ErrorCode.UNAUTHENTICATED);
  });
});

describe("assertSelfOr", () => {
  const owner = as(["customer"], "owner");
  const other = as(["customer"], "other");

  it("passes for the owner holding the self permission", () => {
    expect(codeOf(() => assertSelfOr(owner, "owner", "commerce.self"))).toBeUndefined();
  });
  it("refuses the owner without the self permission (admin reading its own order as an admin)", () => {
    expect(codeOf(() => assertSelfOr(as(["staff"], "owner"), "owner", "commerce.self"))).toBe(
      ErrorCode.FORBIDDEN,
    );
  });
  it("refuses another customer", () => {
    expect(codeOf(() => assertSelfOr(other, "owner", "commerce.self"))).toBe(ErrorCode.FORBIDDEN);
  });
  it("passes a non-owner holding the elevated permission", () => {
    expect(
      codeOf(() => assertSelfOr(staff, "owner", "commerce.self", "orders.read")),
    ).toBeUndefined();
  });
  it("refuses a non-owner without the elevated permission and names both in cause", () => {
    expect(codeOf(() => assertSelfOr(customer, "owner", "commerce.self", "orders.read"))).toBe(
      ErrorCode.FORBIDDEN,
    );
    try {
      assertSelfOr(customer, "owner", "commerce.self", "orders.read");
    } catch (err) {
      expect((err as AppError).cause).toEqual({ missing: "commerce.self|orders.read" });
    }
  });
  it("throws UNAUTHENTICATED for anonymous callers", () => {
    expect(codeOf(() => assertSelfOr(anon, "owner", "commerce.self"))).toBe(
      ErrorCode.UNAUTHENTICATED,
    );
  });
});

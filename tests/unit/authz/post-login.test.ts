import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isAdminAreaUser, postLoginDestination } from "@/lib/authz/post-login";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("postLoginDestination", () => {
  it.each(["super_admin", "admin", "staff"])("%s lands in the admin area only", (role) => {
    expect(postLoginDestination([role], "/account/orders")).toEqual({
      area: "admin",
      path: "/dashboard",
    });
  });

  it("a customer keeps the customer area and the requested page", () => {
    expect(postLoginDestination(["customer"], "/account/orders")).toEqual({
      area: "customer",
      path: "/account/orders",
    });
  });

  it("no role rows counts as a customer and defaults to /account", () => {
    expect(postLoginDestination([])).toEqual({ area: "customer", path: "/account" });
  });

  it("any admin-area role wins when mixed with customer", () => {
    expect(isAdminAreaUser(["customer", "staff"])).toBe(true);
    expect(isAdminAreaUser(["customer"])).toBe(false);
  });

  it("ignores unknown role keys", () => {
    expect(isAdminAreaUser(["superuser", "root"])).toBe(false);
  });
});

describe("every sign-in path uses the one helper", () => {
  it("the Google button lands on /auth/post-login, which calls postLoginDestination", () => {
    expect(read("src/components/account/LoginForm.tsx")).toMatch(
      /provider: "google",[\s\S]*callbackURL: `\/auth\/post-login\?next=/,
    );
    expect(read("src/app/(auth)/auth/post-login/page.tsx")).toContain("postLoginDestination(");
  });

  it("the email sign-in role probe and the account guard use the same rule", () => {
    expect(read("src/app/api/auth/role/route.ts")).toContain("postLoginDestination(");
    expect(read("src/app/(account)/layout.tsx")).toContain("isAdminAreaUser(");
  });

  it("the customer server-action context refuses admin-class users", () => {
    expect(read("src/lib/authz/site-request-context.ts")).toMatch(
      /hasAdminClassRole\(loadedRoles\)\) throw new AppError\(ErrorCode\.FORBIDDEN\)/,
    );
  });
});

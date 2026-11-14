import { describe, expect, it } from "vitest";

import { resolveTrustedOrigins } from "@/modules/auth/trusted-origins";

const PROD = {
  appEnv: "production",
  siteUrl: "https://crestlinetechnologies.in",
  adminUrl: "https://admin.crestlinetechnologies.in",
  adminHost: "admin.crestlinetechnologies.in",
  vercel: {},
};

describe("resolveTrustedOrigins", () => {
  it("production has no wildcard and keeps every URL the app itself uses", () => {
    const list = resolveTrustedOrigins(PROD);
    expect(list.some((o) => o.includes("*"))).toBe(false);
    for (const url of [
      "https://crestlinetechnologies.in",
      "https://www.crestlinetechnologies.in",
      "https://admin.crestlinetechnologies.in",
      "https://codekraft-admin.vercel.app",
      "https://codekraft-dusky.vercel.app",
      "https://codekraft.vercel.app",
    ]) {
      expect(list).toContain(url);
    }
  });

  it("production adds the apex when the configured site is www", () => {
    const list = resolveTrustedOrigins({ ...PROD, siteUrl: "https://www.example.com" });
    expect(list).toContain("https://www.example.com");
    expect(list).toContain("https://example.com");
  });

  it("production includes the Vercel-provided deployment URLs exactly", () => {
    const list = resolveTrustedOrigins({
      ...PROD,
      vercel: { url: "codekraft-abc.vercel.app", productionUrl: "codekraft.vercel.app" },
    });
    expect(list).toContain("https://codekraft-abc.vercel.app");
    expect(list).toContain("https://codekraft.vercel.app");
    expect(list.some((o) => o.includes("*"))).toBe(false);
  });

  it("production does not trust an arbitrary vercel.app host", () => {
    const list = resolveTrustedOrigins(PROD);
    expect(list).not.toContain("https://evil.vercel.app");
    expect(list).not.toContain("https://*.vercel.app");
  });

  it.each(["local", "preview", "staging"])("%s keeps the wildcard", (appEnv) => {
    const list = resolveTrustedOrigins({
      appEnv,
      siteUrl: "http://localhost:3000",
      adminUrl: "http://admin.localhost:3000",
      adminHost: "admin.localhost:3000",
      vercel: {},
    });
    expect(list).toContain("https://*.vercel.app");
    expect(list).toContain("http://localhost:3000");
    expect(list).toContain("http://admin.localhost:3000");
  });

  it("has no duplicates", () => {
    const list = resolveTrustedOrigins(PROD);
    expect(new Set(list).size).toBe(list.length);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { maintenanceHtml, parseSitePhase, phaseBadge, shouldSuppressEmail } from "@/lib/site-phase";
import { resetSitePhaseCache, sitePhaseGate } from "@/lib/site-phase-edge";

describe("parseSitePhase", () => {
  it("defaults to live for missing or unknown values", () => {
    for (const v of [undefined, null, "", "production", 3, {}])
      expect(parseSitePhase(v)).toBe("live");
  });
  it("accepts the three phases", () => {
    expect(parseSitePhase("live")).toBe("live");
    expect(parseSitePhase("testing")).toBe("testing");
    expect(parseSitePhase("maintenance")).toBe("maintenance");
  });
});

describe("phaseBadge visibility by role", () => {
  it("never shows when live", () => {
    for (const r of ["super_admin", "admin", "staff"]) expect(phaseBadge(r, "live")).toBeNull();
  });
  it("shows only to super admins when not live", () => {
    expect(phaseBadge("super_admin", "testing")).toEqual({ label: "Testing", tone: "warning" });
    expect(phaseBadge("super_admin", "maintenance")?.label).toBe("Maintenance");
    for (const r of ["admin", "staff", undefined, "customer"]) {
      expect(phaseBadge(r, "testing")).toBeNull();
      expect(phaseBadge(r, "maintenance")).toBeNull();
    }
  });
});

describe("shouldSuppressEmail", () => {
  it("suppresses non-staff recipients only in testing", () => {
    expect(shouldSuppressEmail("testing", false)).toBe(true);
    expect(shouldSuppressEmail("testing", true)).toBe(false);
    expect(shouldSuppressEmail("live", false)).toBe(false);
    expect(shouldSuppressEmail("maintenance", false)).toBe(false);
  });
});

describe("sitePhaseGate (middleware)", () => {
  const fetchMock = vi.fn();
  const phaseBody = (phase: string, staff = false) =>
    new Response(JSON.stringify({ phase, staff }), { status: 200 });
  const req = (path: string, cookie?: string) =>
    new NextRequest(`http://localhost:3000${path}`, {
      headers: cookie ? { cookie } : undefined,
    });
  beforeEach(() => {
    resetSitePhaseCache();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("live: passes through", async () => {
    fetchMock.mockResolvedValue(phaseBody("live"));
    const g = await sitePhaseGate(req("/products"));
    expect(g).toEqual({ phase: "live", response: null });
  });

  it("fails open to live when the probe errors", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect((await sitePhaseGate(req("/"))).response).toBeNull();
    resetSitePhaseCache();
    fetchMock.mockResolvedValue(new Response("x", { status: 500 }));
    expect((await sitePhaseGate(req("/"))).phase).toBe("live");
  });

  it("testing: no response, phase reported for the robots header", async () => {
    fetchMock.mockResolvedValue(phaseBody("testing"));
    expect(await sitePhaseGate(req("/"))).toEqual({ phase: "testing", response: null });
  });

  it("maintenance: cookie-less visitor gets 503 with Retry-After", async () => {
    fetchMock.mockResolvedValue(phaseBody("maintenance"));
    const g = await sitePhaseGate(req("/products"));
    expect(g.response?.status).toBe(503);
    expect(g.response?.headers.get("Retry-After")).toBe("300");
    expect(await g.response?.text()).toBe(maintenanceHtml());
  });

  it("maintenance: /api and /auth stay open; the probe itself is never gated", async () => {
    fetchMock.mockResolvedValue(phaseBody("maintenance"));
    expect((await sitePhaseGate(req("/api/webhooks/razorpay"))).response).toBeNull();
    expect((await sitePhaseGate(req("/auth/login"))).response).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // /api/* never probes; only /auth/login did
  });

  it("maintenance: admin-class session keeps the storefront, customer session does not", async () => {
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => {
      const cookie = (init?.headers as Record<string, string> | undefined)?.cookie;
      if (!cookie) return phaseBody("maintenance");
      return phaseBody("maintenance", cookie.includes("admin"));
    });
    const staff = await sitePhaseGate(req("/", "ck.session_token=admin"));
    expect(staff.response).toBeNull();
    const customer = await sitePhaseGate(req("/", "ck.session_token=cust"));
    expect(customer.response?.status).toBe(503);
  });
});

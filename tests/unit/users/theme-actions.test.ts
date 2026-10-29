import { beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.fn();
const where = vi.fn().mockResolvedValue(undefined);
const session = vi.fn();
const themeToggle = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    update: () => ({
      set: (v: unknown) => {
        set(v);
        return { where };
      },
    }),
  },
}));
vi.mock("@/modules/auth/service", () => ({ getSession: () => session() }));
vi.mock("@/lib/site-brand", () => ({
  getThemeConfig: async () => ({ themeToggle: themeToggle() }),
}));

import { setThemePreference } from "@/modules/users/theme-actions";

describe("setThemePreference (P14-12b)", () => {
  beforeEach(() => {
    set.mockClear();
    session.mockReset().mockResolvedValue({ user: { id: "u1" } });
    themeToggle.mockReset().mockReturnValue(true);
  });

  it("stores the choice on the signed-in user's profile", async () => {
    expect(await setThemePreference("auto")).toEqual({ ok: true, saved: true });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ themePref: "auto" }));
  });

  it("leaves anonymous visitors to the cookie", async () => {
    session.mockResolvedValue(null);
    expect(await setThemePreference("light-editorial")).toEqual({ ok: true, saved: false });
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects unknown values and respects the admin theme-toggle setting", async () => {
    expect((await setThemePreference("neon")).ok).toBe(false);
    themeToggle.mockReturnValue(false);
    expect((await setThemePreference("auto")).ok).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });
});

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Test harness (P1.9, docs/10 §1, §12).
 *  - `unit`        jsdom, tests/unit + tests/property (fast-check) + tests/static (source scans),
 *                  Testing Library + jest-dom
 *  - `integration` node, real Postgres from tests/setup/global-db.ts, files run serially
 * Coverage thresholds follow docs/10 §12; per-glob entries only bite once matching files exist
 * (an empty glob reports 100 %), so they are safe to declare before the modules land.
 */
const strict = { lines: 100, branches: 100, functions: 100, statements: 100 };
const finance = { lines: 95, branches: 90, functions: 95, statements: 95 };
const sensitive = { lines: 90, branches: 80, functions: 90, statements: 90 };
const components = { lines: 60, branches: 50, functions: 60, statements: 60 };

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    reporters: process.env.GITHUB_ACTIONS ? ["default", "github-actions"] : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.stories.*",
        "src/app/**", // route entries: exercised by Playwright (e2e/axe), not unit tests
        "src/emails/**", // render snapshots (docs/10 §12)
        "src/pdf/**",
        "src/styles/**",
        "tests/**",
        "drizzle/**",
      ],
      thresholds: {
        perFile: false,
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
        "src/modules/{finance,approvals,payments,entitlements,invoices,orders}/**": finance,
        "src/modules/{chat,media,auth}/**": sensitive,
        "src/{modules,lib}/authz/**": strict,
        "src/lib/money.ts": strict,
        "src/components/**": components,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: [
            "tests/unit/**/*.test.{ts,tsx}",
            "tests/property/**/*.test.{ts,tsx}",
            "tests/static/**/*.test.{ts,tsx}",
          ],
          environment: "jsdom",
          setupFiles: ["tests/setup/unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/setup/integration.ts"],
          globalSetup: ["tests/setup/global-db.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});

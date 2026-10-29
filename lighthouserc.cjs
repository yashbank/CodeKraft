/**
 * Lighthouse CI (docs/11 §B10, docs/10 §9). `pnpm build` first, then `pnpm lhci`.
 * Mobile is Lighthouse's default form factor (Moto G Power emulation, 4x CPU slowdown, slow 4G).
 * URLs use seeded slugs (scripts/seed/catalog.ts, content.ts).
 */
const BASE = process.env.LHCI_BASE_URL ?? "http://localhost:3000";
const home = `${BASE}/`;

module.exports = {
  ci: {
    collect: {
      // In CI the job passes the Vercel preview URL via LHCI_BASE_URL and skips the server.
      startServerCommand: process.env.LHCI_BASE_URL ? undefined : "pnpm start",
      startServerReadyPattern: "Ready|started server|Local:",
      startServerReadyTimeout: 60_000,
      url: [
        home,
        `${BASE}/products`,
        `${BASE}/products/tradeflow`,
        `${BASE}/projects/northwind-checkout`,
        `${BASE}/blog/how-fitdesk-pro-collects-fees-on-upi`,
        `${BASE}/services`,
        `${BASE}/contact`,
        `${BASE}/legal/privacy`,
      ],
      numberOfRuns: 3,
      settings: {
        formFactor: "mobile",
        throttlingMethod: "simulate",
        skipAudits: ["uses-http2"], // local `next start` is plain HTTP/1.1
      },
    },
    assert: {
      // Median of the 3 runs (docs/10 §9). Same budgets for every public URL (P14-13).
      aggregationMethod: "median",
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "resource-summary:script:size": ["error", { maxNumericValue: 350 * 1024 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
        interactive: ["warn", { maxNumericValue: 5000 }],
        "unused-javascript": "warn",
        "render-blocking-resources": "warn",
        "uses-responsive-images": "warn",
        "modern-image-formats": "warn",
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};

/**
 * Lighthouse CI (docs/11 §B10, docs/10 §9). `pnpm build` first, then `pnpm lhci`.
 * Mobile is Lighthouse's default form factor (Moto G Power emulation, 4x CPU slowdown, slow 4G).
 * Only `/` exists in P1; the remaining public URLs are enabled as their routes land.
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
        // TODO(P7): enable once the public routes exist (docs/11 §B10 list):
        // `${BASE}/products`,
        // `${BASE}/products/<seeded-slug>`,
        // `${BASE}/projects/<seeded-slug>`,
        // `${BASE}/blog/<seeded-slug>`,
        // `${BASE}/services`,
        // `${BASE}/contact`,
        // `${BASE}/legal/privacy`,
      ],
      numberOfRuns: 3,
      settings: {
        formFactor: "mobile",
        throttlingMethod: "simulate",
        skipAudits: ["uses-http2"], // local `next start` is plain HTTP/1.1
      },
    },
    assert: {
      // `aggregationMethod` cannot sit beside `assertMatrix` (LHCI rejects the config), so each
      // matrix entry carries it: median of the 3 runs (docs/10 §9).
      assertMatrix: [
        {
          // Story landing (`/`): performance ≥ 0.85, everything else at the public thresholds.
          matchingUrlPattern: "^https?://[^/]+/$",
          aggregationMethod: "median",
          assertions: {
            "categories:performance": ["error", { minScore: 0.85 }],
            "categories:accessibility": ["error", { minScore: 0.95 }],
            "categories:best-practices": ["error", { minScore: 0.9 }],
            "categories:seo": ["error", { minScore: 0.95 }],
            "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
            "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
            "total-blocking-time": ["error", { maxNumericValue: 300 }],
            interactive: ["warn", { maxNumericValue: 5000 }],
            "unused-javascript": "warn",
            "render-blocking-resources": "warn",
            "uses-responsive-images": "warn",
            "modern-image-formats": "warn",
          },
        },
        {
          // Every other public route: performance ≥ 0.90.
          matchingUrlPattern: "^https?://[^/]+/.+",
          aggregationMethod: "median",
          assertions: {
            "categories:performance": ["error", { minScore: 0.9 }],
            "categories:accessibility": ["error", { minScore: 0.95 }],
            "categories:best-practices": ["error", { minScore: 0.9 }],
            "categories:seo": ["error", { minScore: 0.95 }],
            "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
            "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
            "total-blocking-time": ["error", { maxNumericValue: 300 }],
            interactive: ["warn", { maxNumericValue: 5000 }],
            "unused-javascript": "warn",
            "render-blocking-resources": "warn",
            "uses-responsive-images": "warn",
            "modern-image-formats": "warn",
          },
        },
      ],
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};

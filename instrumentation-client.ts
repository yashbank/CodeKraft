/**
 * Sentry browser SDK is loaded lazily (after idle) so it never sits in the first-load bundle
 * (docs/10 §9 budget, docs/11 §B7). Router transitions recorded once the SDK is ready.
 */
type SentryModule = typeof import("@sentry/nextjs");

let sentry: SentryModule | null = null;
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && typeof window !== "undefined") {
  const start = () => {
    void import("./src/lib/sentry")
      .then(({ sentryBaseOptions }) =>
        import("@sentry/nextjs").then((mod) => ({ mod, sentryBaseOptions })),
      )
      .then(({ mod, sentryBaseOptions }) => {
        mod.init({
          ...sentryBaseOptions,
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0,
        });
        sentry = mod;
      });
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 1500);
}

export function onRouterTransitionStart(href: string, navigationType: string): void {
  sentry?.captureRouterTransitionStart(href, navigationType);
}

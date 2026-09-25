import * as Sentry from "@sentry/nextjs";

import { sentryBaseOptions } from "./src/lib/sentry";

Sentry.init({ ...sentryBaseOptions, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

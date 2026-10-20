// Sentry — browser. Next.js loads this file automatically on the client.
// Inert when NEXT_PUBLIC_SENTRY_DSN is unset (local dev stays quiet).
import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
    // Errors only. No performance tracing and NO replay: Sentry's replay
    // records every DOM change into a buffer all session long (even when it
    // only uploads on error) and tracing wraps every fetch and navigation —
    // together they made every page feel slow on the shop's devices.
    // Clarity already gives masked recordings. (Leave tracesSampleRate out
    // entirely: even 0 switches Sentry's tracing integration on.)
    // A store's data is sensitive: never ship PII.
    sendDefaultPii: false,
    // Noise we can't act on: browser extensions, aborted requests, and the
    // offline-mode failures the app already handles gracefully.
    ignoreErrors: [
      "AbortError",
      "Failed to fetch",
      "NetworkError",
      "Load failed",
      "ResizeObserver loop",
      "تعذر الاتصال بالخادم",
    ],
  })
}

// Required by Next.js for navigation instrumentation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

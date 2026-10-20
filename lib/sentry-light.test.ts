import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// Sentry's replay + tracing made the whole app laggy (Oct 2026). Keep it errors-only.
describe("sentry stays light in the browser", () => {
  const src = readFileSync("instrumentation-client.ts", "utf8")
  it("has no session replay", () => expect(src).not.toMatch(/replayIntegration\(|replaysOnErrorSampleRate|replaysSessionSampleRate/))
  it("drops the default tracing integration", () => expect(src).toContain('i.name !== "BrowserTracing"'))
  it("has no performance tracing", () => expect(src).not.toMatch(/tracesSampleRate:|tracesSampler|browserTracingIntegration/))
})

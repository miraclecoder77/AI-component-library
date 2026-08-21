import { defineConfig, devices } from "@playwright/test";

/**
 * The suite runs against a production build with no GEMINI_API_KEY, so every
 * demo is served from recorded fixtures. That is deliberate: the tests need
 * deterministic content and timing, and CI has no business spending live
 * quota. The fixture path is also the path most visitors will hit once the
 * free-tier limit is reached, so it is the one worth guarding.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // No key, so every request is served from a fixture: deterministic
      // content and timing, and no live quota spent by CI.
      GEMINI_API_KEY: "",
      // The whole suite runs from one address in seconds, which would
      // otherwise trip the per-visitor burst limit and leave the later tests
      // asserting against an error state. The limiter has its own test.
      RATE_LIMIT_PER_MINUTE: "500",
      RATE_LIMIT_PER_DAY: "5000",
    },
  },
});

import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Each worker owns an isolated server and temporary repository (fixtures.ts),
  // so browser projects and tests can run concurrently without sharing data.
  workers: process.env.CI ? 2 : "50%",
  timeout: 30000,
  expect: { timeout: 8000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});

// End-to-end tests: run with `npm run test:e2e` (or `npx playwright test`).
// Desktop runs in Chromium and WebKit (Safari's engine); the iPad projects use
// WebKit with touch, mobile viewport and the iPad user agent.
const { defineConfig, devices } = require("@playwright/test");

const PORT = 4173;

module.exports = defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: "retain-on-failure"
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "desktop-safari", use: { ...devices["Desktop Safari"] } },
    // 10.2" iPad (810×1080), the usual kids' iPad, in both orientations
    { name: "ipad-portrait", use: { ...devices["iPad (gen 7)"] } },
    { name: "ipad-landscape", use: { ...devices["iPad (gen 7) landscape"] } },
    // the shortest realistic screen: iPad mini held sideways (1024×768)
    { name: "ipad-mini-landscape", use: { ...devices["iPad Mini landscape"] } }
  ],
  webServer: {
    command: `node tests/e2e/server.js`,
    url: `http://localhost:${PORT}/index.html`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI
  }
});

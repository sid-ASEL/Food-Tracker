import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser", fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { browserName: "chromium", channel: "msedge", viewport: { width: 1440, height: 1100 } } },
    { name: "phone", use: { browserName: "chromium", channel: "msedge", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: "npm run preview:ui", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI },
});

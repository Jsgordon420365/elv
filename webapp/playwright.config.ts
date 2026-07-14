// ver 20260714144000.4

import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    timeout: 420_000,
    fullyParallel: false,
    workers: 1,
    reporter: "line",
    use: {
        baseURL: process.env.ELV_DEMO_URL ?? "http://localhost:3000",
        channel: "chrome",
        headless: true,
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
});

// Version history
// 20260714144000.0 - Added isolated Edge acceptance configuration with failure screenshots and traces.
// 20260714144000.1 - Allowed an explicit acceptance URL override when an unrelated process occupies the required port.
// 20260714144000.2 - Switched to installed Chrome after the local Edge binary exited before CDP attachment.
// 20260714144000.3 - Extended the full-path timeout for slow local PBKDF2, development compilation, and four verified downloads.
// 20260714144000.4 - Allowed final responsive and archive assertions to complete on the measured local runtime.

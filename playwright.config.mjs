// ============================================================================
//  NETTLESERTESTENE (v7.13) — hele appen mot Firebase-emulatoren
// ----------------------------------------------------------------------------
//  Kjøres med «npm run test:e2e», som starter emulatoren (firestore + auth,
//  prosjekt demo-pensum) og så Playwright. Appen serveres fra localhost av
//  tests/e2e/server.mjs, og ?emulator=1 kobler den til emulatoren
//  (js/data/emulator.js). Den ekte databasen røres aldri.
//
//  Lokalt brukes Chrome som alt er installert (channel: "chrome"); i CI
//  Playwrights egen Chromium.
// ============================================================================
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 8099);

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.mjs$/,
  // Én om gangen: testene deler emulatoren, og hver fil sår sine egne data.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["github"]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node tests/e2e/server.mjs",
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});

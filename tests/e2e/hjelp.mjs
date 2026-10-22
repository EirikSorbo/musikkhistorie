// ============================================================================
//  HJELPERE FOR NETTLESERTESTENE (v7.13)
// ----------------------------------------------------------------------------
//  Klassekoden og rollen står i localStorage før siden lastes (som for en
//  student som har vært inne før), og emulatorflagget i sessionStorage, så det
//  følger med fra side til side. Læreren logges inn med testinnloggingen som
//  bare finnes i emulatormodus (window.__pensumTest i js/data/store.js).
// ============================================================================
import { expect } from "@playwright/test";

export const LAERER = "eirik.sorbo@gmail.com";

export async function forbered(page, { rolle = "student" } = {}) {
  await page.addInitScript((r) => {
    try {
      localStorage.setItem("pensum-klasse", "2");
      if (r) localStorage.setItem("pensum-role", r);
      sessionStorage.setItem("pensum-emulator", "1");
    } catch (e) { /* lagringen er alltid tilgjengelig i testnettleseren */ }
  }, rolle);
  // Feil i konsollen og ufangede unntak samles, så testene kan kreve at det er tomt.
  const feil = [];
  page.on("pageerror", (e) => feil.push(String(e?.message || e)));
  page.on("console", (m) => { if (m.type() === "error") feil.push(m.text()); });
  return feil;
}

export async function apne(page, sti) {
  await page.goto(`${sti}${sti.includes("?") ? "&" : "?"}emulator=1`);
}

export async function loggInnSomLaerer(page) {
  await apne(page, "/teacher.html");
  await page.waitForFunction(() => !!window.__pensumTest);
  await page.evaluate((e) => window.__pensumTest.loggInn(e), LAERER);
  await expect(page.locator("body")).toHaveClass(/is-teacher/);
}

// Feil som ikke er appens: nettverksstøy fra ressurser utenfor testen.
export const appFeil = (feil) => feil.filter((f) => !/favicon|fonts\.g|Failed to load resource/i.test(f));

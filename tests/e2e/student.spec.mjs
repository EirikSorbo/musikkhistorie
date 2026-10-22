// ============================================================================
//  STUDENTENE (v7.13): forsiden, kortene og en innsending, mot emulatoren
// ============================================================================
import { test, expect } from "@playwright/test";
import { såFrø, lesSamling, rydd } from "./frø.mjs";
import { forbered, apne, appFeil } from "./hjelp.mjs";

test.beforeAll(async () => { await såFrø(); });
test.afterAll(async () => { await rydd(); });

test("forsiden laster pensumet fra emulatoren, uten feil", async ({ page }) => {
  const feil = await forbered(page);
  await apne(page, "/index.html");
  await expect(page.locator("body")).toHaveClass(/role-student/);
  await expect(page.locator("#dagens-artist")).toContainText(/Muddy Waters|Bessie Smith|Otis Redding/);
  await page.locator("#btn-artister").click();
  await page.locator("#sp-search").fill("Muddy");
  await expect(page.locator("#modal-artister")).toContainText("Muddy Waters");
  expect(appFeil(feil)).toEqual([]);
});

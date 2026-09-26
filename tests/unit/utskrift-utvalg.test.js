// Utvalget i nettleseren (js/utskrift-utvalg.js): «Ta med»-knappens tilstand
// og veksling. harMed må følge modellen (med = !bort.has): et valg som er
// huket av i panelet står IKKE i heftet, og veksle skal komme ut av «ute»
// igjen. Funnet i v5.69, da knappen kom på kortene i artistlistene: med
// valget sjekket før bortvalget sto knappen fast som «er med» etter «ta ut».
// Modulen leser localStorage og melder via document, så begge shimmes her,
// som i util.test.js.
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";

const lager = new Map();
globalThis.localStorage = {
  setItem: (k, v) => lager.set(k, String(v)),
  getItem: (k) => (lager.has(k) ? lager.get(k) : null),
  removeItem: (k) => lager.delete(k),
};
// documentElement: feature-flags.js (via modellens punkter-import) setter
// klasser på <html> når document finnes.
globalThis.document = {
  querySelectorAll: () => [],
  dispatchEvent: () => true,
  documentElement: { classList: { toggle() {} } },
};

const { harMed, veksle, leggTil, huk, lesUtvalg, toem, kortUtskriftHtml } =
  await import("../../js/utskrift-utvalg.js?v=5.70");

test("et valg som er huket av i panelet står ikke i heftet", () => {
  toem();
  leggTil("artist:a");
  assert.equal(harMed("artist:a"), true);
  huk("artist:a", false);
  const u = lesUtvalg();
  assert.ok(u.valg.includes("artist:a"), "valget blir stående (v5.59), så raden står igjen i lista");
  assert.ok(u.fravalg.includes("artist:a"));
  assert.equal(harMed("artist:a"), false, "bortvalget vinner over valget, som i modellen");
});

test("veksle går ut og inn igjen, og rydder bortvalget på vei inn", () => {
  toem();
  assert.equal(veksle("artist:a"), true, "første trykk legger til");
  assert.equal(harMed("artist:a"), true);
  assert.equal(veksle("artist:a"), false, "andre trykk tar ut");
  assert.equal(harMed("artist:a"), false);
  assert.equal(veksle("artist:a"), true, "tredje trykk tar inn igjen");
  assert.equal(harMed("artist:a"), true);
  assert.deepEqual(lesUtvalg().fravalg, [], "inn igjen opphever bortvalget");
});

test("kortUtskriftHtml speiler tilstanden og bare synlige artister får knapp", () => {
  toem();
  const a = { id: "a", name: "Ada <b>", status: "active" };
  const ute = kortUtskriftHtml(a);
  assert.match(ute, /class="kort-utskrift"/);
  assert.match(ute, /data-vis="artist:a"/);
  assert.match(ute, /aria-pressed="false"/);
  assert.match(ute, /data-navn="Ada &lt;b&gt;"/, "navnet escapes");
  leggTil("artist:a");
  const inne = kortUtskriftHtml(a);
  assert.match(inne, /class="kort-utskrift er-med"/);
  assert.match(inne, /aria-pressed="true"/);
  assert.equal(kortUtskriftHtml({ ...a, status: "removed" }), "", "skjulte artister kan ikke stå i heftet");
  assert.equal(kortUtskriftHtml(null), "");
  // Fotlinjeformen på de fulle kortene (v5.70): listeknappens klasser, samme
  // hook og tilstand.
  const fot = kortUtskriftHtml(a, { knapp: true });
  assert.match(fot, /class="btn ghost small utskrift-ikonknapp kort-utskrift er-med"/);
  assert.match(fot, /data-vis="artist:a"/);
});

// Utvalget i Referanser (v7.37, brukerbestilling 2026-11-17): en kilde vises
// bare når minst én tekst som bruker den, er synlig for studentene, og minst
// én er sjekket. De frittstående referansene vises alltid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { kildeUtvalg, samleKilder } from "../../js/felles/kilder.js";
import { lesJs } from "../helpers/js-filer.js";

const SNL = "https://snl.no/Muddy_Waters";
const sted = (id, synlig, sjekket) => ({ type: "artist", id, navn: id, synlig, sjekket });
const kilde = (opphav, url = SNL) => ({ text: "Store norske leksikon", url, opphav });

test("synlig og sjekket på samme tekst: vises", () => {
  const liste = [kilde(sted("a", true, true))];
  assert.equal(kildeUtvalg(liste).length, 1);
});

test("synlig, men ikke sjekket: vises ikke", () => {
  assert.equal(kildeUtvalg([kilde(sted("a", true, false))]).length, 0);
});

test("sjekket, men skjult for studentene: vises ikke", () => {
  assert.equal(kildeUtvalg([kilde(sted("a", false, true))]).length, 0);
});

test("de to kravene kan oppfylles av hver sin tekst, og hele raden blir med", () => {
  const liste = [kilde(sted("synlig", true, false)), kilde(sted("sjekket", false, true)), kilde(sted("ingen", false, false))];
  const ut = kildeUtvalg(liste);
  assert.equal(ut.length, 3, "alle stedene til raden følger med, så rettingen når dem");
  const rad = samleKilder(ut).seksjoner.flatMap((s) => [...s.rader, ...s.grupper.flatMap((g) => g.rader)])[0];
  assert.deepEqual(rad.opphav.map((o) => o.id), ["synlig", "sjekket", "ingen"]);
});

test("radene avgjøres hver for seg", () => {
  const liste = [kilde(sted("a", true, true)), kilde(sted("b", true, false), "https://snl.no/Annet")];
  const ut = kildeUtvalg(liste);
  assert.deepEqual(ut.map((k) => k.url), [SNL]);
});

test("en frittstående referanse vises alltid, og tar med seg kortene den også står på", () => {
  const liste = [kilde(null), kilde(sted("a", false, false))];
  assert.equal(kildeUtvalg(liste).length, 2);
});

test("tomme kilder og rare verdier tåles", () => {
  assert.deepEqual(kildeUtvalg(null), []);
  assert.deepEqual(kildeUtvalg([null, {}, { text: "" }]), []);
});

test("Referanser merker hvert sted og bruker utvalget; blyanten bare på lærersiden", () => {
  const ref = lesJs("explore-referanser.js");
  assert.match(ref, /const utvalg = kildeUtvalg\(ut\);/);
  for (const type of ["artist", "decade", "genre", "tech", "edge"]) {
    assert.match(ref, new RegExp(`type: "${type}"[\\s\\S]{0,200}?synlig:[\\s\\S]{0,120}?sjekket:`), `${type} har begge merkene`);
  }
  const rett = lesJs("referanse-retting.js");
  const fn = rett.match(/export const kanRetteKilder = \(\) => \{[\s\S]*?\n\};/)[0];
  assert.match(fn, /is-teacher/);
  assert.doesNotMatch(fn, /laerer-okt/);
  // Lærersiden får sjekkene inn i sjekket.js, ellers ville lista vært tom der.
  assert.match(lesJs("teacher.js"), /brukSjekker\(checks\)/);
});

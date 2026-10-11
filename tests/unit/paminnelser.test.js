// Påminnelser i en kjøreplan (v6.70, brukerbestilling 2026-10-11): rensing,
// lagring som tekst og når de forfaller.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rensPaminnelser, lesPaminnelser, skrivPaminnelser, paminnelseTid, forfalnePaminnelser,
  paminnelseEtikett, paminnelseNokkel, paminnelserForLange, PAMINNELSE_MAKS, PAMINNELSE_TEKST_MAKS,
} from "../../js/visning/presentasjon-modell.js";

test("rensPaminnelser: beholder gyldige, kaster tomme og ugyldige", () => {
  const ut = rensPaminnelser([
    { id: "a", type: "etter", min: "37", tekst: "  Pause  ", lerret: 1 },
    { id: "b", type: "klokka", kl: "10:15", tekst: "Nevn Miles Davis" },
    { id: "c", type: "etter", min: 5, tekst: "   " },
    { id: "d", type: "klokka", kl: "25:00", tekst: "feil klokke" },
    { id: "e", type: "etter", min: -3, tekst: "negativ" },
    { id: "a", type: "etter", min: 1, tekst: "samme id" },
    null,
  ]);
  assert.deepEqual(ut, [
    { id: "a", type: "etter", min: 37, tekst: "Pause", lerret: true },
    { id: "b", type: "klokka", kl: "10:15", tekst: "Nevn Miles Davis", lerret: false },
  ]);
  assert.equal(rensPaminnelser([{ id: "x", type: "etter", min: 1, tekst: "x".repeat(5000) }])[0].tekst.length, PAMINNELSE_TEKST_MAKS);
  assert.equal(rensPaminnelser(Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, type: "etter", min: i, tekst: "t" }))).length, PAMINNELSE_MAKS);
  assert.deepEqual(rensPaminnelser("ikke en liste"), []);
});

test("lagres som JSON-tekst i notatet; tom liste sletter", () => {
  const liste = [{ id: "a", type: "etter", min: 10, tekst: "Hei", lerret: false }];
  assert.deepEqual(lesPaminnelser(skrivPaminnelser(liste)), liste);
  assert.equal(skrivPaminnelser([]), "");
  assert.deepEqual(lesPaminnelser("{ødelagt"), []);
  assert.equal(paminnelseNokkel("plan-abc"), "paminnelser:plan-abc");
  // Reglene for notater tillater høyst 10 000 tegn: editoren må kunne si fra.
  const lag = (n, len) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, type: "etter", min: i, tekst: "x".repeat(len) }));
  assert.equal(paminnelserForLange(lag(10, 300)), false);
  assert.equal(paminnelserForLange(lag(PAMINNELSE_MAKS, PAMINNELSE_TEKST_MAKS)), true);
});

test("paminnelseTid: minutter etter start, og klokkeslett bare fra starten", () => {
  const start = new Date(2026, 9, 11, 10, 0).getTime();
  assert.equal(paminnelseTid({ type: "etter", min: 37 }, start), start + 37 * 60000);
  assert.equal(paminnelseTid({ type: "klokka", kl: "10:15" }, start), new Date(2026, 9, 11, 10, 15).getTime());
  assert.equal(paminnelseTid({ type: "klokka", kl: "09:45" }, start), null, "før starten: kommer ikke");
  assert.equal(paminnelseTid({ type: "klokka", kl: "10:00" }, start), start);
});

test("forfalnePaminnelser: bare forfalte og ikke viste, i tidsrekkefølge", () => {
  const start = new Date(2026, 9, 11, 10, 0).getTime();
  const liste = [
    { id: "sen", type: "etter", min: 50, tekst: "Sen" },
    { id: "kl", type: "klokka", kl: "10:20", tekst: "Klokka" },
    { id: "tidlig", type: "etter", min: 5, tekst: "Tidlig" },
  ];
  const kl1030 = new Date(2026, 9, 11, 10, 30).getTime();
  assert.deepEqual(forfalnePaminnelser(liste, start, kl1030).map((p) => p.id), ["tidlig", "kl"]);
  assert.deepEqual(forfalnePaminnelser(liste, start, kl1030, ["tidlig"]).map((p) => p.id), ["kl"]);
  assert.deepEqual(forfalnePaminnelser(liste, start, start).map((p) => p.id), []);
});

test("etiketten sier når påminnelsen kommer", () => {
  assert.equal(paminnelseEtikett({ type: "etter", min: 37 }), "37 min etter start");
  assert.equal(paminnelseEtikett({ type: "klokka", kl: "10:15" }), "Kl. 10.15");
});

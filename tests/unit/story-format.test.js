import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storyFor, pageFor, stripGenrePath, STORY_ORDER, STORY_SKJULT, storyOrder } from "../../js/story-format.js?v=4.80";
import { rebuild } from "../../js/genre-model.js?v=4.80";
import { SEED_DOC } from "../helpers/seed-model.js";

test("storyFor: null når ingen tekst er lagret (ingen fallback)", () => {
  assert.equal(storyFor("Blues", {}), null);
  assert.equal(storyFor("Blues", { Blues: {} }), null);
});

test("storyFor: lagret story-felt brukes", () => {
  const s = storyFor("Blues", { Blues: { story: { body: "Min egen bluestekst." } } });
  assert.equal(s.body, "Min egen bluestekst.");
});

test("storyFor: tom/whitespace-tekst regnes som manglende", () => {
  assert.equal(storyFor("Blues", { Blues: { story: { body: "   " } } }), null);
});

test("pageFor: samme regler for innholdssidene", () => {
  assert.equal(pageFor("omHistorie", {}), null);
  assert.equal(pageFor("omHistorie", { omHistorie: { body: " " } }), null);
  assert.equal(pageFor("omHistorie", { omHistorie: { body: "Tekst." } }).body, "Tekst.");
});

test("STORY_ORDER er de sju historiene i fast rekkefølge", () => {
  // Hip-hop kom til i v3.88 da den ble skilt ut som egen metasjanger fra R&B,
  // og står rett etter R&B fordi den leses i forlengelsen av soul og funk.
  assert.deepEqual(STORY_ORDER, ["Blues", "Country", "Gospel", "Jazz", "R&B", "Hip-hop", "Klubbmusikk"]);
});

// --- storyOrder: hvilke historie-knapper som faktisk vises ------------------

test("storyOrder viser den kuraterte lista, ikke de skjulte", () => {
  // Pop og Rock HAR historier i basen (brukervalg: de skal ligge, ikke vises).
  const descs = Object.fromEntries(
    [...STORY_ORDER, ...STORY_SKJULT].map((g) => [g, { story: { body: "tekst" } }]));
  const vist = storyOrder(descs);
  assert.deepEqual(vist, STORY_ORDER, "kun de kuraterte sju");
  for (const g of STORY_SKJULT) assert.ok(!vist.includes(g), `${g} skal ikke vises`);
  // Teksten skal fortsatt være LESBAR for den som slår opp direkte — det er
  // bare knappen som er borte, ikke dataene.
  assert.ok(storyFor("Pop", descs), "historien skal ligge urørt i basen");
});

test("storyOrder henter opp en historie som har fått nytt metasjanger-navn", () => {
  // Etter et navnebytte står historien på det NYE navnet, som ikke finnes i
  // den kuraterte lista. Uten dette ble den usynlig i huben.
  rebuild({
    ...SEED_DOC,
    nodes: SEED_DOC.nodes.map((n) => (n.g === "Blues" ? { ...n, g: "Bluesfamilien" } : n)),
    metaGenres: SEED_DOC.metaGenres.map((m) => (m.name === "Blues" ? { ...m, name: "Bluesfamilien" } : m)),
    metaOrderHint: SEED_DOC.metaOrderHint.map((h) => (h === "Blues" ? "Bluesfamilien" : h)),
  });
  const vist = storyOrder({ Bluesfamilien: { story: { body: "flyttet tekst" } } });
  assert.ok(vist.includes("Bluesfamilien"), "det nye navnet skal vises");
  assert.ok(!vist.includes("Blues"), "det gamle navnet er borte fra treet");
  rebuild(SEED_DOC);
});

// --- stripGenrePath: den håndskrevne løype-linjen erstattes av den genererte
//     sjangertidslinjen (buildGenreTimeline), og fjernes derfor ved rendring.
test("stripGenrePath fjerner HELE løype-linjen, ikke bare fram til kolonet", () => {
  // Regresjon: en lat kvantor stoppet på kolonet, så resten av løypen ble
  // stående igjen som brødtekst øverst i historien.
  const body = "*Sjangertre-løype: Work songs → Blues → Chicago blues*\n\n### Tittel\n\nTekst.";
  const ut = stripGenrePath(body);
  assert.ok(!ut.includes("Sjangertre"));
  assert.ok(!ut.includes("Work songs"));
  assert.equal(ut, "### Tittel\n\nTekst.");
});

test("stripGenrePath tåler variantene som finnes i innholdet", () => {
  for (const linje of [
    "*Sjangertre-løype: Spirituals → Gospel*",
    "Sjangertre-loype: Reggae → Disco",          // uten kursiv, o for ø
    "  *Sjangertre-løype : R&B → Soul*",         // innrykk og mellomrom før kolon
  ]) {
    assert.equal(stripGenrePath(linje + "\n\nBrødtekst."), "Brødtekst.", linje);
  }
});

test("stripGenrePath rører ikke en historie uten løype-linje", () => {
  const uten = "### Rett på sak\n\nTekst.";
  assert.equal(stripGenrePath(uten), uten);
  assert.equal(stripGenrePath(""), "");
  assert.equal(stripGenrePath(undefined), undefined);
});

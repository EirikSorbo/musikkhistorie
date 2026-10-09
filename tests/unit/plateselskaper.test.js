// Plateselskapene (v6.37, brukervalg 2026-10-04): tretten kort, koblet til
// artistenes plateselskapsfelt. Treffet må være eksakt per del av feltet, så
// «Sun» aldri treffer «Sunset» og «RCA» aldri «RCA Camden», og alle
// skrivemåtene i dataene («RCA Victor», «Volt», «Decca Records») må finne
// riktig kort.
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PLATESELSKAPER, finnPlateselskap, selskaperIFelt, delSelskapsfelt, artisterForSelskap,
  selskaperSortert, grunnlagtAar, rensFakta, plateselskapSideId, plateselskapForSide,
} from "../../js/felles/plateselskaper.js";
import { byggIndeks } from "../../js/felles/search.js";
import { VIS_TYPER } from "../../js/felles/vis-lenke.js";
import { TYPE_NAVN } from "../../js/visning/stopp-etikett.js";
import { lesJs } from "../helpers/js-filer.js";

const id = (navn) => finnPlateselskap(navn)?.id ?? null;

test("de tretten selskapene brukeren valgte, hver med unik id", () => {
  assert.deepEqual(PLATESELSKAPER.map((p) => p.id).sort(), [
    "atlantic", "blue-note", "chess", "columbia", "decca", "ecm", "motown",
    "paramount", "philadelphia-international", "savoy", "stax", "sun", "victor",
  ]);
});

test("ingen skrivemåte peker på to selskaper", () => {
  const sett = new Map();
  for (const p of PLATESELSKAPER) for (const a of p.aliaser) {
    const k = a.toLowerCase();
    assert.ok(!sett.has(k), `«${a}» står både på ${sett.get(k)} og ${p.id}`);
    sett.set(k, p.id);
  }
});

test("skrivemåtene i artistdataene finner riktig kort", () => {
  assert.equal(id("Victor"), "victor");
  assert.equal(id("RCA Victor"), "victor");
  assert.equal(id("RCA"), "victor");
  assert.equal(id("Bluebird"), "victor");
  assert.equal(id("Volt"), "stax");
  assert.equal(id("Tamla"), "motown");
  assert.equal(id("Decca Records"), "decca");
  assert.equal(id("Blue Note Records"), "blue-note");
  assert.equal(id("  chess  "), "chess");
  assert.equal(id("Philadelphia International Records"), "philadelphia-international");
  assert.equal(id("Sun Records"), "sun");
});

test("ingen falske treff på navn som bare ligner", () => {
  for (const navn of ["Sunset", "RCA Camden", "Columbia Pictures", "Atlantic Starr", "Chess Mate", "Motown Junction", ""]) {
    assert.equal(id(navn), null, navn);
  }
});

test("feltet deles på skråstrek og semikolon, ikke på komma", () => {
  assert.deepEqual(delSelskapsfelt("Columbia / Atlantic"), ["Columbia", "Atlantic"]);
  assert.deepEqual(delSelskapsfelt("Stax; Volt"), ["Stax", "Volt"]);
  assert.deepEqual(delSelskapsfelt("Brunswick, Vocalion"), ["Brunswick, Vocalion"]);
  const deler = selskaperIFelt("Okeh / Columbia");
  assert.equal(deler[0].selskap, null);
  assert.equal(deler[1].selskap.id, "columbia");
});

test("artisterForSelskap finner artisten uansett hvilken del av feltet selskapet står i", () => {
  const artister = [
    { id: "1", recordLabel: "Okeh / Columbia" },
    { id: "2", recordLabel: "RCA Victor" },
    { id: "3", recordLabel: "Sunset" },
    { id: "4", recordLabel: "Sun" },
    { id: "5" },
  ];
  assert.deepEqual(artisterForSelskap(artister, "columbia").map((a) => a.id), ["1"]);
  assert.deepEqual(artisterForSelskap(artister, "victor").map((a) => a.id), ["2"]);
  assert.deepEqual(artisterForSelskap(artister, "sun").map((a) => a.id), ["4"]);
});

test("sideId går begge veier, og ukjente sider gir null", () => {
  assert.equal(plateselskapSideId("stax"), "plateselskap-stax");
  assert.equal(plateselskapForSide("plateselskap-stax").id, "stax");
  assert.equal(plateselskapForSide("plateselskap-ukjent"), null);
  assert.equal(plateselskapForSide("instrument-gitar"), null);
});

test("rekkefølgen følger grunnleggelsesåret, og selskaper uten år kommer sist i listas rekkefølge", () => {
  const sider = { sun: { fakta: { grunnlagt: "1952" } }, stax: { fakta: { grunnlagt: 1957 } }, ecm: { fakta: { grunnlagt: "ca. 1969" } } };
  const rekke = selskaperSortert((id) => sider[id] || null).map((p) => p.id);
  assert.deepEqual(rekke.slice(0, 3), ["sun", "stax", "ecm"]);
  assert.equal(rekke[3], "columbia", "resten i listas rekkefølge");
  assert.equal(grunnlagtAar({ fakta: { grunnlagt: "ukjent" } }), null);
});

test("rensFakta beholder bare kjente felt med innhold", () => {
  assert.deepEqual(rensFakta({ grunnlagt: 1957, sted: "  Memphis ", ukjent: "x", virketid: "" }), { grunnlagt: "1957", sted: "Memphis" });
  assert.equal(rensFakta({ sted: "  " }), null);
  assert.equal(rensFakta(null), null);
  assert.equal(rensFakta("tekst"), null);
});

test("søket: alle tretten for læreren, ingen for studentene mens hubkortet er skjult", () => {
  const state = { content: { "plateselskap-stax": { body: "Soul fra Memphis.", fakta: { sted: "Memphis" } } } };
  const laerer = byggIndeks(state, { erLærer: true, skjulHub: { "sb-plateselskaper": true } }).filter((p) => p.type === "plateselskap");
  assert.equal(laerer.length, 13);
  const stax = laerer.find((p) => p.id === "stax");
  assert.deepEqual(stax.apne, { hva: "plateselskap", id: "stax" });
  assert.match(stax.tekst, /Volt/);
  assert.match(stax.tekst, /Memphis/);
  assert.equal(byggIndeks(state, { skjulHub: { "sb-plateselskaper": true } }).filter((p) => p.type === "plateselskap").length, 0);
  assert.equal(byggIndeks(state, { skjulHub: { "sb-plateselskaper": false } }).filter((p) => p.type === "plateselskap").length, 13);
});

test("lenkene og kjøreplanene kjenner plateselskapene", () => {
  assert.ok(VIS_TYPER.has("plateselskap") && VIS_TYPER.has("plateselskaper"));
  assert.equal(TYPE_NAVN.plateselskap, "Plateselskap");
  assert.equal(TYPE_NAVN.lytt, "Spillelister", "Lytt heter Spillelister fra v6.31");
  const apne = lesJs("explore-apne.js");
  assert.match(apne, /case "plateselskap": return openPlateselskap\(apne\.id\)/);
  assert.match(apne, /case "plateselskap": case "plateselskaper":/);
});

test("koblingen i appen: modalene, hubkortet, artistlenken og omtegningen", () => {
  const explore = lesJs("utforsk/explore.js");
  assert.match(explore, /"modal-plateselskaper", "modal-plateselskap"\]/);
  assert.match(explore, /paaKort\("sb-plateselskaper", openPlateselskaper\)/);
  assert.match(explore, /closest\("\[data-plateselskap\]"\)/);
  assert.match(explore, /renderPlateselskaper\(\);\n\}/, "contentChanged tegner åpne plateselskapskort");
  const helpers = lesJs("ui-helpers.js");
  assert.match(helpers, /\["Plateselskap", a\.recordLabel, \{ html: plateselskapHtml\(a\.recordLabel\) \}\]/);
  assert.match(helpers, /if \(!plateselskapeneSynlige\(\)\) return escapeHtml\(felt\);/, "skjult for studentene: ren tekst");
  for (const side of ["landing.js", "teacher.js", "tre-page.js"]) {
    assert.match(lesJs(side), /renderPlateselskaper\?\.\(\)/, `${side} tegner kortet når artistene endres`);
  }
});

test("lærersiden: faktafeltene lagres og importeres, og Oversikten har seksjonen", () => {
  const html = readFileSync(new URL("../../teacher.html", import.meta.url), "utf8");
  assert.match(html, /id="se-fakta-wrap"/);
  const innhold = lesJs("teacher-content.js");
  assert.match(innhold, /if \(fakta\) data\.fakta = fakta;/, "savePage skriver hele dokumentet, så faktaene må med");
  assert.match(innhold, /if \(harKildefelt\(editorTarget\)\) data\.kilder = collectRows/);
  assert.match(lesJs("teacher-import.js"), /const fakta = rensFakta\(d\.fakta\);\n\s+if \(fakta\) data\.fakta = fakta;/);
  const dash = lesJs("ui-dashboard.js");
  // v6.66: plateselskapene er ett av punktene i Mangler-vinduet, ikke en egen seksjon.
  assert.match(dash, /data-ov-toggle="ov-x-plateselskaper"/);
  assert.match(html, /id="modal-mangler"[\s\S]*id="mangler-body"/);
  assert.match(dash, /onPlateselskapCheck\?\.\(id, toggleCheckBtn\(chk, "tcr-check"\)\)/);
  assert.match(lesJs("teacher-artists.js"), /setContentCheck\("plateselskaper", id, on\)/);
});

test("selskapsnavn blir lenker bare i selskapskortene, og aldri kortets eget", async () => {
  const { linkifyAll, medSelv } = await import("../../js/felles/linkify.js");
  const ctx = medSelv({ plateselskaper: PLATESELSKAPER }, { plateselskap: "chess" });
  const ut = linkifyAll("Phillips startet Sun, og Chess ga ut opptaket.", ctx);
  assert.match(ut, /<a class="plateselskap-link" data-ps-lenke="sun"[^>]*>Sun<\/a>/);
  assert.doesNotMatch(ut, /data-ps-lenke="chess"/, "kortets eget navn lenkes ikke");
  assert.doesNotMatch(linkifyAll("Harold Melvin & the Blue Notes", ctx), /plateselskap-link/, "ingen genitiv-s på selskapsnavn");
  assert.match(linkifyAll("Elvis gikk til RCA Victor.", ctx), /data-ps-lenke="victor"[^>]*>RCA Victor</, "lengste navn vinner");
  assert.doesNotMatch(linkifyAll("House of the Rising Sun", {}), /plateselskap-link/, "uten selskapene i konteksten: ingen lenker");
});

test("standardnavnene er kortenes titler", () => {
  assert.equal(PLATESELSKAPER.find((p) => p.id === "victor").navn, "RCA Victor");
  for (const p of PLATESELSKAPER) assert.ok(p.aliaser.includes(p.navn), `${p.id}: standardnavnet skal også treffe`);
});

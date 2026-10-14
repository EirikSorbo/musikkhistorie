// «Slik bruker du appen» i deler (v6.95, brukervalg 2026-10-13): hver
// ###-overskrift kan vises for studentene for seg; en ny del er skjult til
// læreren huker den av, og innledningen vises alltid.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { guideDeler, guideTitler, guideForStudent } from "../../js/felles/guide-deler.js";
import { synlighetVerdier } from "../../js/felles/feature-flags.js";
import { byggIndeks } from "../../js/felles/search.js";

const GUIDE = [
  "Dette er et levende pensum.",
  "",
  "### Begynn på forsiden",
  "Hvert kort er en inngang.",
  "",
  "### Repeter smart",
  "Bruk spillelistene.",
  "",
  "### Dagens artist",
  "Én ny hver gang.",
  "",
  "Tanken bak: start med helheten.",
].join("\n");

test("teksten deles ved ###-overskriftene, og innledningen står for seg", () => {
  const { innledning, deler } = guideDeler(GUIDE);
  assert.equal(innledning, "Dette er et levende pensum.");
  assert.deepEqual(deler.map((d) => d.tittel), ["Begynn på forsiden", "Repeter smart", "Dagens artist"]);
  assert.match(deler[2].tekst, /^### Dagens artist\nÉn ny hver gang\.\n\nTanken bak/, "teksten etter siste overskrift hører til den");
  assert.deepEqual(guideTitler(""), []);
});

test("studentene får innledningen og bare de avhukede delene, i tekstens rekkefølge", () => {
  const synlige = new Set(["Dagens artist", "Begynn på forsiden"]);
  const ut = guideForStudent(GUIDE, (t) => synlige.has(t));
  assert.match(ut, /^Dette er et levende pensum\.\n\n### Begynn på forsiden/);
  assert.doesNotMatch(ut, /Repeter smart/);
  assert.match(ut, /### Dagens artist/);
  assert.equal(guideForStudent(GUIDE, () => false), "Dette er et levende pensum.", "ingen avhuket: bare innledningen");
});

test("synligheten lagrer lista over synlige deler, og standarden er ingen", () => {
  assert.deepEqual(synlighetVerdier(null).guide, []);
  assert.deepEqual(synlighetVerdier({ guide: ["Repeter smart", 3, ""] }).guide, ["Repeter smart"]);
  assert.deepEqual(synlighetVerdier({ guide: "tull" }).guide, []);
});

test("søket: studentene finner bare de synlige delene, læreren alt", () => {
  const state = { artists: [], content: { appGuide: { body: GUIDE } } };
  const tekst = (erLærer) => JSON.stringify(byggIndeks(state, { erLærer, skjul: {}, skjulHub: {} }).filter((p) => p.id === "appGuide"));
  assert.doesNotMatch(tekst(false), /spillelistene/, "standarden er at ingen del er synlig");
  assert.match(tekst(false), /levende pensum/, "innledningen er med");
  assert.match(tekst(true), /spillelistene/);
});

test("Skrivebordet lagrer delene sammen med resten, og guiden har ingen Sjekk", () => {
  const desk = fs.readFileSync(new URL("../../js/laerer/teacher-desk.js", import.meta.url), "utf8");
  assert.match(desk, /punkter: v\.punkter,\n\s+guide: v\.guide,/, "savePage overskriver dokumentet, så guide må med i hver lagring");
  assert.match(desk, /data-guide-del="\$\{escapeHtml\(t\)\}"/);
  const innhold = fs.readFileSync(new URL("../../js/utforsk/explore-innhold.js", import.meta.url), "utf8");
  assert.match(innhold, /sjekk: !USJEKKEDE_SIDER\.includes\(pageId\)/);
});

// v7.02 (brukerønske 2026-10-14): delene ligger i en nedtrekk, lukket som
// standard, så 27 avhukinger ikke tar hele panelet. Åpen/lukket overlever
// omtegningen av Skrivebordet.
test("delene ligger i en lukket nedtrekk som husker om den er åpen", () => {
  const desk = fs.readFileSync(new URL("../../js/laerer/teacher-desk.js", import.meta.url), "utf8");
  assert.match(desk, /<details class="desk-guide-deler"\$\{openPanels\.has\("guide"\) \? " open" : ""\}>/);
  assert.match(desk, /<summary>Delene: \$\{synlige\} av \$\{titler\.length\} synlige<\/summary>/);
  assert.match(desk, /hit\("\.desk-guide-deler > summary"\)/);
  assert.match(desk, /openPanels\.add\("guide"\) : openPanels\.delete\("guide"\)/);
});

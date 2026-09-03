import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDesc, resolveDescAny, missingDesc } from "../../js/genre-descriptions.js?v=5.09";
import { resolveMainDesc } from "../../js/genealogy.js?v=5.09";
import { GENEALOGY } from "../../js/genre-model.js?v=5.09";

const descs = {
  Blues: {
    meta: { description: "meta-tekst", kilder: [{ text: "k1" }] },
    main: { description: "main-tekst" },
  },
};

test("resolveDesc leser KUN sitt eget nivå (ingen fallback)", () => {
  assert.equal(resolveDesc(descs, "Blues", "meta").description, "meta-tekst");
  assert.equal(resolveDesc(descs, "Blues", "main").description, "main-tekst");
  assert.equal(resolveDesc(descs, "Blues", "sub").description, "");
});

test("resolveDescAny prøver navnene i rekkefølge", () => {
  assert.equal(resolveDescAny(descs, ["Finnes ikke", "Blues"], "main").description, "main-tekst");
  assert.equal(resolveDescAny(descs, ["Finnes ikke"], "main").description, "");
});

test("missingDesc navngir nivået", () => {
  assert.ok(missingDesc("meta").includes("metasjanger"));
  assert.ok(missingDesc("main").includes("sjanger"));
  assert.ok(missingDesc("sub").includes("undersjanger"));
});

// resolveMainDesc er DELT av sjanger-popupen (genealogy.js showSjangerInfo) og
// lærerens editor (teacher-content.js). Testene under låser den delingen: leser
// de to ulikt, åpner editoren tom over en tekst som vises i popupen, og lagring
// lager et duplikat-dokument under labelen.
test("resolveMainDesc finner tekst lagret under nodens FULLE navn", () => {
  // Testen sto på Country/«Country (hillbilly)» til v4.38, da noden ble døpt om
  // til Hillbilly og fikk likt kort- og fullnavn. Den trenger et par der de to
  // FAKTISK er ulike, ellers prøver den ingenting: Outlaw/«Outlaw country».
  const d = { "Outlaw country": { main: { description: "under fullnavn" } } };
  // Eksakt oppslag på labelen ville vært tomt — det er nettopp fella:
  assert.equal(resolveDesc(d, "Outlaw", "main").description, "");
  assert.equal(resolveMainDesc(d, "Outlaw").description, "under fullnavn");
});

test("resolveMainDesc lar labelen (doc-ID-en) vinne over fullnavnet", () => {
  const d = {
    "Cont. country": { main: { description: "kanonisk" } },
    "Contemporary country": { main: { description: "skygge" } },
  };
  assert.equal(resolveMainDesc(d, "Cont. country").description, "kanonisk");
});

test("resolveMainDesc: ukjent navn (ingen tre-node) faller tilbake til eksakt oppslag", () => {
  const d = { "Delta blues": { main: { description: "fri sjanger" } } };
  assert.equal(resolveMainDesc(d, "Delta blues").description, "fri sjanger");
  assert.equal(resolveMainDesc(d, "Finnes ikke").description, "");
});

test("resolveMainDesc treffer likt for label og fullt navn på alle tre-noder", () => {
  for (const n of GENEALOGY) {
    const d = { [n.f]: { main: { description: `X ${n.f}` } } };
    assert.equal(resolveMainDesc(d, n.l).description, `X ${n.f}`, `label-oppslag feilet for ${n.l}`);
    assert.equal(resolveMainDesc(d, n.f).description, `X ${n.f}`, `fullnavn-oppslag feilet for ${n.f}`);
  }
});

// --- Epoke (activeFrom/activeTo) --------------------------------------------
// Årstallene er sannheten for sjangerens mest aktive periode; nodens era-streng
// i koden er kun fallback til sjangeren er gjennomgått.

const epoke = {
  Swing: { main: { description: "swing-tekst", activeFrom: 1935, activeTo: 1945 } },
  Pop: { main: { description: "pop-tekst", activeFrom: 1950 } },
  Trap: { main: { activeFrom: 2010 } },           // årstall, men ingen tekst ennå
  Nulltest: { main: { description: "t", activeFrom: 0, activeTo: "1980" } },
};

test("resolveDesc tar med epoke-årstallene", () => {
  const r = resolveDesc(epoke, "Swing", "main");
  assert.equal(r.activeFrom, 1935);
  assert.equal(r.activeTo, 1945);
});

test("mangler epoke gir null, ikke undefined eller 0", () => {
  const r = resolveDesc(epoke, "Pop", "main");
  assert.equal(r.activeFrom, 1950);
  assert.equal(r.activeTo, null);
  const tom = resolveDesc(epoke, "Finnes ikke", "main");
  assert.equal(tom.activeFrom, null);
  assert.equal(tom.activeTo, null);
});

test("årstall uten beskrivelse gir fortsatt treff (epoken skal vises)", () => {
  const r = resolveDesc(epoke, "Trap", "main");
  assert.equal(r.activeFrom, 2010);
  assert.equal(r.description, "");
});

test("ugyldige årstall forkastes: 0 og streng er ikke årstall", () => {
  const r = resolveDesc(epoke, "Nulltest", "main");
  assert.equal(r.activeFrom, null, "0 skal ikke bli år 0");
  assert.equal(r.activeTo, null, "streng skal ikke godtas som årstall");
});

test("eraText: årstall vinner, tomt sluttår blir «i dag», ellers fritekst-epoken", async () => {
  const { eraText } = await import("../../js/genealogy.js?v=5.09");
  // Alt leses nå fra ÉN kilde (genreDescriptions). Fram til v4.64 kom friteksten
  // fra treets node, og da kunne kortet og tidslinjen vise ulik epoke.
  // «ca.» står én gang og gjelder hele perioden (v4.86) — aldri foran «i dag».
  assert.equal(eraText({ activeFrom: 1935, activeTo: 1945, era: "1930–45" }), "ca. 1935–1945");
  assert.equal(eraText({ activeFrom: 1990, activeTo: null, era: "1990-tallet" }), "ca. 1990–i dag");
  assert.equal(eraText({ activeFrom: null, activeTo: null, era: "1930–45" }), "1930–45");
  assert.equal(eraText({ era: "" }), "");
  assert.equal(eraText(undefined), "");
});

test("eraLine: sjangerkortet viser årstallene OG epoke-friteksten", async () => {
  const { eraLine } = await import("../../js/genealogy.js?v=5.09");
  // Friteksten er ikke fallback her — den står som egen setning etter årstallene.
  assert.equal(
    eraLine({ activeFrom: 1945, activeTo: 1960, era: "midten av 1940-tallet" }),
    "ca. 1945–1960. midten av 1940-tallet"
  );
  assert.equal(eraLine({ activeFrom: 1990, activeTo: null, era: "1990-tallet" }), "ca. 1990–i dag. 1990-tallet");
  // Bare den ene halvparten: ingen løs punktum, ingen tom setning.
  assert.equal(eraLine({ activeFrom: 1980, activeTo: 1989, era: "" }), "ca. 1980–1989");
  assert.equal(eraLine({ activeFrom: null, activeTo: null, era: "1930–45" }), "1930–45");
  assert.equal(eraLine({ era: "   " }), "");
  assert.equal(eraLine(undefined), "");
});

test("resolveDesc tar med epoke-fritekst og lytteforslag", () => {
  const d = { Blues: { main: { description: "x", era: "ca. 1900", lytt: ["Cross Road Blues", ""] } } };
  const r = resolveDesc(d, "Blues", "main");
  assert.equal(r.era, "ca. 1900");
  assert.deepEqual(r.lytt, ["Cross Road Blues"], "tomme linjer lukes bort");
});

test("epoke eller lytteforslag ALENE gir treff — de fire rot-nodene har ikke prosa", () => {
  // Europeisk, Vestafrikansk, Work songs og Spirituals hadde ingen beskrivelse
  // da era/lytt ble flyttet inn. Uten dette ville nettopp de blitt usynlige.
  const bare = { "Work songs": { main: { era: "1800-tallet" } } };
  assert.equal(resolveDesc(bare, "Work songs", "main").era, "1800-tallet");
  const bareLytt = { X: { main: { lytt: ["Noe"] } } };
  assert.deepEqual(resolveDesc(bareLytt, "X", "main").lytt, ["Noe"]);
  // Men et helt tomt nivå er fortsatt ingenting.
  assert.equal(resolveDesc({ Y: { main: { era: "  ", lytt: [] } } }, "Y", "main").era, "");
});

test("usikre påstander følger med, og er alltid en liste", () => {
  const d = {
    A: { main: { description: "t", usikre: [{ tekst: "x", hvorfor: "y", hvorSjekke: "z" }] } },
    B: { main: { description: "t" } },
    C: { main: { description: "t", usikre: "ikke en liste" } },
  };
  assert.equal(resolveDesc(d, "A", "main").usikre.length, 1);
  assert.deepEqual(resolveDesc(d, "B", "main").usikre, []);
  assert.deepEqual(resolveDesc(d, "C", "main").usikre, [], "ugyldig form skal bli tom liste, ikke krasje");
  assert.deepEqual(resolveDesc(d, "Finnes ikke", "main").usikre, []);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDesc, resolveDescAny, missingDesc } from "../../js/genre-descriptions.js?v=4.41";
import { GENEALOGY, resolveMainDesc } from "../../js/genealogy.js?v=4.41";

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

test("eraText: Firestore-årstall vinner, tomt sluttår blir «i dag», ellers node-fallback", async () => {
  const { eraText } = await import("../../js/genealogy.js?v=4.41");
  const node = { era: "1930–45" };
  assert.equal(eraText(node, { activeFrom: 1935, activeTo: 1945 }), "1935–1945");
  assert.equal(eraText(node, { activeFrom: 1990, activeTo: null }), "1990–i dag");
  assert.equal(eraText(node, { activeFrom: null, activeTo: null }), "1930–45");
  assert.equal(eraText({ era: "" }, {}), "");
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

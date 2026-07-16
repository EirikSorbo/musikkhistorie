import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDesc, resolveDescAny, missingDesc } from "../../js/genre-descriptions.js?v=3.60";
import { GENEALOGY, resolveMainDesc } from "../../js/genealogy.js?v=3.60";

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
  assert.ok(missingDesc("meta").includes("hovedsjanger"));
  assert.ok(missingDesc("main").includes("sjanger"));
  assert.ok(missingDesc("sub").includes("undersjanger"));
});

// resolveMainDesc er DELT av sjanger-popupen (genealogy.js showSjangerInfo) og
// lærerens editor (teacher-content.js). Testene under låser den delingen: leser
// de to ulikt, åpner editoren tom over en tekst som vises i popupen, og lagring
// lager et duplikat-dokument under labelen.
test("resolveMainDesc finner tekst lagret under nodens FULLE navn", () => {
  const d = { "Country (hillbilly)": { main: { description: "under fullnavn" } } };
  // Eksakt oppslag på labelen ville vært tomt — det er nettopp fella:
  assert.equal(resolveDesc(d, "Country", "main").description, "");
  assert.equal(resolveMainDesc(d, "Country").description, "under fullnavn");
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

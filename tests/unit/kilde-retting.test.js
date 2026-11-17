// Retting av kilder fra Referanser (v7.35, brukerbestilling 2026-11-17): én rad
// i Referanser er den samme kilden på ett eller flere kort, og rettingen eller
// slettingen gjelder alle stedene den står, i én batch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { samleKilder, kildeRadNokkel } from "../../js/felles/kilder.js";
import { kildeSteder, kildeEndringer, rettKildeliste, forsteKilde, stedNavn, erSammeKilde } from "../../js/felles/kilde-retting.js";
import { lesJs } from "../helpers/js-filer.js";

const SNL = "https://snl.no/Muddy_Waters";
const BOK = { text: "Deep Blues", forfatter: "Robert Palmer", year: 1981, kategori: "Bøker" };
const STATE = {
  artists: [
    { id: "muddy", name: "Muddy Waters", status: "active", kilder: [{ text: "Store norske leksikon.", url: SNL }, BOK] },
    { id: "wolf", name: "Howlin' Wolf", status: "active", kilder: [{ text: "SNL", url: SNL }, { text: "Annet", url: "https://snl.no/Howlin_Wolf" }] },
  ],
  decadeDescs: { 1950: { kilder: [{ text: "deep blues", kategori: "Bøker" }] } },
  genreDescs: { "Electric blues": { main: { description: "Tekst", kilder: [BOK] }, meta: { kilder: [] } } },
  techItems: [{ id: "t1", name: "Elgitar", kilder: [{ text: "Store norske leksikon.", url: SNL }] }],
  edgeDescs: { "a__b": { kilder: [BOK] } },
  content: { referanser: { kilder: [BOK] } },
};

// Kildene slik Referanser samler dem (samme opphav som explore-referanser.js).
function alle() {
  const ut = [];
  const legg = (arr, opphav) => (arr || []).forEach((k) => ut.push({ ...k, opphav }));
  for (const a of STATE.artists) legg(a.kilder, { type: "artist", id: a.id, navn: a.name });
  legg(STATE.decadeDescs[1950].kilder, { type: "decade", id: "1950", navn: "1950-tallet" });
  legg(STATE.genreDescs["Electric blues"].main.kilder, { type: "genre", id: "Electric blues", navn: "Electric blues", niva: "main" });
  legg(STATE.techItems[0].kilder, { type: "tech", id: "t1", navn: "Elgitar" });
  legg(STATE.edgeDescs.a__b.kilder, { type: "edge", id: "a__b", navn: "Blues → R&B" });
  legg(STATE.content.referanser.kilder, null);
  return ut;
}
const rader = () => samleKilder(alle()).seksjoner.flatMap((s) => [...s.rader, ...s.grupper.flatMap((g) => g.rader)]);
const radFor = (pred) => rader().find(pred);

test("raden kjenner sin egen identitet og om den står blant de frittstående", () => {
  const snl = radFor((r) => r.url === SNL);
  assert.equal(snl.nokkel, SNL);
  assert.equal(snl.kategori, "Nettsteder");
  assert.equal(snl.frittstaende, false);
  assert.deepEqual(kildeSteder(snl).map((s) => `${s.type}:${s.id}`), ["artist:muddy", "artist:wolf", "tech:t1"]);
  const bok = radFor((r) => r.nokkel === "deep blues");
  assert.equal(bok.frittstaende, true);
  assert.deepEqual(kildeSteder(bok).map((s) => `${s.type}:${s.id}`), ["artist:muddy", "decade:1950", "genre:Electric blues", "edge:a__b", "fri:referanser"]);
  assert.deepEqual(kildeRadNokkel({ text: "  Deep Blues " , kategori: "Bøker" }), { kategori: "Bøker", nokkel: "deep blues" });
  assert.equal(kildeRadNokkel({ text: "" }), null);
});

test("retting: ny kilde på alle stedene, én batch, og sjangernivået som nestet felt", () => {
  const bok = radFor((r) => r.nokkel === "deep blues");
  const ny = { text: "Deep Blues: A Musical and Cultural History", forfatter: "Robert Palmer", year: 1981, url: "", kategori: "Bøker" };
  const ops = kildeEndringer(STATE, bok, ny);
  assert.deepEqual(ops.map((o) => `${o.coll}/${o.id}`), ["artists/muddy", "decades/1950", "genreDescriptions/Electric blues", "edgeDescriptions/a__b", "content/referanser"]);
  assert.ok(ops.every((o) => o.type === "doc.merge"));
  assert.deepEqual(ops[0].data, { kilder: [{ text: "Store norske leksikon.", url: SNL }, ny] }, "de andre kildene står, i samme rekkefølge");
  assert.deepEqual(ops[2].data, { main: { kilder: [ny] } }, "bare kildene på nivået, merge rører ikke beskrivelsen");
  assert.equal(STATE.artists[0].kilder[1], BOK, "tilstanden er ikke endret");
});

test("sletting fjerner kilden overalt, og et kort med kilden to ganger får den én gang", () => {
  const snl = radFor((r) => r.url === SNL);
  const ops = kildeEndringer(STATE, snl, null);
  assert.deepEqual(ops.map((o) => `${o.coll}/${o.id}`), ["artists/muddy", "artists/wolf", "tech/t1"]);
  assert.deepEqual(ops[1].data.kilder, [{ text: "Annet", url: "https://snl.no/Howlin_Wolf" }]);
  const dobbel = [{ text: "A", url: SNL }, { text: "B", url: SNL }, { text: "C" }];
  assert.deepEqual(rettKildeliste(dobbel, snl, { text: "Ny", url: SNL }), [{ text: "Ny", url: SNL }, { text: "C" }]);
  assert.equal(rettKildeliste([{ text: "C" }], snl, null), null, "ingen treff, ingen skriving");
  assert.equal(rettKildeliste(undefined, snl, null), null);
});

test("samme lenke i en annen kategori er en annen rad og røres ikke", () => {
  const snl = radFor((r) => r.url === SNL);
  assert.ok(!erSammeKilde({ text: "x", url: SNL, kategori: "Videoer" }, snl));
  assert.ok(erSammeKilde({ text: "x", url: SNL }, snl));
});

test("skjemaet fylles med den første kilden, og stedene får lesbare navn", () => {
  const bok = radFor((r) => r.nokkel === "deep blues");
  assert.deepEqual(forsteKilde(STATE, bok), BOK);
  assert.equal(stedNavn({ type: "genre", id: "Blues", navn: "Blues", niva: "meta" }), "Blues (sjangerhistorien)");
  assert.equal(stedNavn({ type: "edge", id: "a__b", navn: "Blues → R&B" }), "Blues → R&B (kobling)");
  assert.equal(stedNavn({ type: "artist", id: "x", navn: "Muddy Waters" }), "Muddy Waters");
});

test("blyanten: bare for læreren på lærersiden, på hver rad, og lista beholder plassen etter lagring", () => {
  const r = lesJs("explore-referanser.js");
  assert.match(r, /if \(kanRetteKilder\(\)\) \{\s*vei \+= `<button type="button" class="ref-kort ref-rett"/);
  assert.match(r, /apneKildeRetting\(rad, \{ etterLagring: \(\) => renderReferanser\(\{ bevar: true \}\) \}\);/);
  assert.ok(!r.includes("onReferanseEdit"), "den gamle Rediger-knappen for de frittstående er erstattet");
  const v = lesJs("referanse-retting.js");
  assert.match(v, /document\.body\.classList\.contains\("is-teacher"\)/, "bare lærersiden (v7.37)");
  assert.match(v, /await runMigrationPlan\(ops\);/, "én atomisk batch");
  assert.match(v, /farlig: true/, "slettingen spør med rød knapp");
});

// Ny referanse fra Referanser (v7.38): legges sist blant de frittstående.
test("ny referanse: legges sist i content/referanser, men ikke to ganger", async () => {
  const { nyReferanseEndring } = await import("../../js/felles/kilde-retting.js");
  const ny = { text: "The Land Where the Blues Began", forfatter: "Alan Lomax", year: 1993, url: "", kategori: "Bøker" };
  const { ops } = nyReferanseEndring(STATE, ny);
  assert.deepEqual(ops, [{ type: "doc.merge", coll: "content", id: "referanser", data: { kilder: [BOK, ny] } }]);
  assert.deepEqual(nyReferanseEndring(STATE, { ...BOK, text: "DEEP BLUES" }), { feil: "finnes" }, "samme tekst i samme kategori");
  assert.deepEqual(nyReferanseEndring(STATE, { text: "", url: "" }), { feil: "tom" });
  assert.equal(nyReferanseEndring({}, ny).ops[0].data.kilder.length, 1, "tom liste fra før");
  const v = lesJs("referanse-retting.js");
  assert.match(v, /if \(!s\.contentLoaded\)/, "lista sendes hel, så innholdet må være lest");
  assert.match(lesJs("explore-referanser.js"), /const nyKnapp = \(\) => kanRetteKilder\(\)/, "knappen bare på lærersiden");
});

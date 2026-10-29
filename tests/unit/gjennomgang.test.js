// ============================================================================
//  GRUPPENE OG DET SOM ER GÅTT GJENNOM (v7.15)
// ----------------------------------------------------------------------------
//  Brukerbestilling 2026-10-25: planene samles i grupper (én per plan), og
//  gruppen har en oversikt over alt som er vist og ikke vist, med filter på
//  type og viktighetsgrad. En artist der bare et lytteeksempel er spilt,
//  regnes som gått gjennom, men merkes.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserPlaner, normaliserGruppe, GRUPPE_MAKS } from "../../js/visning/presentasjon-modell.js";
import {
  grupperPlaner, gruppeNavn, planTelling, dekningsNokkel, postNokkel, beregnGjennomgang, filtrerGjennomgang, referanseFor,
} from "../../js/visning/gjennomgang-modell.js";

test("normaliserGruppe og normaliserPlaner: én linje, tak på lengden, tomt er ingen gruppe", () => {
  assert.equal(normaliserGruppe("  Klassen   høst\n2026 "), "Klassen høst 2026");
  assert.equal(normaliserGruppe("x".repeat(100)).length, GRUPPE_MAKS);
  assert.equal(normaliserGruppe(42), "");
  const p = normaliserPlaner({
    a: { tittel: "A", stopp: [], gruppe: " Klassen " },
    b: { tittel: "B", stopp: [], gruppe: "   " },
  });
  assert.equal(p.a.gruppe, "Klassen");
  assert.ok(!("gruppe" in p.b));
});

test("grupperPlaner: gruppene etter nyeste plan, planene nyeste først, resten uten gruppe", () => {
  const planer = normaliserPlaner({
    p1: { tittel: "Uke 39", laget: "2026-09-25", gruppe: "Klassen", dato: "2026-09-25", stopp: [] },
    p2: { tittel: "Uke 41", laget: "2026-10-09", gruppe: "Klassen", dato: "2026-10-09", stopp: [] },
    p3: { tittel: "Jazzplan", laget: "2026-10-01", gruppe: "Jazz", stopp: [] },
    p4: { tittel: "Løs", laget: "2026-10-20", stopp: [] },
  });
  const { grupper, uten } = grupperPlaner(planer);
  assert.deepEqual(grupper.map((g) => g.navn), ["Klassen", "Jazz"]);
  assert.deepEqual(grupper[0].planer.map(([id]) => id), ["p2", "p1"]);
  assert.deepEqual(uten.map(([id]) => id), ["p4"]);
  assert.deepEqual(gruppeNavn(planer), ["Jazz", "Klassen"]);
  assert.equal(planTelling(grupper[0].planer), "2 timer");
  assert.equal(planTelling([...grupper[0].planer, ...grupper[1].planer]), "2 timer og 1 kjøreplan");
});

test("dekningsNokkel: samme mål via ulike veier gir samme nøkkel", () => {
  assert.equal(dekningsNokkel("yt:abcdefghijk:PL1:30"), "yt:abcdefghijk");
  assert.equal(dekningsNokkel("galleri:Bebop"), dekningsNokkel("sjanger:Bebop"));
  assert.equal(dekningsNokkel("undersjanger:Chicago Blues"), "undersjanger:chicago blues");
  assert.equal(dekningsNokkel("tiår:1950"), "tiår:1950:society");
  assert.equal(dekningsNokkel("tiår:1950:tech"), "tiår:1950:tech");
  assert.equal(dekningsNokkel("tidslinje"), null, "visninger uten id teller ikke");
  assert.equal(dekningsNokkel("tull:x"), null);
  assert.equal(postNokkel({ type: "samfunn", id: "1950", apne: { hva: "tiår", id: "1950", modus: "society" } }), "tiår:1950:society");
  assert.equal(postNokkel({ type: "undersjanger", id: "Chicago blues", apne: { hva: "undersjanger", id: "Chicago blues" } }), "undersjanger:chicago blues");
  assert.equal(postNokkel({ type: "lytteeksempel", id: "https://x", apne: { hva: "artist", id: "a1" } }), "artist:a1",
    "et eksempel utenfor YouTube regnes som artisten");
});

const ARTISTER = [
  { id: "muddy", name: "Muddy Waters", priority: 3, musicExamples: [{ label: "Hoochie", url: "https://www.youtube.com/watch?v=abcdefghijk", sentral: true }] },
  { id: "bessie", name: "Bessie Smith", priority: 2, musicExamples: [{ label: "St. Louis", url: "https://www.youtube.com/watch?v=bbbbbbbbbbb" }] },
  { id: "otis", name: "Otis Redding", priority: 0, musicExamples: [] },
];
const INDEKS = [
  { type: "artist", id: "muddy", tittel: "Muddy Waters", sti: "Blues", apne: { hva: "artist", id: "muddy" } },
  { type: "artist", id: "bessie", tittel: "Bessie Smith", sti: "Blues", apne: { hva: "artist", id: "bessie" } },
  { type: "artist", id: "otis", tittel: "Otis Redding", sti: "R&B", apne: { hva: "artist", id: "otis" } },
  { type: "lytteeksempel", id: "abcdefghijk", tittel: "Hoochie", apne: { hva: "yt", id: "abcdefghijk", modus: "", ekstra: "" } },
  { type: "lytteeksempel", id: "bbbbbbbbbbb", tittel: "St. Louis", apne: { hva: "yt", id: "bbbbbbbbbbb", modus: "", ekstra: "" } },
  { type: "sjanger", id: "Electric blues", tittel: "Electric blues", apne: { hva: "sjanger", id: "Electric blues" } },
  { type: "samfunn", id: "1950", tittel: "1950-tallet", apne: { hva: "tiår", id: "1950", modus: "society" } },
  { type: "teknologi", id: "1950", tittel: "1950-tallet", apne: { hva: "tiår", id: "1950", modus: "tech" } },
  { type: "plateselskap", id: "stax", tittel: "Stax", apne: { hva: "plateselskap", id: "stax" } },
  { type: "side", id: "appGuide", tittel: "Slik bruker du appen", apne: { hva: "side", id: "appGuide" } },
  { type: "podkast", id: "p1", tittel: "Episode 1", apne: { hva: "podkast", id: "p1" } },
];
const PLANER = normaliserPlaner({
  t1: { tittel: "Blues", dato: "2026-10-03", laget: "2026-10-03", gruppe: "Klassen", stopp: [{ vis: "artist:muddy" }, { vis: "galleri:Electric blues" }, { vis: "tiår:1950:society" }] },
  t2: { tittel: "Mer blues", dato: "2026-10-10", laget: "2026-10-10", gruppe: "Klassen", stopp: [{ vis: "yt:bbbbbbbbbbb::12" }, { vis: "artist:muddy" }] },
  annen: { tittel: "Soul", laget: "2026-10-12", gruppe: "Soul", stopp: [{ vis: "artist:otis" }, { vis: "plateselskap:stax" }] },
});

test("beregnGjennomgang: alt i gruppen merket med planene som viste det", () => {
  const res = beregnGjennomgang({ planer: PLANER, gruppe: "Klassen", indeks: INDEKS, artister: ARTISTER });
  assert.deepEqual(res.planer.map((p) => p.id), ["t1", "t2"], "planene i datorekkefølge");
  const post = (type, tittel) => res.typer.find((t) => t.type === type).poster.find((p) => p.tittel === tittel);
  assert.equal(post("artist", "Muddy Waters").status, "vist");
  assert.deepEqual(post("artist", "Muddy Waters").vistI, ["t1", "t2"]);
  const bessie = post("artist", "Bessie Smith");
  assert.equal(bessie.status, "lyttet", "bare lytteeksempelet er spilt");
  assert.deepEqual(bessie.lyttetI, ["t2"]);
  assert.equal(post("artist", "Otis Redding").status, "ikke", "vist i en ANNEN gruppe teller ikke");
  assert.equal(post("lytteeksempel", "St. Louis").status, "vist");
  assert.equal(post("lytteeksempel", "Hoochie").status, "ikke");
  assert.equal(post("lytteeksempel", "Hoochie").sentral, true);
  assert.equal(post("lytteeksempel", "Hoochie").prio, 3, "eksempelet får artistens grad");
  assert.equal(post("sjanger", "Electric blues").status, "vist", "galleriet regnes som sjangeren");
  assert.equal(post("samfunn", "1950-tallet").status, "vist");
  assert.equal(post("teknologi", "1950-tallet").status, "ikke", "samfunn og teknologi hver for seg");
  assert.equal(post("plateselskap", "Stax").status, "ikke");
  assert.ok(!res.typer.some((t) => t.type === "podkast"), "podkastene er ikke med");
  assert.ok(!res.typer.some((t) => t.type === "side"), "bruksveiledningen er ikke pensum");
  assert.deepEqual(res.typer.find((t) => t.type === "artist").poster.map((p) => p.tittel),
    ["Muddy Waters", "Bessie Smith", "Otis Redding"], "artistene etter grad");
});

test("filtrerGjennomgang: status, type, viktighetsgrad og sentrale eksempler", () => {
  const res = beregnGjennomgang({ planer: PLANER, gruppe: "Klassen", indeks: INDEKS, artister: ARTISTER });
  const titler = (f, type) => f.typer.find((t) => t.type === type).poster.map((p) => p.tittel);
  const gj = filtrerGjennomgang(res, {});
  assert.deepEqual(titler(gj, "artist"), ["Muddy Waters", "Bessie Smith"], "gått gjennom tar med «bare lyttet»");
  const ikke = filtrerGjennomgang(res, { status: "ikke" });
  assert.deepEqual(titler(ikke, "artist"), ["Otis Redding"]);
  assert.equal(ikke.typer.find((t) => t.type === "artist").gjennomgatt, 2, "tellingene følger ikke status");
  // Viktig og viktigst: Otis (uten grad) er ute; sjangrene har ingen grad og står.
  const viktig = filtrerGjennomgang(res, { status: "alle", nivaa: 2 });
  assert.deepEqual(titler(viktig, "artist"), ["Muddy Waters", "Bessie Smith"]);
  assert.equal(viktig.typer.find((t) => t.type === "sjanger").totalt, 1);
  const viktigst = filtrerGjennomgang(res, { status: "alle", nivaa: 3 });
  assert.deepEqual(titler(viktigst, "lytteeksempel"), ["Hoochie"]);
  const sentrale = filtrerGjennomgang(res, { status: "alle", bareSentrale: true });
  assert.deepEqual(titler(sentrale, "lytteeksempel"), ["Hoochie"]);
  assert.equal(sentrale.typer.find((t) => t.type === "artist").totalt, 3, "bare lytteeksemplene påvirkes");
  const bareArtister = filtrerGjennomgang(res, { type: "artist" });
  assert.deepEqual(bareArtister.valgt.map((t) => t.type), ["artist"]);
  assert.equal(gj.totalt, res.typer.reduce((s, t) => s + t.poster.length, 0));
});

// v7.16 (brukerbestilling 2026-10-26): én plan i gruppen kan være referansen
// de andre måles mot.
const MED_REF = normaliserPlaner({
  ...Object.fromEntries(Object.entries(PLANER).map(([id, p]) => [id, { ...p }])),
  ref: { tittel: "Soul og blues: alt", laget: "2026-09-01", gruppe: "Klassen", referanse: true,
    stopp: [{ vis: "artist:muddy" }, { vis: "artist:otis" }, { vis: "yt:abcdefghijk" }, { vis: "tidslinje" }, { vis: "artist:borte" }] },
  ref2: { tittel: "Nyere referanse", laget: "2026-10-20", gruppe: "Klassen", referanse: true, stopp: [{ vis: "artist:bessie" }] },
  løs: { tittel: "Uten gruppe", laget: "2026-10-21", referanse: true, stopp: [] },
});

test("referanseFor og grupperPlaner: én referanse per gruppe, den eldste ved flere, øverst i gruppen", () => {
  assert.ok(!("referanse" in MED_REF.løs), "uten gruppe er det ingen referanse");
  assert.equal(referanseFor(MED_REF, "Klassen")[0], "ref");
  assert.equal(referanseFor(MED_REF, "Soul"), null);
  const { grupper } = grupperPlaner(MED_REF);
  const klassen = grupper.find((g) => g.navn === "Klassen");
  assert.equal(klassen.referanse, "ref");
  assert.equal(klassen.planer[0][0], "ref");
  assert.equal(planTelling(klassen.planer.filter(([id]) => id !== "ref2")), "2 timer og referansen");
});

test("mot referansen: bare kortene i den, de andre planene teller, og referansen selv teller aldri", () => {
  const res = beregnGjennomgang({ planer: MED_REF, gruppe: "Klassen", indeks: INDEKS, artister: ARTISTER });
  assert.equal(res.mot, "referanse");
  assert.deepEqual(res.referanse, { id: "ref", tittel: "Soul og blues: alt" });
  assert.ok(!res.planer.some((p) => p.id === "ref"), "referansen er ikke en av timene");
  const typer = Object.fromEntries(res.typer.map((t) => [t.type, t.poster.map((p) => `${p.tittel}:${p.status}`)]));
  assert.deepEqual(typer.artist, ["Muddy Waters:vist", "Otis Redding:ikke"], "Bessie er ikke i referansen");
  assert.deepEqual(typer.lytteeksempel, ["Hoochie:ikke"], "referansens eksempel er ikke spilt i timene");
  assert.ok(!typer.sjanger, "bare typene referansen har");
  assert.equal(res.ukjente, 2, "tidslinjen og en artist som ikke finnes");
  // Utenom referansen: vist i timene, men ikke med i den.
  const utenom = Object.fromEntries(res.utenom.map((t) => [t.type, t.poster.map((p) => p.tittel)]));
  assert.deepEqual(utenom.artist, ["Bessie Smith"]);
  assert.deepEqual(utenom.lytteeksempel, ["St. Louis"]);
  assert.deepEqual(utenom.sjanger, ["Electric blues"]);
  const f = filtrerGjennomgang(res, { type: "artist" });
  assert.deepEqual(f.utenom.map((t) => t.type), ["artist"], "typefanen gjelder også utenom");
  assert.equal(f.totalt, 3, "tellingen gjelder referansen: to artister og ett eksempel");
});

test("Alt i appen med en referanse: det gamle, men referansen teller fortsatt ikke", () => {
  const res = beregnGjennomgang({ planer: MED_REF, gruppe: "Klassen", indeks: INDEKS, artister: ARTISTER, mot: "alt" });
  assert.equal(res.mot, "alt");
  assert.ok(res.referanse);
  const otis = res.typer.find((t) => t.type === "artist").poster.find((p) => p.tittel === "Otis Redding");
  assert.equal(otis.status, "ikke", "Otis står bare i referansen");
  assert.ok(res.typer.some((t) => t.type === "sjanger"));
  assert.deepEqual(res.utenom, []);
  const uten = beregnGjennomgang({ planer: PLANER, gruppe: "Klassen", indeks: INDEKS, artister: ARTISTER });
  assert.equal(uten.mot, "alt", "uten referanse måles det mot alt");
});

// v7.20 (brukervalg 2026-10-30): artistene står uten metasjanger og instrument.
test("«Gått gjennom» viser ikke metasjanger og instrument ved artistene", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../js/visning/gjennomgang.js", import.meta.url), "utf8");
  assert.match(src, /\$\{p\.sti && p\.type !== "artist" \? `<span class="muted gj-sti">/);
});

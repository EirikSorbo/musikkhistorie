// Søkeindeksen og rangeringen. search.js er DOM-fri med vilje, så alt som
// avgjør HVA man finner og i hvilken rekkefølge kan måles her.
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { byggIndeks, sok, utdrag, marker, normaliser, delOppSok } from "../../js/search.js?v=5.06";

const STATE = {
  isTeacher: false,
  artists: [
    { id: "a1", name: "Muddy Waters", status: "active", priority: 2, metaGenre: "Blues",
      instrument: "Gitar", geography: "Mississippi", recordLabel: "Chess",
      mainGenre: ["Electric blues"], subGenre: ["Chicago blues"],
      description: "Flyttet til Chicago og elektrifiserte bluesen.",
      keyWorks: [{ title: "Rollin' Stone" }], musicExamples: [{ title: "Mannish Boy" }] },
    { id: "a2", name: "Beyoncé", status: "active", metaGenre: "R&B", instrument: "Vokal",
      description: "Sanger fra Houston." },
    { id: "a3", name: "Skjult artist", status: "active", priority: -1, metaGenre: "Pop",
      description: "Chicago står også her." },
    { id: "a4", name: "Venter på godkjenning", status: "pending", metaGenre: "Pop",
      description: "Chicago står her også." },
  ],
  techItems: [
    { id: "t1", name: "Grammofonen", description: "Flate plater fra 1910-tallet.",
      category: "Opptak og avspilling", adoptedLabel: "fra ca. 1910" },
    { id: "t2", name: "Woodstock", type: "hendelse", description: "Festivalen i 1969." },
  ],
  decadeDescs: {
    1950: { society: "Borgerrettskampen tar form.", tech: "Grammofonen møter LP-en." },
    1960: { society: "" },
  },
  genreDescs: {
    Bebop: { main: { description: "Rask jazz for lytting, ikke dans.", era: "1940-tallet" } },
    "Delta blues": { sub: { description: "Akustisk blues fra Mississippi." } },
    Blues: { story: { body: "Den lange historien om bluesen." } },
  },
  edgeDescs: { "blues__rnb": { description: "Bluesen ledet til rhythm and blues." } },
  content: {
    rotter: { body: "Røttene ligger i møtet mellom Vest-Afrika og Europa." },
    omHistorie: { body: "Historiebevissthet handler om å se sammenhenger." },
  },
  podcasts: [{ id: "p1", title: "Episode 1: Delta", description: "Om Mississippi." }],
};

const finn = (indeks, type, tittel) => indeks.find((p) => p.type === type && p.tittel === tittel);
const typer = (indeks) => indeks.reduce((o, p) => { o[p.type] = (o[p.type] || 0) + 1; return o; }, {});

test("normaliseringen tar aksenter og apostrofer, men lar æ/ø/å stå", () => {
  assert.equal(normaliser("Beyoncé"), "beyonce");
  assert.equal(normaliser("Rock’n’Roll"), "rock'n'roll");
  assert.equal(normaliser("LÅT MED Æ Ø Å"), "låt med æ ø å");
  // Én-til-én i lengde er et KRAV: utdraget skjærer i originalen med posisjoner
  // funnet i den normaliserte kopien.
  for (const s of ["Beyoncé", "Café Society", "Rock’n’Roll", "ÅSNE"]) {
    assert.equal(normaliser(s).length, s.length, s);
  }
});

test("søkeordene deles på mellomrom", () => {
  assert.deepEqual(delOppSok("  Chicago   BLUES "), ["chicago", "blues"]);
  assert.deepEqual(delOppSok(""), []);
});

test("indeksen dekker alt innholdet, én post per ting", () => {
  const t = typer(byggIndeks(STATE, { erLærer: true }));
  assert.equal(t.artist, 4, "alle artistene for læreren");
  assert.equal(t.tech, 1);
  assert.equal(t.hendelse, 1, "hendelser skilles fra innovasjoner");
  assert.equal(t.samfunn, 1, "tomt samfunnsfelt gir ingen post");
  assert.equal(t.teknologi, 1);
  assert.equal(t.undersjanger, 1, "kun sub-navn som ikke alt er en tre-node");
  assert.equal(t.historie, 1);
  assert.equal(t.kobling, 1);
  assert.equal(t.side, 2);
  assert.equal(t.podkast, 1);
  assert.ok(t.sjanger > 30, "treets sjangre er med");
  assert.ok(t.rot >= 8, "og røttene");
});

test("studenten søker bare i det studenten kan åpne", () => {
  const skjul = { storeBildet: true, metasjangerhistorier: true, koblingsbeskrivelser: true };
  const t = typer(byggIndeks(STATE, { erLærer: false, skjul }));
  assert.equal(t.artist, 2, "skjulte kort og forslag som venter, er ute");
  assert.equal(t.historie, undefined, "sjangerhistoriene er skjult");
  assert.equal(t.side, undefined, "innholdssidene nås fra en skjult hub");
  assert.equal(t.kobling, undefined, "koblingsbeskrivelsene er skjult");
  // Læreren ser de samme fire, med samme brytere.
  const tl = typer(byggIndeks(STATE, { erLærer: true, skjul }));
  assert.equal(tl.artist, 4);
  assert.equal(tl.historie, 1);
  assert.equal(tl.side, 2);
  assert.equal(tl.kobling, 1);
});

test("artisten finnes på alt som står på kortet", () => {
  const indeks = byggIndeks(STATE, { erLærer: false });
  for (const q of ["muddy", "mississippi", "chess", "chicago blues", "rollin", "mannish", "gitar"]) {
    const res = sok(indeks, q);
    assert.ok(res.grupper.some((g) => g.treff.some((t) => t.id === "a1")), `fant ikke Muddy Waters på «${q}»`);
  }
});

test("aksentløst søk finner artisten med aksent", () => {
  const res = sok(byggIndeks(STATE, { erLærer: false }), "beyonce");
  assert.equal(res.grupper[0].treff[0].tittel, "Beyoncé");
});

test("alle ordene må finnes (OG-søk)", () => {
  const indeks = byggIndeks(STATE, { erLærer: false });
  assert.ok(sok(indeks, "chicago blues").totalt > 0);
  assert.equal(sok(indeks, "chicago tuba").totalt, 0);
});

test("ett tegn søker ikke", () => {
  const res = sok(byggIndeks(STATE, { erLærer: false }), "b");
  assert.equal(res.forKort, true);
  assert.equal(res.totalt, 0);
});

test("titteltreff slår teksttreff, og gruppen med det beste treffet kommer først", () => {
  const indeks = byggIndeks(STATE, { erLærer: true });
  const res = sok(indeks, "grammofon");
  // «Grammofonen» (tittel) foran tiårsteksten som bare nevner ordet.
  assert.equal(res.grupper[0].type, "tech");
  assert.equal(res.grupper[0].treff[0].tittel, "Grammofonen");
  const tech = finn(indeks, "tech", "Grammofonen");
  const tiar = finn(indeks, "teknologi", "1950-tallet");
  assert.ok(sok([tech, tiar], "grammofon").grupper[0].type === "tech");
});

test("hvert treff vet hvordan det åpnes", () => {
  const indeks = byggIndeks(STATE, { erLærer: true });
  assert.deepEqual(finn(indeks, "artist", "Muddy Waters").apne, { hva: "artist", id: "a1" });
  assert.deepEqual(finn(indeks, "tech", "Grammofonen").apne, { hva: "tech", id: "t1" });
  assert.deepEqual(finn(indeks, "samfunn", "1950-tallet").apne, { hva: "tiår", id: "1950", modus: "society" });
  assert.deepEqual(finn(indeks, "teknologi", "1950-tallet").apne, { hva: "tiår", id: "1950", modus: "tech" });
  assert.deepEqual(finn(indeks, "undersjanger", "Delta blues").apne, { hva: "undersjanger", id: "Delta blues" });
  assert.deepEqual(finn(indeks, "historie", "Historien om Blues").apne, { hva: "historie", id: "Blues" });
  assert.deepEqual(finn(indeks, "kobling", "Blues → R&B").apne, { hva: "kobling", id: "blues__rnb" });
  assert.deepEqual(finn(indeks, "side", "Røtter før 1910").apne, { hva: "side", id: "rotter" });
  assert.deepEqual(finn(indeks, "sjanger", "Bebop").apne, { hva: "sjanger", id: "Bebop" });
});

test("røttene er de samme åtte som Røtter-kortet viser", () => {
  const indeks = byggIndeks(STATE, { erLærer: true });
  const røtter = indeks.filter((p) => p.type === "rot").map((p) => p.id).sort();
  assert.deepEqual(røtter, ["Brassband", "Europeisk", "Hymner", "Ragtime",
    "Spirituals", "Vaudeville", "Vestafrikansk", "Work songs"]);
});

test("utdraget viser konteksten rundt treffet, med ordet uthevet", () => {
  const post = finn(byggIndeks(STATE, { erLærer: false }), "artist", "Muddy Waters");
  const u = utdrag(post, ["chicago"]);
  assert.match(u, /<mark>Chicago<\/mark>/);
  assert.ok(u.length < 220, "utdraget skal være et vindu, ikke hele teksten");
});

test("markeringen kan ikke brekke ut av HTML-en", () => {
  // Escapes etter oppdelingen: et søk på «amp» skal ikke legge en <mark> midt
  // inne i entiteten fra et &-tegn.
  assert.equal(marker("R&B", ["r&b"]), "<mark>R&amp;B</mark>");
  assert.equal(marker("amper & sur", ["amp"]), "<mark>amp</mark>er &amp; sur");
  assert.equal(marker('<script>x</script>', ["script"]),
    "&lt;<mark>script</mark>&gt;x&lt;/<mark>script</mark>&gt;");
  assert.equal(marker("uten treff", ["zzz"]), "uten treff");
});

test("overlappende treff smelter sammen til én markering", () => {
  assert.equal(marker("bluesen", ["blue", "blues", "lues"]), "<mark>blues</mark>en");
});

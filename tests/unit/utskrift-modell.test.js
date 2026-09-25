// Utskriften (v5.56): utvalget, sammensetningen av heftet og tittelforslaget.
// Modellen er DOM-fri, så alt som avgjør HVA som kommer på papir og i hvilken
// rekkefølge, måles her. Sjangertreet kommer fra frøet (seed-model), som i
// de andre testene.
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kanoniskVis, normaliserUtvalg, planTilUtvalg, normaliserLagret, normaliserTittel,
  settSammen, foreslaaTittel, tellingerTekst, utvidUtvalg, barnAv,
  DELER, STANDARD_DELER, TITTEL_MAKS, UNDERSJANGRE_LOSE,
} from "../../js/utskrift-modell.js?v=5.61";
import { isVisible } from "../../js/limits.js?v=5.61";

const NAA = 2026;

const ARTISTER = [
  { id: "bessie", name: "Bessie Smith", status: "active", priority: 3, metaGenre: "Blues", instrument: "Vokal",
    birthYear: 1894, deathYear: 1937, influenceStart: 1923, influenceEnd: 1933, recordLabel: "Columbia", geography: "New York",
    mainGenre: ["Blues"], subGenre: ["Classic blues"], description: "Empress of the Blues.",
    keyWorks: [{ title: "St. Louis Blues", year: 1925 }, { title: "Downhearted Blues", year: 1923 }],
    musicExamples: [{ label: "St. Louis Blues", url: "https://www.youtube.com/watch?v=5.61rd9IaA_uJI", year: 1925 }],
    kilder: [{ text: "Encyclopædia Britannica.", url: "https://www.britannica.com/biography/Bessie-Smith" }],
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Bessie.jpg", imageCredit: "Foto: Wikimedia" },
  { id: "robert", name: "Robert Johnson", status: "active", priority: 3, metaGenre: "Blues", instrument: "Gitar",
    birthYear: 1911, deathYear: 1938, influenceStart: 1936, influenceEnd: 1938,
    mainGenre: ["Blues"], subGenre: ["Delta blues"], description: "Delta blues.",
    musicExamples: [{ label: "Cross Road Blues", url: "https://www.youtube.com/watch?v=GtDlZdhHRCI", year: 1937 }],
    kilder: [{ text: "Encyclopædia Britannica.", url: "https://www.britannica.com/biography/Robert-Johnson-American-musician" },
      { text: "Encyclopædia Britannica.", url: "https://www.britannica.com/biography/Robert-Johnson-American-musician" }] },
  { id: "muddy", name: "Muddy Waters", status: "active", priority: 3, metaGenre: "Blues", instrument: "Gitar",
    birthYear: 1913, deathYear: 1983, influenceStart: 1948, influenceEnd: 1964, recordLabel: "Chess",
    mainGenre: ["Electric blues"], subGenre: ["Chicago blues"], description: "Chicago.",
    musicExamples: [{ label: "Got My Mojo Working", url: "https://www.youtube.com/watch?v=-SBmury81Ws", year: 1957 }],
    kilder: ["Encyclopædia Britannica."] },
  { id: "miles", name: "Miles Davis", status: "active", priority: 3, metaGenre: "Jazz", instrument: "Trompet",
    birthYear: 1926, deathYear: 1991, influenceStart: 1949, influenceEnd: 1991, mainGenre: ["Cool jazz", "Modal jazz"],
    description: "Jazz.", musicExamples: [], kilder: [] },
  { id: "beyonce", name: "Beyoncé", status: "active", priority: 2, metaGenre: "R&B", instrument: "Vokal",
    birthYear: 1981, influenceStart: 1997, mainGenre: ["Cont. R&B"], description: "R&B.", musicExamples: [] },
  { id: "skjult", name: "Skjult artist", status: "active", priority: -1, metaGenre: "Blues", influenceStart: 1950, mainGenre: ["Blues"] },
  { id: "venter", name: "Venter", status: "pending", metaGenre: "Blues", influenceStart: 1950, mainGenre: ["Blues"] },
];

const GENRE_DESCS = {
  Blues: { main: { description: "Den grunnleggende tradisjonen.", era: "ca. 1900", activeFrom: 1900, kilder: [{ text: "Store norske leksikon.", url: "https://snl.no/blues" }], punkter: ["Blåtoner", "AAB-strofe", "Tolv takter"] },
    story: { body: "*Sjangertre-løype: Work songs → Blues*\nHistorien om bluesen." } },
  "Electric blues": { main: { description: "Bluesen etter forsterkeren.", era: "fra midten av 1940-tallet", activeFrom: 1945, activeTo: 1969, lytt: ["Muddy Waters: Rollin' Stone"] } },
  "Classic blues": { sub: { description: "Tidlig kommersiell blues på 1920-tallet." } },
  "Delta blues": { sub: { description: "Fra Mississippi-deltaet.", kilder: [{ text: "Palmer, R. Deep Blues." }] } },
  "Hard bop": { sub: { description: "Bebop med gospel- og bluesfølelse." } },
  Ukjenttag: { sub: { description: "Tagg ingen artist bærer." } },
  "Fiktiv stil": { sub: { description: "Heller ikke en tre-node." } },
};

const DATA = {
  artists: ARTISTER,
  genreDescs: GENRE_DESCS,
  content: {
    varmekart: { heat: { Blues: [2, 4, 4, 4, 4, 3, 2, 2, 2, 2, 2, 2, 2] } },
    rotter: { body: "Røttene.", kilder: [] },
    omHistorie: { body: "Om historie." },
    "instrument-gitar": { body: "Gitarens historie.", kilder: [{ text: "Store norske leksikon.", url: "https://snl.no/gitar" }] },
  },
  decadeDescs: {
    1920: { society: "Prohibition.\nHarlem-renessansen.", tech: "Mikrofonen.", kilder: [{ text: "LoC." }] },
    1950: { society: "Borgerrettsbevegelsen starter.", tech: "Transistorradioen.", kilder: [] },
  },
  techItems: [
    { id: "elgitar", name: "Elektrisk gitar", status: "active", category: "Instrumenter og lydutstyr", inventedYear: 1931, adoptedYear: 1938, adoptedLabel: "Vanlig fra slutten av 1930-tallet.", decade: "1930", description: "Pickup.", kilder: [{ text: "SNL.", url: "https://snl.no/el-gitar" }] },
    { id: "ror", name: "Rørforsterkeren", status: "active", category: "Instrumenter og lydutstyr", inventedYear: 1928, adoptedYear: 1945, decade: "1940", description: "Volum." },
    { id: "transistor", name: "Transistorradioen", status: "active", category: "Kringkasting og spredning", adoptedYear: 1954, decade: "1950", description: "Bærbar." },
    { id: "hendelse", name: "Hendrix på Monterey", status: "active", type: "hendelse", adoptedYear: 1967, decade: "1960", description: "Gitaren brenner." },
    { id: "pending", name: "Venter", status: "pending", adoptedYear: 1955, decade: "1950" },
  ],
};

const STUDENT = { naa: NAA, skjul: { metasjangerhistorier: true, horEtter: true, koblingsbeskrivelser: true, viktighetsgrad: true }, skjulHub: { "sb-rotter": true, "sb-om-historie": true }, punkterSkjult: true };
const LAERER = { naa: NAA, erLaerer: true, skjul: STUDENT.skjul, skjulHub: STUDENT.skjulHub, punkterSkjult: false };

// ---------------------------------------------------------------------------
//  Utvalget
// ---------------------------------------------------------------------------

test("kanoniskVis: bare hefte-typer, tiår uten modus, guiden holdes utenfor", () => {
  assert.equal(kanoniskVis("artist:abc"), "artist:abc");
  assert.equal(kanoniskVis("tiår:1950:tech"), "tiår:1950");
  assert.equal(kanoniskVis("tiår:1950:society"), "tiår:1950");
  assert.equal(kanoniskVis("tiår:1955"), null, "ikke et tiår i DECADES");
  assert.equal(kanoniskVis("side:rotter"), "side:rotter");
  assert.equal(kanoniskVis("side:guide"), null);
  assert.equal(kanoniskVis("side:appGuide"), null);
  // Metasjangeren er heftets egen type (v5.58), ikke en ?vis=-type.
  assert.equal(kanoniskVis("metasjanger:Blues"), "metasjanger:Blues");
  assert.equal(kanoniskVis("metasjanger: Blues "), "metasjanger:Blues");
  assert.equal(kanoniskVis("metasjanger:"), null);
  assert.equal(kanoniskVis("metasjanger:a:b"), null);
  for (const v of ["varmekart", "varmekart:Blues", "tidslinje", "kobling:blues__rnb", "yt:abc", "podkaster", "slektstre", "historie", "artist", "", null, undefined, 42]) {
    assert.equal(kanoniskVis(v), null, String(v));
  }
});

test("normaliserUtvalg: rekkefølgen holdes, duplikater og ugyldige faller bort", () => {
  assert.deepEqual(
    normaliserUtvalg(["sjanger:Blues", "artist:a", "tiår:1950:tech", "sjanger:Blues", "varmekart", { vis: "tiår:1950" }, "artist:a", 7]),
    ["sjanger:Blues", "artist:a", "tiår:1950"],
  );
  assert.deepEqual(normaliserUtvalg(null), []);
});

test("planTilUtvalg: lytteeksempel-stopp blir artisten som eier det, skjermflater hoppes over", () => {
  const stopp = [
    { vis: "store-bildet" }, { vis: "sjanger:Blues", nivaa: 2 }, { vis: "yt:3rd9IaA_uJI" },
    { vis: "artist:bessie" }, { vis: "yt:ukjentvideo" }, "tiår:1950:tech", { vis: "varmekart:Blues" }, { vis: "tech:elgitar" },
  ];
  assert.deepEqual(planTilUtvalg(stopp, ARTISTER), ["sjanger:Blues", "artist:bessie", "tiår:1950", "tech:elgitar"]);
});

test("normaliserLagret tåler alt og gir standardverdier", () => {
  const u = normaliserLagret(null);
  assert.deepEqual(u.valg, []);
  assert.deepEqual(u.fravalg, []);
  assert.equal(u.tittel, "");
  assert.deepEqual(u.deler, STANDARD_DELER);
  assert.deepEqual(u.form, { kompakt: false, rekkefolge: "kronologisk" });
  assert.equal(u.plan, null);
  const v = normaliserLagret({ valg: ["artist:a", "x"], fravalg: ["artist:a", "artist:b", "tull"], tittel: "  En   tittel ", deler: { "artist.bilde": false, ukjent: true }, form: { kompakt: true, rekkefolge: "valgt" }, plan: { id: "p1", tittel: "Time 3" } });
  assert.deepEqual(v.valg, ["artist:a"]);
  assert.deepEqual(v.fravalg, ["artist:a", "artist:b"], "et valg kan stå avhuket i lista (v5.59)");
  assert.equal(v.tittel, "En tittel");
  assert.equal(v.deler["artist.bilde"], false);
  assert.equal(v.deler.ukjent, undefined);
  assert.deepEqual(v.form, { kompakt: true, rekkefolge: "valgt" });
  assert.deepEqual(v.plan, { id: "p1", tittel: "Time 3" });
});

test("tittelen klippes til TITTEL_MAKS tegn", () => {
  assert.equal(normaliserTittel("a".repeat(100)).length, TITTEL_MAKS);
  assert.equal(normaliserTittel(null), "");
});

test("DELER-listen har unike id-er med gruppe-prefiks; artistkortet har virketid, ikke bilde", () => {
  const ider = DELER.flatMap((g) => g.valg.map((v) => v.id));
  assert.equal(new Set(ider).size, ider.length);
  for (const id of ider) assert.match(id, /^(artist|sjanger|tech|tiaar|foran|bak)\.[a-z]+$/);
  assert.ok(ider.includes("artist.virketid"), "tidslinja for virketid er et avhukbart valg (v5.60)");
  assert.ok(ider.includes("artist.bilde"), "bildet er fortsatt et valg");
});

// ---------------------------------------------------------------------------
//  Sammensetningen
// ---------------------------------------------------------------------------

test("familiene i kuratert rekkefølge, sjangrene kronologisk, artistene under sjangeren sin", () => {
  const m = settSammen(["artist:miles", "artist:muddy", "sjanger:Electric blues", "artist:robert", "sjanger:Blues", "artist:bessie"], DATA, STUDENT);
  assert.deepEqual(m.familier.map((F) => F.navn), ["Blues", "Jazz"]);
  const blues = m.familier[0];
  assert.equal(blues.hodeKort.navn, "Blues", "noden med familiens navn er familiens hode");
  assert.deepEqual(blues.hodeKort.artister.map((a) => a.navn), ["Bessie Smith", "Robert Johnson"], "kronologisk etter innflytelsesår");
  assert.deepEqual(blues.sjangre.map((k) => k.navn), ["Electric blues"]);
  assert.deepEqual(blues.sjangre[0].artister.map((a) => a.navn), ["Muddy Waters"]);
  assert.deepEqual(blues.loseArtister, []);
  const jazz = m.familier[1];
  assert.equal(jazz.hodeKort, null);
  assert.deepEqual(jazz.loseArtister.map((a) => a.navn), ["Miles Davis"], "uten valgt sjangerkort står artisten løst i familien");
  assert.equal(m.tom, false);
  assert.deepEqual(m.mangler, []);
});

test("«som valgt» følger utvalgets rekkefølge i stedet for den kuraterte", () => {
  const m = settSammen(["artist:miles", "artist:muddy", "artist:bessie"], DATA, { ...STUDENT, form: { rekkefolge: "valgt" } });
  assert.deepEqual(m.familier.map((F) => F.navn), ["Jazz", "Blues"]);
  assert.deepEqual(m.familier[1].loseArtister.map((a) => a.navn), ["Muddy Waters", "Bessie Smith"]);
});

test("sjangerkortet: epoke, varmestripe, slektskap og kilder fra data", () => {
  const m = settSammen(["sjanger:Electric blues", "sjanger:Blues"], DATA, STUDENT);
  const blues = m.familier[0].hodeKort;
  assert.equal(blues.era, "ca. 1900–i dag. ca. 1900");
  assert.equal(blues.apen, true);
  assert.deepEqual(blues.stripe.verdier, [2, 4, 4, 4, 4, 3, 2, 2, 2, 2, 2, 2, 2]);
  assert.ok(blues.relasjoner.fra.length > 0, "vokste ut av røttene");
  assert.ok(blues.relasjoner.til.includes("Electric blues"));
  assert.equal("kilder" in blues, false, "kildene står ikke i heftet (v5.59)");
  const eb = m.familier[0].sjangre[0];
  assert.equal(eb.era, "ca. 1945–1969. fra midten av 1940-tallet");
  assert.deepEqual(eb.relasjoner.fra, ["Blues"]);
  assert.deepEqual(eb.lytt, [], "«Hør etter» er skjult for studenter");
  assert.deepEqual(blues.punkter, [], "punktene er skjult utenfor presentasjonen");
});

test("læreren får «Hør etter», punktene og historien; studenten får «skjult» i mangler", () => {
  const l = settSammen(["sjanger:Electric blues", "sjanger:Blues", "historie:Blues", "side:rotter"], DATA, LAERER);
  assert.deepEqual(l.familier[0].sjangre[0].lytt, ["Muddy Waters: Rollin' Stone"]);
  assert.deepEqual(l.familier[0].hodeKort.punkter, ["Blåtoner", "AAB-strofe", "Tolv takter"]);
  assert.equal(l.familier[0].historie.body, "Historien om bluesen.", "løype-linja strippes som i appen");
  assert.equal(l.sider.length, 1);
  assert.deepEqual(l.mangler, []);
  const s = settSammen(["historie:Blues", "side:rotter", "side:omHistorie"], DATA, STUDENT);
  assert.deepEqual(s.mangler.map((x) => x.grunn), ["skjult", "skjult", "skjult"]);
  assert.equal(s.familier.length, 0);
});

test("ordlista: undersjangrene fra artistkortene havner i familien, valgte undersjangre plasseres etter artistene som bærer taggen", () => {
  const m = settSammen(["artist:bessie", "artist:muddy", "undersjanger:Fiktiv stil", "undersjanger:Ukjenttag", "undersjanger:Delta blues"], DATA, STUDENT);
  const blues = m.familier.find((F) => F.navn === "Blues");
  assert.deepEqual(blues.ordliste.map((u) => u.navn), ["Classic blues", "Delta blues"], "alfabetisk; Chicago blues har ingen beskrivelse");
  // Ingen artist bærer taggene, og navnene er ikke tre-noder: den løse bolken bakerst.
  const lose = m.familier[m.familier.length - 1];
  assert.equal(lose.navn, UNDERSJANGRE_LOSE);
  assert.equal(lose.pseudo, true);
  assert.deepEqual(lose.ordliste.map((u) => u.navn), ["Fiktiv stil", "Ukjenttag"]);
  // Avkryssingen «ordliste» gjelder bare de utledede taggene; de valgte står uansett.
  const uten = settSammen(["artist:bessie", "undersjanger:Delta blues"], DATA, { ...STUDENT, deler: { "sjanger.ordliste": false } });
  assert.deepEqual(uten.familier[0].ordliste.map((u) => u.navn), ["Delta blues"]);
});

test("lyttelista nummereres i heftets rekkefølge, og numrene står på kortene", () => {
  const m = settSammen(["artist:muddy", "sjanger:Electric blues", "artist:robert", "sjanger:Blues", "artist:bessie"], DATA, STUDENT);
  assert.deepEqual(m.lytteliste.map((l) => [l.nr, l.artist, l.label]), [
    [1, "Bessie Smith", "St. Louis Blues"], [2, "Robert Johnson", "Cross Road Blues"], [3, "Muddy Waters", "Got My Mojo Working"],
  ]);
  assert.equal(m.familier[0].hodeKort.artister[0].lytte[0].nr, 1);
  assert.equal(m.familier[0].sjangre[0].artister[0].lytte[0].nr, 3);
  const uten = settSammen(["artist:bessie"], DATA, { ...STUDENT, deler: { "bak.lytteliste": false } });
  assert.deepEqual(uten.lytteliste, []);
  assert.equal(uten.familier[0].loseArtister[0].lytte[0].nr, 0);
});

test("kildene er ikke med i heftet (brukervalg 2026-09-25): ingen kilde-del, ingen kilde-felt", () => {
  const m = settSammen(["artist:muddy", "artist:robert", "sjanger:Blues", "tiår:1920", "tech:elgitar", "instrument:Gitar"], DATA, STUDENT);
  assert.equal("kilder" in m, false);
  assert.equal(DELER.flatMap((g) => g.valg).some((v) => v.id === "bak.kilder"), false);
  assert.equal("kilder" in m.familier[0].hodeKort.artister[0], false);
  assert.equal("kilder" in m.bakteppe[0], false);
  assert.equal("kilder" in m.innovasjoner[0], false);
  assert.equal("kilder" in m.instrumenter[0], false);
});

test("bakteppet: tiårene i tidsrekkefølge, utledet av artistene, med artistene i utvalget og innovasjonene i tiåret", () => {
  const m = settSammen(["tiår:1950", "tiår:1920", "artist:muddy", "artist:bessie"], DATA, STUDENT);
  // 1920 og 1950 er valgt; 1930, 1940 og 1960 følger av innflytelsesperiodene.
  assert.deepEqual(m.bakteppe.map((b) => b.tiaar), [1920, 1930, 1940, 1950, 1960]);
  assert.deepEqual(m.bakteppe[0].artister, ["Bessie Smith"]);
  assert.deepEqual(m.bakteppe[3].artister, ["Muddy Waters"]);
  assert.equal(m.bakteppe[0].samfunn, "Prohibition.\nHarlem-renessansen.");
  assert.deepEqual(m.bakteppe[3].innovasjoner, [{ navn: "Transistorradioen", aar: 1954 }], "hendelser og ventende kort holdes utenfor");
  const uten = settSammen(["tiår:1950"], DATA, { ...STUDENT, deler: { "tiaar.innovasjoner": false, "tiaar.samfunn": false } });
  assert.deepEqual(uten.bakteppe[0].innovasjoner, []);
  assert.equal(uten.bakteppe[0].samfunn, "");
  assert.equal(uten.bakteppe[0].teknologi, "Transistorradioen.");
});

test("innovasjonene etter år, instrumentene i seksjonens rekkefølge, sidene i fast rekkefølge", () => {
  const m = settSammen(["tech:elgitar", "tech:ror", "instrument:Gitar", "instrument:Vokal", "side:omHistorie", "side:rotter", "tech:pending", "instrument:Tuba"], DATA, LAERER);
  assert.deepEqual(m.innovasjoner.map((t) => [t.navn, t.aar]), [["Elektrisk gitar", 1938], ["Rørforsterkeren", 1945]]);
  // Rekkefølgen er Instrumenter-kortets (INSTRUMENT_TIMELINE_GROUPS), ikke utvalgets.
  assert.deepEqual(m.instrumenter.map((i) => i.tittel), ["Gitarens utvikling", "Vokalens utvikling"]);
  assert.equal(m.instrumenter[1].body, "", "sammendrag uten side er tomt, ikke borte");
  assert.deepEqual(m.sider.map((s) => s.id), ["rotter", "omHistorie"]);
  assert.deepEqual(m.mangler.map((x) => x.vis), ["tech:pending", "instrument:Tuba"]);
});

test("tidslinja: sjangre og artister i heftets rekkefølge, klemt til aksen", () => {
  const m = settSammen(["sjanger:Blues", "artist:bessie", "artist:beyonce"], DATA, STUDENT);
  assert.equal(m.tidslinje.start, 1900);
  assert.equal(m.tidslinje.slutt, NAA + 5);
  assert.deepEqual(m.tidslinje.ticks[0], 1900);
  assert.deepEqual(m.tidslinje.rader.map((r) => [r.navn, r.type, r.fra, r.til, r.apen]), [
    ["Blues", "sjanger", 1900, NAA, true],
    ["Bessie Smith", "artist", 1923, 1933, false],
    ["Robert Johnson", "artist", 1936, 1938, false],
    ["Beyoncé", "artist", 1997, NAA, true],
  ]);
  assert.deepEqual(m.aarsspenn, { fra: 1900, til: 1938, apen: true });
  const uten = settSammen(["artist:bessie"], DATA, { ...STUDENT, deler: { "foran.tidslinje": false } });
  assert.equal(uten.tidslinje, null);
  assert.deepEqual(uten.aarsspenn, { fra: 1923, til: 1933, apen: false }, "årsspennet regnes uansett (tittelen trenger det)");
});

test("skjulte og ventende artister og slettede kort havner i mangler, ikke i heftet", () => {
  const m = settSammen(["artist:skjult", "artist:venter", "artist:finnesikke", "sjanger:Finnes ikke", "undersjanger:Chicago blues"], DATA, STUDENT);
  assert.equal(m.familier.length, 0);
  assert.deepEqual(m.mangler.map((x) => x.vis), ["artist:skjult", "artist:venter", "artist:finnesikke", "sjanger:Finnes ikke", "undersjanger:Chicago blues"]);
  assert.equal(m.tom, false, "utvalget er ikke tomt, det mangler bare innhold");
});

test("artistkortet: levetid, innflytelse, verk etter år, spennet til virketidslinja, bilde med kreditering uten «Foto:»", () => {
  const m = settSammen(["artist:bessie"], DATA, STUDENT);
  const k = m.familier[0].loseArtister[0];
  assert.equal(k.levetid, "1894–1937");
  assert.equal(k.fakta.innflytelse, "ca. 1923–1933");
  assert.deepEqual(k.verk.map((w) => w.tittel), ["Downhearted Blues", "St. Louis Blues"]);
  assert.deepEqual(k.span, { start: 1923, end: 1933, open: false }, "virketidslinja tegnes av spennet");
  assert.deepEqual(k.bilde, { url: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Bessie.jpg", kreditt: "Wikimedia" });
  assert.deepEqual(k.tiaar, [1920, 1930]);
});

test("tellingene teller hvert valg, og tellingerTekst bøyer riktig", () => {
  const m = settSammen(["sjanger:Blues", "sjanger:Electric blues", "artist:bessie", "tiår:1950", "tech:elgitar", "tech:ror", "undersjanger:Delta blues"], DATA, STUDENT);
  // Sjangrene drar med Robert Johnson og Muddy Waters, artistene drar med
  // tiårene 1920–1960 (v5.58).
  assert.deepEqual(m.tellinger, { metasjangre: 0, sjangre: 2, artister: 3, undersjangre: 1, tiaar: 5, innovasjoner: 2, instrumenter: 0, historier: 0, sider: 0, bortvalgt: 0 });
  assert.equal(tellingerTekst(m.tellinger), "2 sjangre · 3 artister · 1 undersjanger · 5 tiår · 2 innovasjoner");
  assert.equal(tellingerTekst({ metasjangre: 1, sjangre: 1, tiaar: 3, instrumenter: 1, historier: 2, sider: 1 }), "1 metasjanger · 1 sjanger · 3 tiår · 1 instrument · 2 historier · 1 side");
  assert.equal(tellingerTekst({}), "");
});

// ---------------------------------------------------------------------------
//  Utvidelsen (brukerens regler 2026-09-25, v5.58)
// ---------------------------------------------------------------------------

const SYNLIGE = ARTISTER.filter(isVisible);

test("utvidUtvalg: en metasjanger drar inn treets sjangre og de synlige artistene, og artistene drar inn tiårene", () => {
  const { kilde, grunnlag } = utvidUtvalg(["metasjanger:Blues"], [], SYNLIGE, NAA, GENRE_DESCS);
  assert.equal(kilde.get("metasjanger:Blues"), "valgt");
  assert.equal(kilde.get("sjanger:Blues"), "metasjanger");
  assert.equal(kilde.get("sjanger:Electric blues"), "metasjanger");
  for (const v of ["artist:bessie", "artist:robert", "artist:muddy"]) assert.equal(kilde.get(v), "metasjanger", v);
  for (const v of ["artist:skjult", "artist:venter", "artist:miles", "artist:beyonce"]) assert.equal(kilde.has(v), false, v);
  assert.deepEqual([...kilde.keys()].filter((v) => v.startsWith("tiår:")), ["tiår:1920", "tiår:1930", "tiår:1940", "tiår:1950", "tiår:1960"]);
  assert.equal(kilde.get("tiår:1950"), "utledet");
  assert.equal(grunnlag, "artister");
  // Rekkefølgen: valgt først, så det metasjangeren drar inn, så tiårene.
  assert.equal([...kilde.keys()][0], "metasjanger:Blues");
});

test("utvidUtvalg: en sjanger drar inn artistene sine, også når den selv fulgte med en metasjanger", () => {
  const { kilde } = utvidUtvalg(["sjanger:Electric blues"], [], SYNLIGE, NAA, GENRE_DESCS);
  assert.equal(kilde.get("artist:muddy"), "sjanger");
  assert.equal(kilde.has("artist:bessie"), false);
  // Miles Davis har to sjangre; en av dem holder.
  const jazz = utvidUtvalg(["sjanger:Cool jazz"], [], SYNLIGE, NAA, GENRE_DESCS).kilde;
  assert.equal(jazz.get("artist:miles"), "sjanger");
});

test("utvidUtvalg: et bortvalg tar ikke posten ut av lista, bare tiårene følger det som er huket på", () => {
  // Avhuket sjanger: artistene står fortsatt i lista (avhuket av huk() i
  // utvalg-modulen), og tiårene følger dem som er huket på.
  const a = utvidUtvalg(["sjanger:Electric blues"], ["sjanger:Electric blues", "artist:muddy"], SYNLIGE, NAA, GENRE_DESCS);
  assert.equal(a.kilde.get("artist:muddy"), "sjanger", "kandidat, så den kan hukes på igjen");
  assert.equal(a.grunnlag, null, "ingen artister eller sjangre huket på: ingen tiår");
  assert.deepEqual([...a.kilde.keys()].filter((v) => v.startsWith("tiår:")), []);
  // Avhuket artist: tiårene hans forsvinner, de andre står.
  const b = utvidUtvalg(["metasjanger:Blues"], ["artist:muddy"], SYNLIGE, NAA, GENRE_DESCS);
  assert.equal(b.kilde.has("artist:muddy"), true);
  assert.deepEqual([...b.kilde.keys()].filter((v) => v.startsWith("tiår:")), ["tiår:1920", "tiår:1930"]);
  // Avhuket metasjanger: alt under står fortsatt i lista.
  const c = utvidUtvalg(["metasjanger:Blues"], ["metasjanger:Blues"], SYNLIGE, NAA, GENRE_DESCS);
  assert.equal(c.kilde.has("sjanger:Electric blues"), true);
  assert.equal(c.kilde.has("artist:bessie"), true);
});

test("barnAv: det en avkryssing tar med seg", () => {
  const meta = barnAv("metasjanger:Blues", SYNLIGE);
  for (const v of ["sjanger:Blues", "sjanger:Electric blues", "sjanger:Blues rock", "artist:bessie", "artist:robert", "artist:muddy"]) assert.ok(meta.includes(v), v);
  assert.equal(meta.includes("artist:miles"), false);
  assert.deepEqual(barnAv("sjanger:Electric blues", SYNLIGE), ["artist:muddy"]);
  assert.deepEqual(barnAv("sjanger:Blues", SYNLIGE), ["artist:bessie", "artist:robert"]);
  assert.deepEqual(barnAv("artist:bessie", SYNLIGE), []);
  assert.deepEqual(barnAv("tiår:1950", SYNLIGE), []);
  assert.deepEqual(barnAv("sjanger:Finnes ikke", SYNLIGE), []);
});

test("utvidUtvalg: uten artister i utvalget kommer tiårene fra sjangrenes perioder", () => {
  const { kilde, grunnlag } = utvidUtvalg(["sjanger:Electric blues"], ["artist:muddy"], SYNLIGE, NAA, GENRE_DESCS);
  assert.equal(grunnlag, "sjangre");
  assert.deepEqual([...kilde.keys()].filter((v) => v.startsWith("tiår:")), ["tiår:1940", "tiår:1950", "tiår:1960"], "1945–1969");
  // Blues uten sluttår: fra 1900 til i dag.
  const aapen = utvidUtvalg(["sjanger:Blues"], ["artist:bessie", "artist:robert"], SYNLIGE, NAA, GENRE_DESCS).kilde;
  assert.equal([...aapen.keys()].filter((v) => v.startsWith("tiår:")).length, 13);
});

test("settSammen med bortvalg: heftet uten det bortvalgte, treet med alt", () => {
  const m = settSammen({ valg: ["metasjanger:Blues", "tech:elgitar"], fravalg: ["artist:robert", "tiår:1960"] }, DATA, STUDENT);
  assert.equal(m.tom, false);
  assert.deepEqual(m.familier.map((F) => F.navn), ["Blues"]);
  const blues = m.familier[0];
  assert.deepEqual(blues.hodeKort.artister.map((a) => a.navn), ["Bessie Smith"], "Robert Johnson er huket bort");
  // Frøets Blues-familie har tre noder: Blues, Electric blues og Blues rock.
  assert.deepEqual(blues.sjangre.map((k) => k.navn), ["Electric blues", "Blues rock"]);
  assert.deepEqual(m.bakteppe.map((b) => b.tiaar), [1920, 1930, 1940, 1950], "1960 er huket bort");
  assert.deepEqual(m.tellinger, { metasjangre: 1, sjangre: 3, artister: 2, undersjangre: 0, tiaar: 4, innovasjoner: 1, instrumenter: 0, historier: 0, sider: 0, bortvalgt: 2 });
  // Treet
  const F = m.tre.familier[0];
  assert.equal(F.navn, "Blues");
  assert.equal(F.valgt, true);
  assert.equal(F.kanVelges, true);
  assert.deepEqual(F.sjangre.map((k) => [k.navn, k.med, k.kilde]), [["Blues", true, "metasjanger"], ["Electric blues", true, "metasjanger"], ["Blues rock", true, "metasjanger"]]);
  assert.deepEqual(F.sjangre[0].artister.map((a) => [a.navn, a.med, a.kilde]), [["Bessie Smith", true, "metasjanger"], ["Robert Johnson", false, "metasjanger"]]);
  assert.deepEqual(m.tre.tiaar.map((t) => [t.tiaar, t.med, t.kilde]), [[1920, true, "utledet"], [1930, true, "utledet"], [1940, true, "utledet"], [1950, true, "utledet"], [1960, false, "utledet"]]);
  assert.equal(m.tre.grunnlag, "artister");
  assert.deepEqual(m.tre.annet.map((x) => [x.navn, x.type, x.med]), [["Elektrisk gitar", "tech", true]]);
});

test("settSammen: en valgt metasjanger uten noe under seg står i treet, ikke i heftet", () => {
  const m = settSammen({ valg: ["metasjanger:Blues"], fravalg: ["sjanger:Blues", "sjanger:Electric blues", "sjanger:Blues rock", "artist:bessie", "artist:robert", "artist:muddy"] }, DATA, STUDENT);
  assert.deepEqual(m.familier, []);
  assert.equal(m.tre.familier.length, 1);
  assert.equal(m.tre.familier[0].valgt, true);
  assert.equal(m.tre.familier[0].sjangre.every((k) => !k.med), true);
  assert.equal(m.tom, true, "ingenting huket på = tomt hefte, selv om lista har poster");
  assert.equal(foreslaaTittel(m), "Pensumutdrag", "ingenting i heftet gir standardtittelen");
});

test("settSammen: en avhuket metasjanger står i treet som valgt, men ikke med", () => {
  const m = settSammen({ valg: ["metasjanger:Blues"], fravalg: ["metasjanger:Blues", "sjanger:Blues", "sjanger:Electric blues", "sjanger:Blues rock", "artist:bessie", "artist:robert", "artist:muddy"] }, DATA, STUDENT);
  const F = m.tre.familier[0];
  assert.equal(F.valgt, true);
  assert.equal(F.med, false);
  assert.equal(F.sjangre.length, 3, "alt under står igjen som alternativer");
  assert.equal(m.tom, true);
  const paa = settSammen({ valg: ["metasjanger:Blues"], fravalg: [] }, DATA, STUDENT);
  assert.equal(paa.tre.familier[0].med, true);
});

test("settSammen: en ukjent metasjanger havner i mangler, og et valgt tiår står som valgt i treet", () => {
  const m = settSammen({ valg: ["metasjanger:Finnes ikke", "tiår:1950"], fravalg: [] }, DATA, STUDENT);
  assert.deepEqual(m.mangler, [{ vis: "metasjanger:Finnes ikke", grunn: "finnes-ikke" }]);
  assert.deepEqual(m.tre.tiaar, [{ vis: "tiår:1950", tiaar: 1950, med: true, kilde: "valgt" }]);
  assert.equal(m.tre.grunnlag, null);
  assert.deepEqual(m.tre.annet.map((x) => [x.navn, x.grunn]), [["Finnes ikke", "finnes-ikke"]]);
});

test("settSammen: en artist som følger med en metasjanger, men ikke har valgt sjangerkort, står som løs artist", () => {
  const m = settSammen({ valg: ["metasjanger:Blues"], fravalg: ["sjanger:Electric blues", "sjanger:Blues rock"] }, DATA, STUDENT);
  const blues = m.familier[0];
  assert.deepEqual(blues.sjangre, []);
  assert.deepEqual(blues.loseArtister.map((a) => a.navn), ["Muddy Waters"], "Muddy følger metasjangeren selv om sjangeren hans er huket bort");
});

// ---------------------------------------------------------------------------
//  Tittelforslaget (brukerens regler 2026-09-25)
// ---------------------------------------------------------------------------

test("tittel: kjøreplanens tittel går foran alt", () => {
  const m = settSammen(["artist:bessie", "artist:miles"], DATA, STUDENT);
  assert.equal(foreslaaTittel(m, { planTittel: "  Time 4: fra Delta til Chicago " }), "Time 4: fra Delta til Chicago");
});

test("tittel: én metasjanger med årsspenn", () => {
  assert.equal(foreslaaTittel(settSammen(["artist:bessie", "artist:muddy"], DATA, STUDENT)), "Blues 1923–1964");
  assert.equal(foreslaaTittel(settSammen(["sjanger:Blues", "artist:bessie"], DATA, STUDENT)), "Blues fra 1900", "åpent sluttår gir «fra»");
  assert.equal(foreslaaTittel(settSammen(["artist:beyonce"], DATA, STUDENT)), "R&B fra 1997");
  assert.equal(foreslaaTittel(settSammen(["undersjanger:Delta blues"], DATA, STUDENT)), "Blues", "uten årstall bare navnet");
});

test("tittel: flere metasjangre listes, høyst tre", () => {
  assert.equal(foreslaaTittel(settSammen(["artist:miles", "artist:bessie"], DATA, STUDENT)), "Blues og Jazz");
  assert.equal(foreslaaTittel(settSammen(["artist:miles", "artist:bessie", "artist:beyonce"], DATA, STUDENT)), "Blues, Jazz og R&B");
  const fire = settSammen(["artist:miles", "artist:bessie", "artist:beyonce", "undersjanger:Ukjenttag"], DATA, STUDENT);
  // Den løse undersjanger-bolken teller ikke som metasjanger.
  assert.equal(foreslaaTittel(fire), "Blues, Jazz og R&B");
  const modell = { familier: [{ navn: "Blues" }, { navn: "Jazz" }, { navn: "R&B" }, { navn: "Gospel" }, { navn: "Country" }], bakteppe: [] };
  assert.equal(foreslaaTittel(modell), "Blues, Jazz, R&B og 2 til");
});

test("tittel: bare tiår, bare innovasjoner, ellers «Pensumutdrag»", () => {
  assert.equal(foreslaaTittel(settSammen(["tiår:1950"], DATA, STUDENT)), "1950-tallet");
  assert.equal(foreslaaTittel(settSammen(["tiår:1950", "tiår:1920"], DATA, STUDENT)), "1920- og 1950-tallet");
  assert.equal(foreslaaTittel({ familier: [], bakteppe: [{ tiaar: 1950 }, { tiaar: 1960 }, { tiaar: 1970 }] }), "1950-, 1960- og 1970-tallet");
  assert.equal(foreslaaTittel(settSammen(["tech:elgitar"], DATA, STUDENT)), "Innovasjoner");
  assert.equal(foreslaaTittel(settSammen(["instrument:Gitar"], DATA, STUDENT)), "Instrumentene");
  assert.equal(foreslaaTittel(settSammen([], DATA, STUDENT)), "Pensumutdrag");
  assert.equal(foreslaaTittel(null), "Pensumutdrag");
});

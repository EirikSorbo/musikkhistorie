// Metasjanger-oversikten i visningsmodus (v5.94, brukerønske 2026-10-01).
import { test } from "node:test";
import assert from "node:assert/strict";
import { artisterGruppert, lytteeksemplerGruppert, forbindelser, tidsrom, ANDRE } from "../../js/metaoversikt-modell.js?v=6.15";

const art = (id, name, metaGenre, mainGenre, extra = {}) =>
  ({ id, name, metaGenre, mainGenre, status: "active", ...extra });
const yt = (id) => `https://www.youtube.com/watch?v=${id}`;

test("artisterGruppert: metaGenre avgjør, gruppert under første sjanger i familien, kronologisk", () => {
  const familie = ["New Orleans jazz", "Swing", "Bebop"];
  const artister = [
    art("a", "Charlie Parker", "Jazz", ["Bebop"], { influenceStart: 1945 }),
    art("b", "Louis Armstrong", "Jazz", ["New Orleans jazz", "Swing"], { influenceStart: 1923 }),
    art("c", "Dizzy Gillespie", "Jazz", ["bebop"], { influenceStart: 1944 }),
    art("d", "Ella Fitzgerald", "Jazz", ["Vocal jazz"], { subGenre: ["Swing"], influenceStart: 1935 }),
    art("e", "Ukjent", "Jazz", ["Noe annet"]),
    art("f", "Muddy Waters", "Blues", ["Swing"]),               // annen metasjanger
    art("g", "Skjult", "Jazz", ["Swing"], { priority: -1 }),    // skjult for studenter
    art("h", "Venter", "Jazz", ["Swing"], { status: "pending" }),
  ];
  const ut = artisterGruppert("Jazz", artister, familie);
  assert.deepEqual(ut.map((g) => [g.sjanger, g.artister.map((a) => a.name)]), [
    ["New Orleans jazz", ["Louis Armstrong"]],
    ["Swing", ["Ella Fitzgerald"]],              // via undersjangeren
    ["Bebop", ["Dizzy Gillespie", "Charlie Parker"]],  // 1944 før 1945, store/små bokstaver
    [ANDRE, ["Ukjent"]],
  ]);
});

test("lytteeksemplerGruppert: samme regel som spillelistene, hvert eksempel én gang", () => {
  const familie = ["Soul", "Funk"];
  const artister = [
    art("a", "James Brown", "R&B", ["Soul", "Funk"], { influenceStart: 1956, musicExamples: [
      { label: "Please, Please, Please", url: yt("aaaaaaaaaaa"), genre: "Soul", year: 1956 },
      { label: "Cold Sweat", url: yt("bbbbbbbbbbb"), genre: "Funk", year: 1967 },
      { label: "Umerket", url: yt("ccccccccccc") },          // første sjanger som tar den: Soul
      { label: "Hip-hop-eksempel", url: yt("ddddddddddd"), genre: "Early hip-hop" },  // annen familie
    ] }),
    art("b", "Sly", "R&B", ["Funk"], { influenceStart: 1967, musicExamples: [
      { label: "Spotify", url: "https://open.spotify.com/track/x" },   // ingen video-ID
    ] }),
    art("c", "Uten lenke", "R&B", ["Soul"], { musicExamples: [{ label: "Ingen url" }] }),
  ];
  const { grupper, ider, antall } = lytteeksemplerGruppert(artister, familie);
  assert.deepEqual(grupper.map((g) => [g.sjanger, g.eksempler.map((e) => e.tittel)]), [
    ["Soul", ["Please, Please, Please", "Umerket"]],
    ["Funk", ["Cold Sweat", "Spotify"]],
  ]);
  assert.equal(antall, 4);
  assert.deepEqual(ider, ["aaaaaaaaaaa", "ccccccccccc", "bbbbbbbbbbb"], "bare YouTube, i listas rekkefølge");
  assert.equal(grupper[0].eksempler[0].artist, "James Brown");
  assert.equal(grupper[0].eksempler[0].year, 1956);
});

test("forbindelser: sjangrene utenfor familien den vokste ut av og førte videre til", () => {
  const tre = [
    { id: "ws", l: "Work songs", g: null, p: [] },
    { id: "bl", l: "Blues", g: "Blues", p: ["ws"] },
    { id: "go", l: "Gospel", g: "Gospel", p: ["ws"] },
    { id: "rb", l: "R&B", g: "R&B", p: ["bl", "go"] },
    { id: "so", l: "Soul", g: "R&B", p: ["rb", "go"] },
    { id: "rr", l: "Rock'n'roll", g: "Rock", p: ["rb", "bl"] },
    { id: "di", l: "Disco", g: "Klubbmusikk", p: ["so"] },
  ];
  const { fra, til } = forbindelser("R&B", tre);
  assert.deepEqual(fra.map((n) => n.l), ["Blues", "Gospel"], "unike, i treets rekkefølge, ikke familiens egne");
  assert.deepEqual(til.map((n) => n.l), ["Rock'n'roll", "Disco"]);
  assert.deepEqual(forbindelser("Blues", tre).fra.map((n) => n.l), ["Work songs"], "røtter uten metasjanger teller");
  // Med startår: i tidsrekkefølge, uten årstall sist.
  const aar = { bl: 1905, go: 1890, rr: 1954 };
  const sortert = forbindelser("R&B", tre, (n) => aar[n.id] ?? null);
  assert.deepEqual(sortert.fra.map((n) => n.l), ["Gospel", "Blues"]);
  assert.deepEqual(sortert.til.map((n) => n.l), ["Rock'n'roll", "Disco"], "Disco uten årstall sist");
});

test("tidsrom: tidligste startår, og «i dag» når en periode er åpen", () => {
  assert.equal(tidsrom([{ status: "ok", from: 1954, to: 1975 }, { status: "ok", from: 1965, to: 1985 }]), "1954–1985");
  assert.equal(tidsrom([{ status: "ok", from: 1900, to: null }, { status: "mangler" }]), "1900–i dag");
  assert.equal(tidsrom([{ status: "mangler" }]), null);
});

// --- Visning-kortet og artistgalleriet (v5.96, brukerønske 2026-10-01) ------------
import { readFileSync } from "node:fs";
import { VIS_TYPER } from "../../js/vis-lenke.js?v=6.15";
const kilde = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("artistgalleriet: samme artister som «Artister»-knappen, stopp i kjøreplaner, knapp på sjangerkortet", () => {
  assert.ok(VIS_TYPER.has("galleri") && VIS_TYPER.has("oversikt"));
  const vs = kilde("js/explore-visningssider.js");
  assert.match(vs, /const artister = artistsInGenre\(getState\(\)\.artists, sjanger\);/);
  assert.doesNotMatch(vs, /imageCredit|fmtCredit/, "ingen kreditering i galleriet");
  assert.match(kilde("js/explore-apne.js"), /case "galleri": return openArtistGalleri\(apne\.id\);/);
  assert.match(kilde("js/genealogy.js"), /\(n\.g && onShowGallery\) \? `<button type="button" class="btn ghost small gx-galleri-btn">Galleri<\/button>` : ""/);
  // v5.97 (brukerønske 2026-10-01): knappen står i appen også, som de andre.
  assert.doesNotMatch(kilde("css/styles.css"), /\.gx-galleri-btn \{ display: none/);
  // Galleriene og oversiktene står bare i Visning-editorens søk.
  const sok = kilde("js/search.js");
  assert.match(sok, /if \(visningsflater\) \{[\s\S]*post\("galleri", n\.l,/);
  assert.match(kilde("js/visning.js"), /visningsflater: true/);
});

test("Visning-kortet i Det store bildet: bare på lerretet, bare for læreren", () => {
  assert.match(kilde("js/explore.js"), /if \(!erPresentasjon\(\)\) sbModal\.querySelector\("#sb-visning"\)\?\.remove\(\);/);
  assert.match(kilde("js/feature-flags.js"), /"sb-visning":\s+true,/);
  assert.match(kilde("js/presentasjon.js"), /const laererKort = kort\.id === "sb-visning" && erLaerer;/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { metaRader } from "../../js/ui-helpers.js?v=5.69";
import { FLATER, NIVAA_SEKT, erSynlig, faktaSynlig, artistPlassering, ytMaal, ytEmbedUrl, ytWatchUrl, parseTid, formatTid, normaliserPlaner, klampStopp, nyPlanId, planPosisjon, tellerTekst, planOversikt, lytteeksempelNavn, OVERSIKT_KATEGORIER, innsettingsIndeks, medStoppSattInn, presTast, samleTast, PRES_TASTER } from "../../js/presentasjon-modell.js?v=5.69";

// Brukerens visningsregler 2026-09-17 (v5.29). Låst her fordi de er
// pedagogiske valg, ikke implementasjonsdetaljer: et uskyldig «rydd opp i
// nivålistene» skal ikke kunne dra kildene inn på lerretet igjen.
test("kilder vises ALDRI i visning, uansett nivå eller unntak", () => {
  for (const flate of ["artist", "sjanger", "tech", "tiår", "historie"]) {
    for (const n of [1, 2, 3]) {
      assert.equal(erSynlig(flate, "kilder", n), false, `${flate} nivå ${n}`);
    }
    assert.equal(erSynlig(flate, "kilder", 3, { [`${flate}.kilder`]: true }), false,
      "heller ikke som unntak i tannhjul-panelet");
  }
  // Og de står ikke i panelet, så ingen død avkryssing.
  for (const seksjoner of Object.values(FLATER)) {
    assert.ok(!seksjoner.some((s) => s.id === "kilder"));
  }
});

test("artistnivåene: bilde + levetid + innflytelseslinje + lytteeksempler, så tags", () => {
  const synlig = (sekt, n) => erSynlig("artist", sekt, n);
  // Nivå 1: bildet i fokus, levetiden og stripa — ikke årstallslinja.
  assert.equal(synlig("bilde", 1), true);
  assert.equal(synlig("stripe", 1), true);
  assert.equal(faktaSynlig("artist", "levetid", 1), true);
  // Bare levetiden av faktalinjene på lerretet (brukerkrav 2026-09-19: heller
  // ikke innflytelse, plateselskap og virkested på nivå 3).
  for (const n of [1, 2, 3]) {
    for (const linje of ["innflytelse", "plateselskap", "virkested"]) {
      assert.equal(faktaSynlig("artist", linje, n), false, `${linje} på nivå ${n}`);
    }
    assert.equal(faktaSynlig("artist", "levetid", n), true);
  }
  // Lytteeksemplene står fra nivå 1 (brukerkrav 2026-09-19).
  assert.equal(synlig("lytte", 1), true);
  assert.equal(synlig("lytte", 2), true);
  // Nivå 2: + instrument/sjanger.
  assert.equal(synlig("tags", 1), false);
  assert.equal(synlig("tags", 2), true);
  assert.equal(synlig("beskrivelse", 2), false, "beskrivelsen hører til nivå 3");
  // Nivå 3: alt annet, unntatt oppsummeringspunktene (de hører til nivå 2).
  for (const { id } of FLATER.artist) assert.equal(synlig(id, 3), id !== "punkter", id);
});

test("tiårstekstene står fra nivå 1, tech skjuler kategori og instrument", () => {
  assert.equal(erSynlig("tiår", "tekst", 1), true);
  assert.equal(erSynlig("tiår", "tidslinje", 1), true);
  for (const n of [1, 2, 3]) {
    assert.equal(faktaSynlig("tech", "kategori", n), false, `nivå ${n}`);
    assert.equal(faktaSynlig("tech", "instrument", n), false, `nivå ${n}`);
  }
  // Årstallene på innovasjonskortet er hele poenget og blir stående.
  assert.equal(faktaSynlig("tech", "oppfunnet", 1), true);
  assert.equal(faktaSynlig("tech", "tatt-i-bruk", 1), true);
  // Artistens instrumentlinje er en annen flate og røres ikke.
  assert.equal(faktaSynlig("artist", "instrument", 1), true);
});

test("parseTid/formatTid: mm:ss, sekunder og YouTubes egen t-form", () => {
  assert.equal(parseTid("1:23"), 83);
  assert.equal(parseTid("83"), 83);
  assert.equal(parseTid("1m30s"), 90);
  assert.equal(parseTid("2h3m4s"), 7384);
  assert.equal(parseTid("1:02:03"), 3723);
  assert.equal(parseTid("90s"), 90);
  assert.equal(parseTid(""), null);
  assert.equal(parseTid("tull"), null);
  assert.equal(parseTid("-5"), null);
  assert.equal(parseTid(null), null);
  assert.equal(formatTid(83), "1:23");
  assert.equal(formatTid(3723), "1:02:03");
  assert.equal(formatTid(0), "", "0 er «fra start», ikke et tidspunkt");
  assert.equal(formatTid(null), "");
  // Rundtur for et tidspunkt læreren faktisk kan sette.
  assert.equal(parseTid(formatTid(275)), 275);
});

test("starttidspunkt: leses fra lenka og settes i embed-URL", () => {
  assert.equal(ytMaal("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90").start, 90);
  assert.equal(ytMaal("https://youtu.be/dQw4w9WgXcQ?t=1m30s").start, 90);
  assert.equal(ytMaal("https://www.youtube.com/watch?v=dQw4w9WgXcQ").start, null);
  assert.match(ytEmbedUrl("https://youtu.be/dQw4w9WgXcQ", { start: 90 }), /[?&]start=90/);
  // Tidspunkt i selve lenka brukes når kalleren ikke overstyrer.
  assert.match(ytEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42"), /[?&]start=42/);
  assert.match(ytEmbedUrl("https://youtu.be/dQw4w9WgXcQ", { jsapi: true }), /enablejsapi=1/);
  assert.match(ytWatchUrl("dQw4w9WgXcQ", null, 90), /[?&]t=90/);
  // Rundtur: stoppets deler → adresse → samme tidspunkt tilbake.
  assert.equal(ytMaal(ytWatchUrl("dQw4w9WgXcQ", null, 275)).start, 275);
});

// yt-stoppene (v5.28) lagrer bare ID-ene; ytWatchUrl må gi en adresse ytMaal
// leser tilbake identisk, ellers spiller stoppet noe annet enn det som ble
// tatt opp.
test("ytWatchUrl: rundtur mot ytMaal", () => {
  assert.deepEqual(ytMaal(ytWatchUrl("dQw4w9WgXcQ", null)), { video: "dQw4w9WgXcQ", list: null, start: null });
  assert.deepEqual(ytMaal(ytWatchUrl("dQw4w9WgXcQ", "PLabc123456789")), { video: "dQw4w9WgXcQ", list: "PLabc123456789", start: null });
  assert.deepEqual(ytMaal(ytWatchUrl(null, "PLabc123456789")), { video: null, list: "PLabc123456789", start: null });
});

test("normaliserPlaner: vasker søppel og bevarer det gyldige", () => {
  const raa = {
    plan1: { tittel: "  Uke 39  ", laget: "2026-09-17", stopp: [
      { vis: "artist:abc", nivaa: 2, unntak: { "artist.kilder": false } },
      { vis: "varmekart", nivaa: "7" },          // nivå utenfor 1-3 droppes
      { vis: "" },                                // tomt mål droppes
      { nivaa: 2 },                               // mangler vis: droppes
      { vis: "tiår:1950:society", unntak: ["x"] } // unntak må være objekt
    ] },
    plan2: "ikke et objekt",
    plan3: { stopp: "ikke en liste" },
  };
  const ut = normaliserPlaner(raa);
  assert.deepEqual(Object.keys(ut).sort(), ["plan1", "plan3"]);
  assert.equal(ut.plan1.tittel, "Uke 39");
  assert.deepEqual(ut.plan1.stopp, [
    { vis: "artist:abc", nivaa: 2, unntak: { "artist.kilder": false } },
    { vis: "varmekart" },
    { vis: "tiår:1950:society" },
  ]);
  assert.equal(ut.plan3.tittel, "(uten tittel)");
  assert.deepEqual(ut.plan3.stopp, []);
  assert.deepEqual(normaliserPlaner(null), {});
  assert.deepEqual(normaliserPlaner("tull"), {});
});

test("klampStopp: klemmes i [0, antall-1], ingen rundgang", () => {
  assert.equal(klampStopp(0, 5), 0);
  assert.equal(klampStopp(4, 5), 4);
  assert.equal(klampStopp(5, 5), 4, "etter siste stopp blir man stående");
  assert.equal(klampStopp(-1, 5), 0, "før første stopp blir man stående");
  assert.equal(klampStopp(2.9, 5), 2);
  assert.equal(klampStopp(NaN, 5), 0);
  assert.equal(klampStopp(3, 0), 0, "tom plan gir alltid 0");
});

test("nyPlanId: URL-vennlig og unik nok", () => {
  const id = nyPlanId();
  assert.match(id, /^plan-[a-z2-9]{6}$/);
  assert.notEqual(nyPlanId(), nyPlanId());
});

const kilde = (f) => readFileSync(new URL(`../../js/${f}`, import.meta.url), "utf8");

test("nivålistene bruker bare seksjoner flaten faktisk har", () => {
  for (const [flate, nivaaer] of Object.entries(NIVAA_SEKT)) {
    const gyldige = new Set(FLATER[flate].map((s) => s.id));
    for (const [nivaa, liste] of Object.entries(nivaaer)) {
      for (const sekt of liste) {
        assert.ok(gyldige.has(sekt), `${flate} nivå ${nivaa}: «${sekt}» finnes ikke i FLATER`);
      }
    }
  }
});

test("erSynlig: nivåene er kumulative og nivå 3 viser alt (unntatt oppsummeringspunktene)", () => {
  for (const [flate, seksjoner] of Object.entries(FLATER)) {
    for (const { id } of seksjoner) {
      // Punktene er det ene bevisste unntaket (brukervalg 2026-09-24): nivå 3
      // viser hele beskrivelsen UTEN punktene. Se testen under.
      if (id === "punkter") continue;
      assert.equal(erSynlig(flate, id, 3), true, `${flate}.${id} må vises på Alt`);
      // Kumulativt: alt nivå 1 viser, viser også nivå 2.
      if (erSynlig(flate, id, 1)) {
        assert.equal(erSynlig(flate, id, 2), true, `${flate}.${id}: nivå 2 må omfatte nivå 1`);
      }
    }
  }
  assert.equal(erSynlig("artist", "verk", 1), false);
  assert.equal(erSynlig("sjanger", "beskrivelse", 2), true);
});

test("oppsummeringspunktene (v5.50): bare nivå 2, der de erstatter beskrivelsen", () => {
  for (const flate of ["artist", "sjanger", "tech"]) {
    assert.ok(FLATER[flate].some((s) => s.id === "punkter"), `${flate} har punkt-seksjonen i tannhjulpanelet`);
    for (const harPunkter of [true, false]) {
      assert.equal(erSynlig(flate, "punkter", 1, {}, { harPunkter }), false, `${flate}: ikke på nivå 1`);
      assert.equal(erSynlig(flate, "punkter", 2, {}, { harPunkter }), true, `${flate}: på nivå 2`);
      assert.equal(erSynlig(flate, "punkter", 3, {}, { harPunkter }), false, `${flate}: ikke på nivå 3`);
      assert.equal(erSynlig(flate, "beskrivelse", 3, {}, { harPunkter }), true, `${flate}: hele beskrivelsen på nivå 3`);
    }
  }
  // Nivå 2: punktene erstatter beskrivelsen der den stod før (sjanger, tech)...
  for (const flate of ["sjanger", "tech"]) {
    assert.equal(erSynlig(flate, "beskrivelse", 2, {}, { harPunkter: true }), false, `${flate}: punktene i stedet`);
    assert.equal(erSynlig(flate, "beskrivelse", 2, {}, { harPunkter: false }), true, `${flate}: uten punkter står beskrivelsen som før`);
  }
  // ...og artistkortet har aldri hatt beskrivelsen på nivå 2.
  assert.equal(erSynlig("artist", "beskrivelse", 2, {}, { harPunkter: false }), false);
  // Unntak i tannhjulpanelet overstyrer, begge veier.
  assert.equal(erSynlig("sjanger", "punkter", 3, { "sjanger.punkter": true }), true);
  assert.equal(erSynlig("sjanger", "beskrivelse", 2, { "sjanger.beskrivelse": true }, { harPunkter: true }), true);
  assert.equal(erSynlig("tech", "punkter", 2, { "tech.punkter": false }, { harPunkter: true }), false);
  // Andre flater bryr seg ikke.
  assert.equal(erSynlig("tiår", "tekst", 2, {}, { harPunkter: true }), true);
});

test("erSynlig: unntak overstyrer nivået begge veier", () => {
  assert.equal(erSynlig("artist", "verk", 1, { "artist.verk": true }), true);
  assert.equal(erSynlig("artist", "bilde", 3, { "artist.bilde": false }), false);
  // Unntak for en annen flate smitter ikke.
  assert.equal(erSynlig("tech", "beskrivelse", 1, { "artist.beskrivelse": true }), false);
});

test("erSynlig: ukjent flate viser alt, ukjent seksjon bare på Alt", () => {
  assert.equal(erSynlig("varmekart", "hvasomhelst", 1), true);
  assert.equal(erSynlig("artist", "ny-seksjon", 2), false);
  assert.equal(erSynlig("artist", "ny-seksjon", 3), true);
});

// Kontrakten mot renderne: hver seksjons-ID modellen lover, må finnes som
// data-sekt i koden som tegner flaten — ellers er tannhjul-panelet en løgn.
test("data-sekt-merkingen dekker modellens seksjoner", () => {
  // Tiår og historie leses fra SIN modal i markupen, ikke hele fila: begge
  // har data-sekt="tekst", så et fjernet merke på historien slapp gjennom
  // (audit v5.42 funn 9).
  const modaler = kilde("explore-modals.js");
  const modal = (id) => {
    const start = modaler.indexOf(`id="${id}"`);
    const slutt = modaler.indexOf('class="modal-backdrop"', start + 1);
    return modaler.slice(start, slutt === -1 ? undefined : slutt);
  };
  const hvor = {
    artist: kilde("ui.js"),
    sjanger: kilde("genealogy.js"),
    tech: kilde("ui-tech.js"),
    tiår: modal("modal-decade-view"),
    historie: modal("modal-historier"),
  };
  for (const [flate, seksjoner] of Object.entries(FLATER)) {
    for (const { id } of seksjoner) {
      // Renderne merker via sekt("id", …)-hjelperen (ui-helpers.js), statisk
      // markup via literal data-sekt="id" — begge er gyldige merker.
      const ok = hvor[flate].includes(`data-sekt="${id}"`) || hvor[flate].includes(`sekt("${id}"`);
      assert.ok(ok, `${flate}.${id} mangler data-sekt-merke i renderen`);
    }
  }
});

test("kilder vises aldri på lerretet, heller ikke kildelister uten seksjonsmerke", () => {
  const css = readFileSync(new URL("../../css/styles.css", import.meta.url), "utf8");
  assert.match(css, /body\.presentasjon \.kilder \{ display: none !important; \}/);
  // Klassen kommer bare fra buildKilderList, så regelen dekker alle flatene.
  assert.match(kilde("util.js"), /return `<div class="kilder"><strong>/);
});

test("ytMaal: vanlige lenkeformer gir video-ID", () => {
  assert.deepEqual(ytMaal("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), { video: "dQw4w9WgXcQ", list: null, start: null });
  assert.deepEqual(ytMaal("https://youtu.be/dQw4w9WgXcQ"), { video: "dQw4w9WgXcQ", list: null, start: null });
  assert.deepEqual(ytMaal("https://www.youtube.com/shorts/dQw4w9WgXcQ"), { video: "dQw4w9WgXcQ", list: null, start: null });
  assert.deepEqual(ytMaal("https://www.youtube.com/embed/dQw4w9WgXcQ"), { video: "dQw4w9WgXcQ", list: null, start: null });
  assert.deepEqual(ytMaal("https://music.youtube.com/watch?v=dQw4w9WgXcQ"), { video: "dQw4w9WgXcQ", list: null, start: null });
  assert.equal(ytMaal("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123456789").list, "PLabc123456789");
});

test("ytMaal: spilleliste uten video gir list alene", () => {
  assert.deepEqual(ytMaal("https://www.youtube.com/playlist?list=PLabc123456789"), { video: null, list: "PLabc123456789", start: null });
});

test("ytMaal: søkelenker og annet gir null (åpner som før)", () => {
  // Slektstreets spor er YouTube-SØK — de kan ikke bygges inn.
  assert.equal(ytMaal("https://www.youtube.com/results?search_query=robert+johnson"), null);
  assert.equal(ytMaal("https://open.spotify.com/track/abc"), null);
  assert.equal(ytMaal("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(ytMaal("ikke en url"), null);
  assert.equal(ytMaal("javascript:alert(1)"), null);
  assert.equal(ytMaal(""), null);
});

test("ytEmbedUrl: nocookie-domenet, autoplay, og videoseries for lister", () => {
  assert.equal(
    ytEmbedUrl("https://youtu.be/dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
  assert.equal(
    ytEmbedUrl("https://www.youtube.com/playlist?list=PLabc123456789"),
    "https://www.youtube-nocookie.com/embed/videoseries?autoplay=1&rel=0&list=PLabc123456789");
  assert.equal(ytEmbedUrl("https://www.youtube.com/results?search_query=x"), null);
});

// --- Oversiktskortet (v5.36) --------------------------------------------------
// Brukerkrav 2026-09-18: hver kjøreplan åpner og slutter med et kort som viser
// innholdet gruppert etter kategori, ikke i planens rekkefølge.

test("planPosisjon: oversikt først, stoppene, oppsummering sist, ingen rundgang", () => {
  assert.deepEqual(planPosisjon(0, 3), { pos: 0, oversikt: "start" });
  assert.deepEqual(planPosisjon(1, 3), { pos: 1, stopp: 0 });
  assert.deepEqual(planPosisjon(3, 3), { pos: 3, stopp: 2 });
  assert.deepEqual(planPosisjon(4, 3), { pos: 4, oversikt: "slutt" });
  assert.deepEqual(planPosisjon(99, 3), { pos: 4, oversikt: "slutt" }, "ett trykk for mye blir stående");
  assert.deepEqual(planPosisjon(-5, 3), { pos: 0, oversikt: "start" });
  // «stopp=1» i en lenke fra før v5.36 peker fortsatt på første stopp.
  assert.equal(planPosisjon(1, 3).stopp, 0);
});

test("tellerTekst: ord på oversiktskortene, n/antall på stoppene", () => {
  assert.equal(tellerTekst(0, 12), "Oversikt");
  assert.equal(tellerTekst(1, 12), "1/12");
  assert.equal(tellerTekst(12, 12), "12/12");
  assert.equal(tellerTekst(13, 12), "Oppsummering");
});

const artister = [
  { id: "a1", name: "Elvis Presley", musicExamples: [{ label: "Hound Dog", url: "https://www.youtube.com/watch?v=abcdefghijk" }] },
  { id: "a2", name: "Chuck Berry" },
  { id: "a3", name: "Aretha Franklin" },
];
const tech = [{ id: "t1", name: "Elektrisk gitar" }];
const vis = (...v) => v.map((x) => ({ vis: x }));

test("lytteeksempelNavn: tittel og artist, eller null når videoen er ukjent", () => {
  assert.equal(lytteeksempelNavn("abcdefghijk", artister), "Hound Dog (Elvis Presley)");
  assert.equal(lytteeksempelNavn("zzzzzzzzzzz", artister), null);
  assert.equal(lytteeksempelNavn("", artister), null);
  assert.equal(lytteeksempelNavn("abcdefghijk", undefined), null);
});

test("planOversikt: grupperer etter kategori i fast rekkefølge, ikke etter planen", () => {
  const g = planOversikt(vis("tiår:1960:tech", "artist:a2", "tech:t1", "yt:abcdefghijk", "sjanger:Rock", "instrument:Gitar", "varmekart"), { artister, tech });
  assert.deepEqual(g.map((k) => k.id), ["artister", "lytteeksempler", "sjangre", "tiaar", "teknologi", "instrumenter", "oversikter"]);
  assert.deepEqual(OVERSIKT_KATEGORIER.map((k) => k.id), g.map((k) => k.id), "alle kategoriene er i bruk her");
  assert.equal(g.find((k) => k.id === "teknologi").punkter[0].tekst, "Elektrisk gitar");
  assert.equal(g.find((k) => k.id === "oversikter").punkter[0].tekst, "Varmekartet");
});

test("planOversikt: alfabetisk innenfor kategorien, tiårene i tidsrekkefølge", () => {
  const g = planOversikt(vis("artist:a2", "artist:a1", "artist:a3", "tiår:1970", "tiår:1950:tech", "tiår:1950"), { artister });
  assert.deepEqual(g[0].punkter.map((p) => p.tekst), ["Aretha Franklin", "Chuck Berry", "Elvis Presley"]);
  const tiaar = g.find((k) => k.id === "tiaar").punkter;
  assert.deepEqual(tiaar.map((p) => `${p.tekst} ${p.detalj}`),
    ["1950-tallet samfunn", "1950-tallet teknologi", "1970-tallet samfunn"]);
  assert.ok(tiaar.every((p) => !("sort" in p)), "sorteringsnøkkelen lekker ikke ut");
});

test("planOversikt: hvert mål én gang, og punktet peker på FØRSTE forekomst", () => {
  const g = planOversikt(vis("artist:a1", "tiår:1950", "artist:a1", "tiår:1950:society", "yt:abcdefghijk::45", "yt:abcdefghijk::130"), { artister });
  assert.deepEqual(g[0].punkter, [{ tekst: "Elvis Presley", detalj: "", stopp: 0 }]);
  assert.equal(g.find((k) => k.id === "tiaar").punkter.length, 1, "uten modus og «society» er samme visning");
  // Samme video fra to ulike tidspunkt er to lyttemomenter.
  assert.deepEqual(g.find((k) => k.id === "lytteeksempler").punkter.map((p) => p.detalj), ["fra 0:45", "fra 2:10"]);
});

test("planOversikt: slettede mål og ugyldige stopp utelates, tom plan gir ingen kategorier", () => {
  const g = planOversikt(vis("artist:borte", "tech:borte", "ukjent:x", "artist:a3"), { artister, tech });
  assert.deepEqual(g.map((k) => k.id), ["artister"]);
  assert.deepEqual(g[0].punkter, [{ tekst: "Aretha Franklin", detalj: "", stopp: 3 }]);
  assert.deepEqual(planOversikt([], { artister }), []);
  assert.deepEqual(planOversikt(undefined), []);
});

test("planOversikt: kobling med nodenavn, historie og visninger får lesbare navn", () => {
  const nodeNavn = (id) => ({ blues: "Blues", rnb: "R&B" })[id];
  const g = planOversikt(vis("kobling:blues__rnb", "historie:Rock", "historie", "side:rotter", "teknologi", "himmel"), { nodeNavn });
  const tekster = (id) => g.find((k) => k.id === id).punkter.map((p) => p.tekst);
  assert.deepEqual(tekster("sjangre"), ["Blues → R&B", "Historien om Rock"]);
  assert.deepEqual(tekster("oversikter"), ["Røtter før 1910", "Sjangerhimmelen", "Sjangerhistoriene"]);
  assert.deepEqual(tekster("teknologi"), ["Teknologioversikten"]);
});

// Avspilleren og lerretet bor i DOM/CSS: lås kildeformen.
test("avspilleren bruker de virtuelle posisjonene, og planene starter på oversikten", () => {
  const spiller = kilde("presentasjon.js");
  assert.match(spiller, /const p = planPosisjon\(i, plan\.stopp\.length\);/);
  assert.match(spiller, /if \(p\.oversikt\) visOversikt\(\);/);
  assert.match(spiller, /teller\.textContent = plan \? tellerTekst\(stoppIdx, plan\.stopp\.length\) : "…";/);
  assert.doesNotMatch(kilde("visning.js"), /presentasjon=\$\{[^}]*\}&stopp=1/,
    "startlenka skal ikke hoppe over oversiktskortet");
  // Navnene i oversikten kommer fra listene, som kan lande etter planen.
  for (const side of ["landing.js", "tre-page.js"]) {
    const src = kilde(side);
    assert.match(src, /onArtists: \(\) => \{[\s\S]*?presPlanTikk\(\);[\s\S]*?\},/, `${side}: onArtists`);
    assert.match(src, /onTech: \(\) => \{[^}]*presPlanTikk\(\);/, `${side}: onTech`);
  }
});

test("lerretet: hvit bakgrunn uten uskarphet, brede kort, verktøylinja utenfor skalaen", () => {
  const css = readFileSync(new URL("../../css/styles.css", import.meta.url), "utf8");
  const lerret = css.match(/body\.presentasjon \.modal-backdrop \{[^}]*\}/)?.[0] || "";
  assert.match(lerret, /background: var\(--bg\);/);
  assert.match(lerret, /backdrop-filter: none;/);
  assert.match(css, /body\.presentasjon \.modal-backdrop:where\(:not\(#modal-sok\)\) > \.modal:where\(:not\(\.modal-narrow, \.modal-valg, \.modal-hjelp, \.modal-verktoy\)\) \{[^}]*max-width: none;/,
    "kortene skal gå over hele bredden, med vektløse unntak");
  assert.match(css, /#pres-bar \{[^}]*font-size: 15px;/, "verktøylinja skal ikke vokse med tekstskalaen");
  assert.match(css, /html\.pres-modus \{ font-size: clamp\(/);
});

// --- «Legg til her» (v5.37) ---------------------------------------------------
// Brukerkrav 2026-09-18: en avstikker midt i fremvisningen legges inn i
// kjøreplanen der man står.

test("innsettingsIndeks: rett etter gjeldende stopp, først fra oversikten, sist fra oppsummeringen", () => {
  // Plan med 4 stopp: posisjon 0 = oversikt, 1..4 = stoppene, 5 = oppsummering.
  assert.equal(innsettingsIndeks(0, 4), 0, "fra oversikten: først i planen");
  assert.equal(innsettingsIndeks(1, 4), 1, "etter stopp 1 (indeks 0)");
  assert.equal(innsettingsIndeks(3, 4), 3, "etter stopp 3");
  assert.equal(innsettingsIndeks(4, 4), 4, "etter siste stopp: sist");
  assert.equal(innsettingsIndeks(5, 4), 4, "fra oppsummeringen: sist");
  assert.equal(innsettingsIndeks(99, 4), 4);
  assert.equal(innsettingsIndeks(0, 0), 0, "tom plan: blir første stopp");
  // Det nye stoppet står alltid på posisjon indeks + 1.
  const i = innsettingsIndeks(2, 4);
  assert.equal(planPosisjon(i + 1, 5).stopp, i);
});

test("medStoppSattInn: setter inn på plass, rører ikke inndata, kaster for ukjent plan", () => {
  const planer = {
    p1: { tittel: "Uke 39", laget: "", stopp: [{ vis: "artist:a" }, { vis: "artist:b" }] },
    p2: { tittel: "Annen", laget: "", stopp: [{ vis: "tiår:1950" }] },
  };
  const kopi = JSON.parse(JSON.stringify(planer));
  const ut = medStoppSattInn(planer, "p1", 1, { vis: "yt:abcdefghijk", nivaa: 2 });
  assert.deepEqual(ut.p1.stopp.map((x) => x.vis), ["artist:a", "yt:abcdefghijk", "artist:b"]);
  assert.equal(ut.p1.stopp[1].nivaa, 2, "detaljnivået følger med");
  assert.deepEqual(planer, kopi, "inndata er urørt");
  assert.equal(ut.p2, planer.p2, "de andre planene står som de var");
  assert.equal(ut.p1.tittel, "Uke 39");
  assert.deepEqual(medStoppSattInn(planer, "p1", 99, { vis: "x" }).p1.stopp.at(-1), { vis: "x" }, "klemmes til slutten");
  assert.deepEqual(medStoppSattInn(planer, "p1", -3, { vis: "x" }).p1.stopp[0], { vis: "x" }, "klemmes til starten");
  assert.throws(() => medStoppSattInn(planer, "borte", 0, { vis: "x" }), /finnes ikke lenger/);
});

test("«Legg til her»: knappen kun for lærerøkter, lagring på ferske planer, lokal kopi først", () => {
  const spiller = kilde("presentasjon.js");
  assert.match(spiller, /knapp\.hidden = !\(erLaerer && plan\);/, "skjult uten lærerøkt og plan");
  assert.match(spiller, /onAuthChange\(\(user\) => \{ erLaerer = erLaererBruker\(user\); oppdaterLeggTil\(\); \}\);/);
  assert.match(spiller, /const indeks = innsettingsIndeks\(stoppIdx, plan\.stopp\.length\);/);
  assert.match(spiller, /const stopp = \{ vis, nivaa \};/, "stoppet lagres med detaljnivået som vises");
  assert.match(spiller, /plan = await settInnStopp\(planId, indeks, stopp\);/);
  assert.match(spiller, /stoppIdx = indeks \+ 1;/, "det nye stoppet blir posisjonen");
  const meny = kilde("plan-meny.js");
  assert.match(meny, /const planer = medStoppSattInn\(planerNaa\(\), planId, indeks, stopp\);/,
    "lagringen bygger på de ferskeste planene i state, ikke avspillerens kopi");
  assert.match(meny, /erLaerer = erLaererBruker\(user\);/, "menyen og knappen deler lærersjekken");
});

// --- Hurtigtastene (v5.38, brukerens utvalg 2026-09-18) -----------------------

const tast = (key, ekstra = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, ...ekstra });

test("presTast: kjøreplan-tastene virker bare når en plan spilles", () => {
  const medPlan = { plan: true };
  assert.equal(presTast(tast("Home"), medPlan), "oversikt");
  assert.equal(presTast(tast("End"), medPlan), "oppsummering");
  assert.equal(presTast(tast("t"), medPlan), "tilStoppet");
  assert.equal(presTast(tast("T"), medPlan), "tilStoppet");
  assert.equal(presTast(tast("+"), medPlan), "leggTil");
  assert.equal(presTast(tast("ArrowRight"), medPlan), "neste");
  assert.equal(presTast(tast("ArrowLeft"), medPlan), "forrige");
  for (const k of ["Home", "End", "t", "+", "ArrowRight", "PageDown"]) {
    assert.equal(presTast(tast(k), { plan: false }), null, `${k} uten plan`);
  }
});

test("presTast: visningstastene virker i all presentasjon", () => {
  assert.equal(presTast(tast("f")), "fullskjerm");
  assert.equal(presTast(tast("F")), "fullskjerm");
  assert.equal(presTast(tast("a")), "skala");
  assert.equal(presTast(tast("b")), "svart");
  assert.equal(presTast(tast(".")), "svart", "klikkernes svart-skjerm-knapp");
  assert.equal(presTast(tast("?", { shiftKey: true })), "hjelp", "? krever Shift på de fleste tastatur");
  assert.equal(presTast(tast("2")), "nivaa2");
  assert.equal(presTast(tast("x")), null);
});

test("presTast: aldri i skrivefelt eller med modifikator, unntatt klikkernes PageUp/PageDown", () => {
  const felt = { plan: true, iSkrivefelt: true };
  for (const k of ["f", "a", "b", "?", "t", "+", "Home", "End", "ArrowRight", "1"]) {
    assert.equal(presTast(tast(k), felt), null, `${k} i skrivefelt`);
  }
  assert.equal(presTast(tast("PageDown"), felt), "neste");
  assert.equal(presTast(tast("PageUp"), felt), "forrige");
  for (const mod of ["ctrlKey", "metaKey", "altKey"]) {
    assert.equal(presTast(tast("f", { [mod]: true }), { plan: true }), null, `${mod}+F tilhører nettleseren`);
    assert.equal(presTast(tast("PageDown", { [mod]: true }), { plan: true }), null);
  }
});

test("presTast: av/på-tastene reagerer ikke på auto-gjentak, blaingen gjør det", () => {
  const holdt = (k) => presTast(tast(k, { repeat: true }), { plan: true });
  for (const k of ["f", "a", "b", ".", "?", "t", "+"]) assert.equal(holdt(k), null, k);
  assert.equal(holdt("ArrowRight"), "neste");
  assert.equal(holdt("2"), "nivaa2");
});

test("presTast: mellomrom og K spiller og pauser, men bare når lytteeksempelet ligger øverst (funn 10)", () => {
  assert.equal(presTast(tast(" "), { video: true }), "spill");
  assert.equal(presTast(tast("k"), { video: true }), "spill");
  assert.equal(presTast(tast("K"), { video: true, plan: true }), "spill");
  assert.equal(presTast(tast(" ")), null, "uten video: mellomrom ruller siden som før");
  assert.equal(presTast(tast("k")), null);
  assert.equal(presTast(tast(" "), { video: true, iSkrivefelt: true }), null, "aldri i skrivefelt");
  assert.equal(presTast(tast(" ", { repeat: true }), { video: true }), null, "en holdt tast veksler ikke fram og tilbake");
});

test("samleTast: + legger til, Ctrl/Cmd+Z angrer, aldri i skrivefelt", () => {
  assert.equal(samleTast(tast("+")), "leggTil");
  assert.equal(samleTast(tast("z", { ctrlKey: true })), "angre");
  assert.equal(samleTast(tast("Z", { metaKey: true })), "angre");
  assert.equal(samleTast(tast("z", { ctrlKey: true, shiftKey: true })), null, "Ctrl+Shift+Z er «gjør om»");
  assert.equal(samleTast(tast("z")), null);
  assert.equal(samleTast(tast("+", { repeat: true })), null);
  assert.equal(samleTast(tast("z", { ctrlKey: true, repeat: true })), null, "en holdt Cmd/Ctrl+Z angrer bare én gang (audit v5.42 funn 27)");
  assert.equal(samleTast(tast("Z", { metaKey: true, repeat: true })), null);
  assert.equal(samleTast(tast("+"), { iSkrivefelt: true }), null);
  assert.equal(samleTast(tast("z", { ctrlKey: true }), { iSkrivefelt: true }), null, "feltets egen angre");
});

test("PRES_TASTER: hver tast i oversikten har en handling i presTast", () => {
  // Søket og Esc bor andre steder (vis-lenke og modalene); resten skal
  // presTast kjenne, ellers lover oversikten noe som ikke virker.
  const andreSteder = new Set(["/", "Ctrl/Cmd+K", "Esc"]);
  const navn = { "→": "ArrowRight", "←": "ArrowLeft", "Mellomrom": " " };
  for (const g of PRES_TASTER) {
    for (const r of g.rader) {
      for (const t of r.taster) {
        if (andreSteder.has(t)) continue;
        assert.ok(presTast(tast(navn[t] || t), { plan: true, video: true }), `«${t}» (${r.hva}) mangler i presTast`);
      }
    }
  }
  assert.ok(PRES_TASTER.find((g) => g.gruppe === "Kjøreplan").plan, "kjøreplan-gruppa vises bare med plan");
});

test("tastene er koblet: én felles lytter, svart skjerm i capture, samleøkt etter presentasjonen, Ctrl/Cmd+S i editoren", () => {
  const spiller = kilde("presentasjon.js");
  assert.match(spiller, /const h = presTast\(e, \{\n\s*plan: !!plan,\n\s*iSkrivefelt: erSkrivefelt\(document\.activeElement\),\n\s*video: topOpenModal\(\)\?\.id === "modal-yt",\n\s*\}\);/);
  assert.match(spiller, /case "spill": return veksleYtAvspilling\(\);/);
  assert.match(spiller, /case "oppsummering": return gaTilStopp\(plan\.stopp\.length \+ 1\);/);
  assert.doesNotMatch(spiller, /function wirePlanTaster/, "den gamle pil-lytteren er erstattet");
  assert.match(spiller, /e\.stopPropagation\(\);\n\s*vekslSvart\(\);\n\s*\}, true\);/, "Esc skal hente bildet, ikke lukke kortet bak");
  assert.match(spiller, /if \(!erLaerer \|\| !plan \|\| !vis/, "tasten + har samme lærervakt som knappen");
  const samle = kilde("plan-innsamling.js");
  assert.match(samle, /window\.addEventListener\("keydown", \(e\) => \{\n\s*if \(!økt \|\| e\.defaultPrevented\) return;/,
    "samleøkta lytter på window og viker for en kjøreplan i samme fane");
  const editor = kilde("visning.js");
  assert.match(editor, /if \(!kladd \|\| !m\.classList\.contains\("open"\)\) return;\n\s*e\.preventDefault\(\);\n\s*lagre\(\);/);
});

// --- Brukerens finpuss 2026-09-19 (v5.39) -------------------------------------

test("metaRader: «Instrument: …» og «Sjanger: …» som egne rader, med samme knapper som før", () => {
  const html = metaRader({ instrument: "Vokal", mainGenre: ["Blues"], subGenre: [] });
  assert.match(html, /<span class="meta-etikett">Instrument:<\/span> <button class="tag tag-instrument" data-instrument="Vokal">Vokal<\/button>/);
  assert.match(html, /<span class="meta-etikett">Sjanger:<\/span> <button class="tag tag-sjanger" data-sjanger="Blues">Blues<\/button>/);
  assert.equal((html.match(/class="meta-rad"/g) || []).length, 2, "tom undersjanger-liste gir ingen rad");
  assert.ok(html.indexOf("Instrument:") < html.indexOf("Sjanger:"), "instrumentet først, som før");
  // Flertall og komma mellom flere verdier; undersjangre på egen rad.
  const flere = metaRader({ mainGenre: ["Blues", "Rock"], subGenre: ["Delta blues", "Chicago blues"] });
  assert.match(flere, /Sjangre:<\/span> <button[^>]*>Blues<\/button><span class="meta-skille">, <\/span><button[^>]*>Rock<\/button>/);
  assert.match(flere, /Undersjangre:<\/span>/);
  assert.doesNotMatch(flere, /Instrument/, "uten instrument ingen instrumentrad");
  // Escaping og tomme artister.
  assert.match(metaRader({ mainGenre: ['R&B "x"'] }), /data-sjanger="R&amp;B &quot;x&quot;"/);
  assert.equal(metaRader({}), "");
  assert.equal(metaRader(null), "");
});

test("finpussen er koblet: rader på artistkortet, skalerende tidslinje, kort side om side, kino for lytteeksempler", () => {
  const css = readFileSync(new URL("../../css/styles.css", import.meta.url), "utf8");
  // Utenfor presentasjonen skal studentenes bobler se ut som før.
  assert.match(css, /\.meta-rad \{ display: contents; \}/);
  assert.match(css, /\.meta-etikett, \.meta-skille \{ display: none; \}/);
  assert.match(kilde("ui.js"), /sekt\("tags", `<div class="meta" style="margin-bottom:12px">\$\{metaRader\(a\)\}<\/div>`\)/);
  // Årstallsraden følger skriften: fast px-høyde lot tallene falle ned i sporet.
  const akse = css.match(/\.ai-axis \{[^}]*\}/)?.[0] || "";
  assert.match(akse, /height: 1\.3em;/);
  assert.doesNotMatch(akse, /height: \d+px/);
  assert.match(css, /\.ai-track \{[^}]*height: 0\.75rem;/);
  // «Rediger pensumet»: kortene side om side, ikke én kolonne.
  assert.match(css, /\.dash-grid--smale \{ grid-template-columns: repeat\(auto-fill, minmax\(150px, 240px\)\);/);
  assert.match(readFileSync(new URL("../../teacher.html", import.meta.url), "utf8"), /class="dash-grid dash-grid--smale"/);
  // Lytteeksempler i kinovisning som standard i presentasjonen; egen
  // fullskjerm bare når siden ikke alt er i fullskjerm, og den forlates ved lukking.
  const spiller = kilde("yt-spiller.js");
  assert.match(spiller, /settKino\(m, erPresentasjon\(\)\);/);
  // Fullskjerm for HELE siden, ikke modalen (audit v5.42 funn 11 og 21), og
  // utgangen venter ett tikk, så neste lytteeksempel beholder den.
  assert.match(spiller, /const side = document\.documentElement;\n\s*if \(paa && !document\.fullscreenElement && side\.requestFullscreen\)/);
  assert.match(spiller, /if \(!egenFullskjerm \|\| erKino\(m\)\) return;/);
  assert.match(spiller, /onError: \(e\) => \{\n\s*if \(!\[100, 101, 150, 153\]\.includes\(e\?\.data\)\) return;/, "funn 36");
  assert.match(spiller, /document\.activeElement\?\.id === "yt-iframe"/, "funn 10: fokus tilbake fra iframen");
  assert.match(spiller, /function lukkSpiller\(\) \{\n\s*const m = document\.getElementById\("modal-yt"\);\n\s*if \(m\) forlatEgenFullskjerm\(m\);/);
  assert.match(css, /body\.presentasjon #modal-yt\.yt-kino > \.modal\.modal-yt-boks \{[^}]*max-width: none;/);
});

// --- Artistkortets lerret (v5.40, brukerens oppsett 2026-09-19) ----------------

test("artistPlassering: tidslinja øverst, bilde og beslektede til høyre, resten til venstre", () => {
  assert.equal(artistPlassering("stripe"), "topp", "innflytelseslinja over bildet");
  assert.equal(artistPlassering("bilde"), "hoyre");
  assert.equal(artistPlassering("beslektede"), "hoyre", "beslektede artister under bildet");
  for (const id of ["fakta", "tags", "beskrivelse", "verk", "lytte", "kilder"]) {
    assert.equal(artistPlassering(id), "venstre", id);
  }
  assert.equal(artistPlassering("noe-nytt"), "venstre", "ukjente seksjoner i tekstspalta");
  // Alle artistkortets seksjoner har en plass.
  for (const { id } of FLATER.artist) assert.ok(["topp", "hoyre", "venstre"].includes(artistPlassering(id)));
});

test("lerretet bygges før nivået settes, og ryddes etterpå", () => {
  const spiller = kilde("presentasjon.js");
  const kroppen = spiller.slice(spiller.indexOf("function brukNivaaPaa("), spiller.indexOf("function brukNivaa()"));
  assert.ok(kroppen.indexOf("ordneArtistLerret(modal)") < kroppen.indexOf('querySelectorAll("[data-sekt]")'),
    "skillelinja må finnes før synligheten regnes ut");
  assert.ok(kroppen.indexOf("ryddArtistLerret(modal)") > kroppen.indexOf('querySelectorAll("[data-fakta]")'));
  const modul = kilde("pres-artist.js");
  assert.match(modul, /if \(!modal \|\| modal\.querySelector\("\.pres-artist"\)\) return;/, "idempotent mot observatøren");
  assert.match(modul, /if \(s\.dataset\.sekt === "tags"\) venstre\.appendChild\(lag\("hr", "pres-linje"\)\);/);
  assert.doesNotMatch(modul, /from "\.\/(store|ui|explore-context)\.js/, "modulen skal kunne lastes uten Firebase");
  const css = readFileSync(new URL("../../css/styles.css", import.meta.url), "utf8");
  assert.match(css, /body\.presentasjon \.pres-artist-spalter \{\n\s*display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 42%\);/);
  assert.doesNotMatch(css, /float: right; width: 42%; max-width: 42%;/, "flytebildet fra v5.30 er erstattet av spaltene");
});

// --- Visning-vinduet bak presentasjonsikonet (v5.41) --------------------------
// Brukerkrav 2026-09-19: alt som har med visning å gjøre, under ikonet.

test("ikonet er én lenke på alle fire sidene, og åpner vinduet der modulen finnes", () => {
  const html = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
  for (const side of ["index.html", "tre.html", "teacher.html", "student.html"]) {
    assert.match(html(side), /<a href="index\.html\?visning=1" class="nav-icon" data-visning title="Visning" aria-label="Visning">/, side);
    assert.doesNotMatch(html(side), /href="index\.html\?presentasjon=1"/, `${side}: den gamle lenka`);
  }
  for (const f of ["landing.js", "tre-page.js", "teacher.js"]) {
    assert.match(kilde(f), /initVisning\(\);/, `${f} kobler ikonet`);
    assert.match(kilde(f), /visningTikk\(\);/, `${f} holder lista fersk`);
  }
  const vis = kilde("visning.js");
  assert.match(vis, /document\.querySelectorAll\("\[data-visning\]"\)\.forEach/);
  assert.match(vis, /get\("visning"\)/, "?visning=1 åpner vinduet ved lasting (fra skjemasiden)");
});

test("kjøreplanene er flyttet fra lærerens Oversikt inn i vinduet", () => {
  const laerer = readFileSync(new URL("../../teacher.html", import.meta.url), "utf8");
  assert.doesNotMatch(laerer, /btn-t-kjoreplaner/, "kortet i Oversikt er borte");
  assert.doesNotMatch(laerer, /id="modal-presentasjoner"/, "den gamle editoren er borte");
  const vis = kilde("visning.js");
  for (const del of ['id="vis-fri"', 'id="vis-avslutt"', 'id="pres-adm-liste"', 'id="pres-adm-rediger"', 'class="modal modal-wide modal-verktoy"']) {
    assert.ok(vis.includes(del), `vinduet mangler ${del}`);
  }
  // Redigeringsknappene bare i lærerøkter; Spill av for alle.
  assert.match(vis, /\$\{erLaerer \? `\n\s*<button type="button" class="btn ghost small" data-pres-samle/);
  assert.match(vis, /erLaerer = erLaererBruker\(user\);/);
  // Ærlig lagring: kladden beholdes når skrivingen feiler.
  assert.match(vis, /if \(!\(await vakt\(savePlan\(kladd\.id, plan\)\)\)\) return;   \/\/ kladden beholdes/);
  assert.doesNotMatch(vis, /guardTeacherAction\(/, "lærersidens guard svelget feilen");
  assert.doesNotMatch(vis, /from "\.\/teacher-state\.js/, "modulen skal virke utenfor lærersiden");
});

test("fri visning etter en kjøreplan starter uten den gamle planen", () => {
  const spiller = kilde("presentasjon.js");
  assert.match(spiller, /\} else \{\n(\s*\/\/[^\n]*\n)*\s*for \(const k of \[LAGRING\.plan, LAGRING\.stopp\]\) \{ try \{ sessionStorage\.removeItem\(k\); \} catch \(e\) \{\} \}/);
  assert.match(spiller, /export function aktivPlanId\(\)/);
  assert.match(spiller, /export function avsluttPresentasjon\(\)/);
});

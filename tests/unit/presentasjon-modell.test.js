import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FLATER, NIVAA_SEKT, erSynlig, faktaSynlig, ytMaal, ytEmbedUrl, ytWatchUrl, parseTid, formatTid, normaliserPlaner, klampStopp, nyPlanId } from "../../js/presentasjon-modell.js?v=5.35";

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

test("artistnivåene: bilde + levetid + innflytelseslinje, så tags og lytte", () => {
  const synlig = (sekt, n) => erSynlig("artist", sekt, n);
  // Nivå 1: bildet i fokus, levetiden og stripa — ikke årstallslinja.
  assert.equal(synlig("bilde", 1), true);
  assert.equal(synlig("stripe", 1), true);
  assert.equal(faktaSynlig("artist", "levetid", 1), true);
  assert.equal(faktaSynlig("artist", "innflytelse", 1), false, "stripa erstatter årene");
  assert.equal(faktaSynlig("artist", "innflytelse", 2), false);
  assert.equal(faktaSynlig("artist", "innflytelse", 3), true);
  assert.equal(faktaSynlig("artist", "plateselskap", 2), false);
  // Nivå 2: + instrument/sjanger og lytteeksempler.
  assert.equal(synlig("tags", 1), false);
  assert.equal(synlig("tags", 2), true);
  assert.equal(synlig("lytte", 2), true);
  assert.equal(synlig("beskrivelse", 2), false, "beskrivelsen hører til nivå 3");
  // Nivå 3: alt annet.
  for (const { id } of FLATER.artist) assert.equal(synlig(id, 3), true, id);
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

test("erSynlig: nivåene er kumulative og nivå 3 viser alt", () => {
  for (const [flate, seksjoner] of Object.entries(FLATER)) {
    for (const { id } of seksjoner) {
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
  const hvor = {
    artist: kilde("ui.js"),
    sjanger: kilde("genealogy.js"),
    tech: kilde("ui-tech.js"),
    tiår: kilde("explore-modals.js"),
    historie: kilde("explore-modals.js"),
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

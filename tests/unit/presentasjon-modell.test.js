import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FLATER, NIVAA_SEKT, erSynlig, ytMaal, ytEmbedUrl, normaliserPlaner, klampStopp, nyPlanId } from "../../js/presentasjon-modell.js?v=5.27";

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
  assert.equal(erSynlig("artist", "kilder", 1), false);
  assert.equal(erSynlig("artist", "beskrivelse", 2), true);
});

test("erSynlig: unntak overstyrer nivået begge veier", () => {
  assert.equal(erSynlig("artist", "kilder", 1, { "artist.kilder": true }), true);
  assert.equal(erSynlig("artist", "bilde", 3, { "artist.bilde": false }), false);
  // Unntak for en annen flate smitter ikke.
  assert.equal(erSynlig("tech", "kilder", 1, { "artist.kilder": true }), false);
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
  assert.deepEqual(ytMaal("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), { video: "dQw4w9WgXcQ", list: null });
  assert.deepEqual(ytMaal("https://youtu.be/dQw4w9WgXcQ"), { video: "dQw4w9WgXcQ", list: null });
  assert.deepEqual(ytMaal("https://www.youtube.com/shorts/dQw4w9WgXcQ"), { video: "dQw4w9WgXcQ", list: null });
  assert.deepEqual(ytMaal("https://www.youtube.com/embed/dQw4w9WgXcQ"), { video: "dQw4w9WgXcQ", list: null });
  assert.deepEqual(ytMaal("https://music.youtube.com/watch?v=dQw4w9WgXcQ"), { video: "dQw4w9WgXcQ", list: null });
  assert.equal(ytMaal("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123456789").list, "PLabc123456789");
});

test("ytMaal: spilleliste uten video gir list alene", () => {
  assert.deepEqual(ytMaal("https://www.youtube.com/playlist?list=PLabc123456789"), { video: null, list: "PLabc123456789" });
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

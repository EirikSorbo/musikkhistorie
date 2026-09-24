import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, safeUrl, throttle, wikimediaThumb, WIKI_THUMB_WIDTHS, dropboxDirectUrl, kanoniskJson } from "../../js/util.js?v=5.44";

test("escapeHtml escaper alle spesialtegn", () => {
  assert.equal(
    escapeHtml(`<a href="x" onclick='y'>&</a>`),
    "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
  );
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("safeUrl slipper kun http/https gjennom", () => {
  assert.equal(safeUrl("https://example.com/x?y=1"), "https://example.com/x?y=1");
  assert.equal(safeUrl("http://example.com"), "http://example.com");
  assert.equal(safeUrl("HTTPS://EXAMPLE.COM"), "HTTPS://EXAMPLE.COM");
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("data:text/html,<script>x</script>"), "");
  assert.equal(safeUrl("vbscript:x"), "");
  assert.equal(safeUrl("  javascript:alert(1)"), "");
  assert.equal(safeUrl(""), "");
  assert.equal(safeUrl(null), "");
});

// Dropbox-delingslenker må gjøres om for at <audio> skal kunne spille dem.
// «dl=1» gir en nedlasting (application/binary + attachment) som iOS Safari
// nekter å spille — det var nettopp den appen selv la på tidligere.
test("dropboxDirectUrl gjør delingslenker om til direkte lydlenker", () => {
  assert.equal(
    dropboxDirectUrl("https://www.dropbox.com/scl/fi/abc/Ep.m4a?rlkey=nokkel&dl=1"),
    "https://dl.dropboxusercontent.com/scl/fi/abc/Ep.m4a?rlkey=nokkel"
  );
  // dl=0 (rå «kopier lenke») og gamle /s/-lenker skal samme vei.
  assert.equal(
    dropboxDirectUrl("https://www.dropbox.com/scl/fi/abc/Ep.m4a?rlkey=nokkel&st=tegn&dl=0"),
    "https://dl.dropboxusercontent.com/scl/fi/abc/Ep.m4a?rlkey=nokkel&st=tegn"
  );
  assert.equal(
    dropboxDirectUrl("https://www.dropbox.com/s/xyz/gammel.mp3?dl=0"),
    "https://dl.dropboxusercontent.com/s/xyz/gammel.mp3"
  );
  // Allerede riktig vert: dl=1 må likevel vekk, ellers blir det attachment.
  assert.equal(
    dropboxDirectUrl("https://dl.dropboxusercontent.com/scl/fi/abc/Ep.m4a?rlkey=n&dl=1"),
    "https://dl.dropboxusercontent.com/scl/fi/abc/Ep.m4a?rlkey=n"
  );
});

test("dropboxDirectUrl lar alt annet være i fred", () => {
  assert.equal(dropboxDirectUrl("https://eksempel.no/episode.mp3"), "https://eksempel.no/episode.mp3");
  // uc*-vertene er Dropbox' egne kortlevde omdirigeringsmål — ikke rør dem.
  assert.equal(
    dropboxDirectUrl("https://uc1.dl.dropboxusercontent.com/cd/0/inline/ABC/file?dl=1"),
    "https://uc1.dl.dropboxusercontent.com/cd/0/inline/ABC/file?dl=1"
  );
  // Samme sperre som safeUrl: ingenting utenom http/https slipper gjennom.
  assert.equal(dropboxDirectUrl("javascript:alert(1)"), "");
  assert.equal(dropboxDirectUrl(""), "");
  assert.equal(dropboxDirectUrl(null), "");
});

test("wikimediaThumb skriver om Wikimedia-originaler til thumbnail", () => {
  // Original → thumbnail. Bredden rundes OPP til nærmeste tillatte størrelse:
  // Wikimedia svarer 400 på alt utenfor trappa (400 → 500).
  assert.equal(
    wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/0/06/Kool_Herc.jpg", 400),
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Kool_Herc.jpg/500px-Kool_Herc.jpg"
  );
  // Prosentkodede tegn i filnavnet bevares uendret i begge segmenter (800 → 960).
  assert.equal(
    wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/f/f5/Django_Reinhardt_%28Gottlieb_07301%29.jpg", 800),
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Django_Reinhardt_%28Gottlieb_07301%29.jpg/960px-Django_Reinhardt_%28Gottlieb_07301%29.jpg"
  );
  // SVG rasteriseres til PNG (…px-Fil.svg.png). 300 → 330.
  assert.equal(
    wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/a/ab/Logo.svg", 300),
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Logo.svg/330px-Logo.svg.png"
  );
  // Andre prosjekter enn commons virker også.
  assert.equal(
    wikimediaThumb("https://upload.wikimedia.org/wikipedia/en/1/1a/Cover.jpg", 400),
    "https://upload.wikimedia.org/wikipedia/en/thumb/1/1a/Cover.jpg/500px-Cover.jpg"
  );
  // Null for alt som ikke er en omskrivbar Wikimedia-original.
  assert.equal(wikimediaThumb("https://example.com/photo.jpg", 400), null);       // annen vert
  assert.equal(wikimediaThumb("https://media.snl.no/media/1/x.jpg", 400), null);  // annen vert
  assert.equal(                                                                    // alt en thumbnail
    wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/David.jpg/960px-David.jpg", 400),
    null
  );
  assert.equal(wikimediaThumb("", 400), null);
  assert.equal(wikimediaThumb(null, 400), null);
});

// Wikimedia avviser alt utenfor trappa (400 «Use thumbnail sizes listed on
// w.wiki/GHai»). Denne testen er hele vernet mot at en fremtidig kaller ber om
// en «pen» bredde som 160 eller 480 og stille faller tilbake på originalen.
test("wikimediaThumb runder bredden opp til en bredde Wikimedia godtar", () => {
  const w = (width) => {
    const url = wikimediaThumb("https://upload.wikimedia.org/wikipedia/commons/0/06/X.jpg", width);
    return Number(url.match(/\/(\d+)px-/)[1]);
  };
  for (const allowed of WIKI_THUMB_WIDTHS) assert.equal(w(allowed), allowed, `${allowed} er lovlig og skal stå`);
  assert.equal(w(160), 250, "himmelens 160 → 250");
  assert.equal(w(480), 500, "artistkortenes 480 → 500");
  assert.equal(w(1), 120);
  assert.equal(w(5000), 1920, "over trappa: største tillatte, ikke en 400-URL");
});

test("throttle: kjører umiddelbart, slår sammen storm, kjører siste på slutten", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let calls = 0;
  let lastArg;
  const fn = throttle((x) => { calls++; lastArg = x; }, 400);

  fn("a");                 // leading — kjører umiddelbart
  assert.equal(calls, 1);
  assert.equal(lastArg, "a");

  fn("b"); fn("c"); fn("d"); // innenfor vinduet — samles, ikke kjørt ennå
  assert.equal(calls, 1);

  t.mock.timers.tick(400);   // vinduet utløper → siste kall kjøres
  assert.equal(calls, 2);
  assert.equal(lastArg, "d");

  t.mock.timers.tick(1000);  // ingen nye kall → ingen ekstra kjøring
  assert.equal(calls, 2);
});

// Feilbanneret sa «publiser oppdaterte regler» for ALLE lesefeil. Da kvoten
// gikk tom 2026-09-02 pekte den derfor på feil årsak for både studenter og
// lærer. Kildesjekk: teksten bygges i en DOM-lytter og kan ikke enhetstestes.
test("feilbanneret skiller mellom Firestore-feilkodene", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../js/shared.js", import.meta.url), "utf8");
  for (const kode of ["resource-exhausted", "permission-denied", "unavailable"]) {
    assert.ok(src.includes(`"${kode}"`) || src.includes(`${kode}:`),
      `mangler egen tekst for ${kode}`);
  }
  // Match selve VERDIEN for resource-exhausted (audit-funn 39e): en kommentar
  // i fila nevner også «lesekvoten», så et fila-vidt søk besto selv om
  // meldingen ble byttet tilbake til en generisk regel-forklaring.
  assert.match(src, /"resource-exhausted":\s*\n?\s*"[^"]*lesekvote/i,
    "kvotefeilen må forklares som kvote, ikke regler");
  // Instruksen om omlasting (v5.35, audit-funn 35): SDK-en fjerner en lytter
  // for godt etter en feil, så en åpen fane kommer seg aldri av seg selv.
  for (const kode of ["resource-exhausted", "unavailable"]) {
    assert.match(src, new RegExp(`"?${kode}"?:\\s*\\n?\\s*"[^"]*last siden på nytt`, "i"),
      `${kode}-teksten må be om omlasting`);
  }
  assert.doesNotMatch(src, /banner\.textContent = `Kunne ikke laste data fra databasen \(\$\{/,
    "teksten skal ikke lenger være hardkodet til én årsak");
});

// Returkoden leses opp muntlig i klasserommet og tastes på telefon: fast
// lengde, alfabet uten forvekslbare tegn, og romslig normalisering av input.
test("genererReturKode: lengde, alfabet og normalisering", async () => {
  const { genererReturKode, normaliserReturKode, RETUR_KODE_ALFABET, RETUR_KODE_LENGDE }
    = await import("../../js/util.js?v=5.44");
  for (let i = 0; i < 50; i++) {
    const k = genererReturKode();
    assert.equal(k.length, RETUR_KODE_LENGDE);
    assert.ok([...k].every((c) => RETUR_KODE_ALFABET.includes(c)), `ugyldig tegn i ${k}`);
  }
  for (const t of ["O", "0", "I", "1", "L", "U", "V"]) {
    assert.equal(RETUR_KODE_ALFABET.includes(t), false, `forvekslbart tegn ${t} i alfabetet`);
  }
  assert.equal(normaliserReturKode("  x7 k-2p "), "X7K2P");
  assert.equal(normaliserReturKode(null), "");
});

// Audit v5.19 funn 3: fire nye app-tekster hadde tankestrek, i strid med
// husregelen. Meldingen for treg innsending er nå ÉN delt konstant — lås at
// den er tankestrek-fri og faktisk brukes alle tre stedene.
test("TREG_SENDING_MELDING: delt, og uten tankestrek", async () => {
  const { TREG_SENDING_MELDING } = await import("../../js/util.js?v=5.44");
  const fs = await import("node:fs");
  const les = (f) => fs.readFileSync(new URL(`../../js/${f}`, import.meta.url), "utf8");
  assert.ok(!TREG_SENDING_MELDING.includes("—"), "husregel: ingen tankestrek i appens tekster");
  assert.ok(TREG_SENDING_MELDING.includes("Ikke send inn på nytt"));
  assert.ok(les("student.js").includes("TREG_SENDING_MELDING"));
  assert.equal((les("proposals.js").match(/TREG_SENDING_MELDING;/g) || []).length, 2,
    "begge forslagsflytene bruker konstanten");
  // Slettevarselet i migreringen (fjerde stedet) er skrevet om uten strek.
  assert.ok(!les("genre-migrate.js").includes("ANGRES —"));
});


// Audit v5.19 funn 40: flagget som avgjør om forsiden i det hele tatt slår
// opp returer (tre serverlesinger per last) var utestet. Stubber localStorage
// — også den kastende varianten (styrte skoleprofiler).
test("merkHarSendtInn/harSendtInn: normalvei og kastende localStorage", async () => {
  const { merkHarSendtInn, harSendtInn } = await import("../../js/util.js?v=5.44");
  const lager = new Map();
  globalThis.localStorage = {
    setItem: (k, v) => lager.set(k, String(v)),
    getItem: (k) => (lager.has(k) ? lager.get(k) : null),
  };
  try {
    assert.equal(harSendtInn(), false, "ingen innsending → ingen oppslag");
    merkHarSendtInn();
    assert.equal(harSendtInn(), true, "flagget slår på auto-oppslaget");
    globalThis.localStorage = {
      setItem() { throw new Error("blokkert"); },
      getItem() { throw new Error("blokkert"); },
    };
    assert.doesNotThrow(() => merkHarSendtInn(), "et kast skal aldri velte innsendingen");
    assert.equal(harSendtInn(), false, "kastende lagring leses som «ikke sendt inn»");
  } finally {
    delete globalThis.localStorage;
  }
});

// Ferskhetssjekken før «Utfør» i sjangereditoren (v5.35, audit-funn 23): et
// snapshot fra serveren kan ha en annen nøkkelrekkefølge enn den appen skrev,
// og rå JSON.stringify meldte da «Dataene endret seg» om to like planer.
test("kanoniskJson: nøkkelrekkefølgen spiller ingen rolle, innholdet gjør", () => {
  const a = { id: "rnb", l: "R&B", p: ["blues"], meta: { fam: "red", order: 1 } };
  const b = { meta: { order: 1, fam: "red" }, p: ["blues"], l: "R&B", id: "rnb" };
  assert.equal(kanoniskJson(a), kanoniskJson(b), "samme innhold, ulik rekkefølge");
  assert.equal(kanoniskJson([a]), kanoniskJson([b]), "også inni lister");
  // Lister er ORDNET: rekkefølgen der er innhold (foreldre, tiår …).
  assert.notEqual(kanoniskJson({ p: ["a", "b"] }), kanoniskJson({ p: ["b", "a"] }));
  assert.notEqual(kanoniskJson({ l: "R&B" }), kanoniskJson({ l: "Rhythm & blues" }));
  // Som JSON.stringify: toJSON først (Date → ISO), null og tall uendret.
  const d = new Date("2026-09-18T12:00:00Z");
  assert.equal(kanoniskJson({ t: d }), JSON.stringify({ t: d.toISOString() }));
  assert.equal(kanoniskJson({ x: null, n: 3 }), '{"n":3,"x":null}');
});

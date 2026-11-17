// ============================================================================
//  SAMLEPAKKEN TIL STUDENTENE (v7.46 fase 0, v7.47 fase 1; plan 2026-11-17)
// ----------------------------------------------------------------------------
//  Modellen (js/data/studentpakke-modell.js) og oversettelsen fra dokumenter
//  til objekter (js/data/dok-objekter.js), som de direkte lytterne og pakken
//  skal dele.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PAKKE_KILDER, PAKKE_FORMAT, MANIFEST_ID, PakkeFeil, stabilJson, enkelTid, fnv1a, botteFor,
  byggPakke, manifestDok, delDok, delDokId, gjeldendePakke, pakkeEndringer, pakkeStemmer, aktivFra, lesPakke,
} from "../../js/data/studentpakke-modell.js";
import {
  artisterFraDok, tiarFraDok, innovasjonerFraDok, innholdFraDok, podkasterFraDok, sjekkerFraDok, dokListe,
} from "../../js/data/dok-objekter.js";
import { normalizeArtist } from "../../js/data/artist-normalize.js";
import { lesJs } from "../helpers/js-filer.js";

// Et lite datasett med alle kildene.
function datasett() {
  return {
    artists: [
      { id: "muddy", data: { name: "Muddy Waters", priority: 2, kilder: [{ text: "SNL", url: "https://snl.no" }], createdAt: enkelTid(1700000000, 5000000) } },
      { id: "bessie", data: { name: "Bessie Smith", priority: 0, keyWorks: ["Downhearted Blues"] } },
      { id: "otis", data: { name: "Otis Redding", votedUpBy: [] } },
    ],
    content: [{ id: "synlighet", data: { hub: { "sb-referanser": false }, student: { usjekket: true } } }, { id: "appGuide", data: { body: "Hei" } }],
    genreDescriptions: [{ id: "Electric blues", data: { main: { description: "Elektrisk." } } }],
    edgeDescriptions: [{ id: "blues__jazz", data: { text: "Kobling." } }],
    tech: [{ id: "t1", data: { name: "Vinyl", adoptedYear: 1948, status: "active" } }],
    decades: [{ id: "1950", data: { society: "Etterkrigstid." } }],
    podcasts: [{ id: "p1", data: { title: "Podkast", order: 1 } }],
    teacherChecks: [{ id: "teacherChecks", data: { genres: ["Blues"], subgenres: [] } }],
  };
}

// Pakken slik den ville ligget i config etter en skriving.
function iConfig(pakke, opts = {}) {
  const docs = pakke.deler.map((d) => ({ id: delDokId(d.id), data: delDok(d) }));
  docs.push({ id: MANIFEST_ID, data: manifestDok(pakke, { bygget: "2026-11-18T00:00:00.000Z", ...opts }) });
  return gjeldendePakke(docs);
}

const somTekst = (raa) => Object.fromEntries(Object.entries(raa).map(([k, v]) => [k, stabilJson(v)]));

test("stabilJson: nøklene sorteres på alle nivåer, lister beholder rekkefølgen", () => {
  assert.equal(stabilJson({ b: 1, a: { d: [3, 1], c: "x" } }), '{"a":{"c":"x","d":[3,1]},"b":1}');
  assert.equal(stabilJson({ a: 1, b: 2 }), stabilJson({ b: 2, a: 1 }));
  assert.equal(stabilJson(null), "null");
  assert.equal(stabilJson("æøå \"sitat\""), JSON.stringify("æøå \"sitat\""));
});

test("stabilJson: tidsstempler og NaN/Infinity merkes, andre typer avvises med stien", () => {
  assert.equal(stabilJson({ t: enkelTid(10, 20) }), '{"t":{"__ts":[10,20]}}');
  assert.equal(stabilJson([NaN, Infinity, -Infinity]), '[{"__tall":"NaN"},{"__tall":"Infinity"},{"__tall":"-Infinity"}]');
  assert.throws(() => stabilJson({ a: { b: new Date(0) } }, "artists/x"), (e) => e instanceof PakkeFeil && /artists\/x\.a\.b/.test(e.message));
  assert.throws(() => stabilJson({ a: undefined }), PakkeFeil);
  assert.throws(() => stabilJson({ __ts: [1, 2] }), PakkeFeil, "et ekte felt kan ikke se ut som et merke");
  assert.throws(() => stabilJson({ __tall: "1" }), PakkeFeil);
});

test("bøttene: fast fordeling etter id, uavhengig av de andre dokumentene", () => {
  assert.equal(fnv1a(""), "811c9dc5");
  assert.equal(fnv1a("a"), "e40c292c");
  for (const id of ["muddy", "bessie", "x".repeat(40)]) {
    assert.equal(botteFor(id, 8), botteFor(id, 8));
    assert.ok(botteFor(id, 8) >= 0 && botteFor(id, 8) < 8);
    assert.equal(botteFor(id, 1), 0);
  }
  // En ny artist endrer bare bøtta den havner i.
  const for_ = byggPakke(datasett());
  const ds = datasett();
  ds.artists.push({ id: "ny-artist", data: { name: "Ny" } });
  const etter = byggPakke(ds);
  const endret = etter.deler.filter((d, i) => d.json !== for_.deler[i].json).map((d) => d.id);
  assert.deepEqual(endret, [`artists-${botteFor("ny-artist", 8)}`]);
});

test("byggPakke: alle kildene, 8 artistbøtter og 1 for resten, med sjekksum og størrelse", () => {
  const p = byggPakke(datasett());
  assert.equal(p.format, PAKKE_FORMAT);
  assert.deepEqual(p.botter, { artists: 8, content: 1, genreDescriptions: 1, edgeDescriptions: 1, tech: 1, decades: 1, podcasts: 1, teacherChecks: 1 });
  assert.equal(p.deler.length, 15);
  assert.deepEqual(p.deler.filter((d) => d.kilde === "content").map((d) => d.id), ["content-0"]);
  for (const d of p.deler) {
    assert.equal(d.sjekksum, fnv1a(d.json));
    assert.equal(d.bytes, Buffer.byteLength(d.json));
  }
  assert.equal(p.bytes, p.deler.reduce((s, d) => s + d.bytes, 0));
  assert.equal(p.deler.filter((d) => d.kilde === "artists").reduce((s, d) => s + d.antall, 0), 3);
  // Rekkefølgen i inndata spiller ingen rolle.
  const ds = datasett();
  ds.artists.reverse();
  assert.deepEqual(byggPakke(ds), p);
});

test("byggPakke: for store deler gir flere bøtter, og ett dokument over taket stopper byggingen", () => {
  const ds = datasett();
  ds.content = Array.from({ length: 40 }, (_, i) => ({ id: `side-${i}`, data: { body: "x".repeat(200) } }));
  const p = byggPakke(ds, { grense: 2000, maks: 4000 });
  assert.ok(p.botter.content > 1, "innholdet ble delt");
  assert.ok(p.deler.filter((d) => d.kilde === "content").every((d) => d.bytes <= 2000));
  // Ett dokument over grensen, men under taket, får bøtta for seg selv.
  ds.content = [{ id: "stor", data: { body: "x".repeat(2500) } }];
  assert.equal(byggPakke(ds, { grense: 2000, maks: 4000 }).botter.content, 1);
  // Over taket: meldingen sier hvilket dokument.
  ds.content = [{ id: "stor", data: { body: "x".repeat(5000) } }];
  assert.throws(() => byggPakke(ds, { grense: 2000, maks: 4000 }),
    (e) => e instanceof PakkeFeil && /content\/stor er for stort til studentversjonen/.test(e.message));
});

test("lesPakke: rundturen gir de samme rådataene, med tidsstempler som kan brukes", () => {
  const ds = datasett();
  const les = lesPakke(iConfig(byggPakke(ds)));
  assert.equal(les.ok, true);
  assert.equal(les.bygget, "2026-11-18T00:00:00.000Z");
  const sortert = Object.fromEntries(Object.entries(ds).map(([k, v]) => [k, [...v].sort((a, b) => (a.id < b.id ? -1 : 1))]));
  assert.deepEqual(somTekst(les.raa), somTekst(sortert));
  const muddy = les.raa.artists.find((a) => a.id === "muddy");
  assert.equal(muddy.data.createdAt.toMillis(), 1700000000005);
});

test("lesPakke: mangler, feil format, nødbryteren og ødelagte deler gir direkte lesing", () => {
  const p = byggPakke(datasett());
  assert.deepEqual(lesPakke(gjeldendePakke([])), { ok: false, grunn: "mangler" });
  assert.equal(lesPakke(iConfig(p, { aktiv: false })).grunn, "av");
  const g = iConfig(p);
  assert.equal(lesPakke({ ...g, manifest: { ...g.manifest, format: 99 } }).grunn, "format");
  const uten = { ...g, deler: { ...g.deler } };
  delete uten.deler["tech-0"];
  assert.deepEqual(lesPakke(uten), { ok: false, grunn: "del", del: "tech-0" });
  const tuklet = { ...g, deler: { ...g.deler, "decades-0": { ...g.deler["decades-0"], json: '[["1950",{"society":"Annet."}]]' } } };
  assert.deepEqual(lesPakke(tuklet), { ok: false, grunn: "del", del: "decades-0" });
});

test("pakkeEndringer: ingenting når alt stemmer, bare endrede deler, og gamle deler slettes", () => {
  const p = byggPakke(datasett());
  const g = iConfig(p);
  assert.deepEqual(pakkeEndringer(p, g), { skriv: [], slett: [], manifest: false });
  assert.equal(pakkeStemmer(p, g), true);
  // Første bygging: alt skrives.
  const tom = pakkeEndringer(p, gjeldendePakke([]));
  assert.equal(tom.skriv.length, 15);
  assert.equal(tom.manifest, true);
  // En endret artist.
  const ds = datasett();
  ds.artists[1].data.name = "Bessie Smith (1894–1937)";
  const ny = byggPakke(ds);
  assert.deepEqual(pakkeEndringer(ny, g), { skriv: [`artists-${botteFor("bessie", 8)}`], slett: [], manifest: true });
  // En del som ikke hører til pakken lenger, slettes.
  const ekstra = { ...g, deler: { ...g.deler, "artists-9": delDok({ id: "artists-9", kilde: "artists", json: "[]" }) } };
  assert.deepEqual(pakkeEndringer(p, ekstra).slett, ["artists-9"]);
  // En del med riktig tekst, men feil format, skrives på nytt.
  const gammel = { ...g, deler: { ...g.deler, "podcasts-0": { ...g.deler["podcasts-0"], format: 0 } } };
  assert.deepEqual(pakkeEndringer(p, gammel).skriv, ["podcasts-0"]);
});

test("pakkeEndringer: tidspunktet og appversjonen i manifestet teller ikke, nødbryteren overlever", () => {
  const p = byggPakke(datasett());
  const g = iConfig(p, { bygget: "2026-01-01T00:00:00.000Z", appVersjon: "7.00" });
  assert.equal(pakkeStemmer(p, g), true);
  assert.equal(aktivFra(g), true);
  assert.equal(aktivFra(iConfig(p, { aktiv: false })), false);
  assert.equal(aktivFra(gjeldendePakke([])), true);
  assert.equal(manifestDok(p, { aktiv: aktivFra(iConfig(p, { aktiv: false })) }).aktiv, false);
});

test("dokumentene i config: manifest og deler har flagget spørringen bruker", () => {
  const p = byggPakke(datasett());
  const m = manifestDok(p, { bygget: "x", appVersjon: "7.47" });
  assert.equal(m.studentpakke, true);
  assert.equal(m.type, "manifest");
  assert.deepEqual(Object.keys(m.deler).length, 15);
  const d = delDok(p.deler[0]);
  assert.deepEqual(Object.keys(d).sort(), ["del", "format", "json", "kilde", "studentpakke", "type"]);
  assert.equal(delDokId("artists-3"), "studentpakke-artists-3");
  assert.deepEqual(PAKKE_KILDER.map((k) => k.id), ["artists", "content", "genreDescriptions", "edgeDescriptions", "tech", "decades", "podcasts", "teacherChecks"]);
});

// ---- Oversettelsen (fase 0) ----

test("dok-objekter: samme objekter som lytterne laget før", () => {
  const docs = datasett();
  assert.deepEqual(artisterFraDok(docs.artists), docs.artists.map((d) => normalizeArtist({ id: d.id, ...d.data })));
  assert.deepEqual(tiarFraDok(docs.decades), { 1950: { id: "1950", society: "Etterkrigstid." } });
  assert.deepEqual(innholdFraDok(docs.content), { synlighet: docs.content[0].data, appGuide: { body: "Hei" } });
  const tech = innovasjonerFraDok([{ id: "b", data: { adoptedYear: 1960 } }, { id: "a", data: { adoptedYear: 1948 } }, { id: "c", data: {} }]);
  assert.deepEqual(tech.map((t) => t.id), ["c", "a", "b"]);
  assert.equal(podkasterFraDok(docs.podcasts)[0].id, "p1");
  assert.deepEqual(sjekkerFraDok(null), { genres: [], subgenres: [] });
  assert.deepEqual(sjekkerFraDok({ genres: ["Blues"] }), { genres: ["Blues"] });
  assert.deepEqual(dokListe({ docs: [{ id: "a", data: () => ({ x: 1 }) }] }), [{ id: "a", data: { x: 1 } }]);
});

test("store.js bruker oversettelsen i alle de delte lytterne", () => {
  const s = lesJs("store.js");
  for (const [funksjon, oversetter] of [
    ["subscribeArtists", "artisterFraDok"], ["subscribeDecades", "tiarFraDok"],
    ["subscribeGenreDescs", "sjangerbeskrivelserFraDok"], ["subscribeEdgeDescs", "koblingerFraDok"],
    ["subscribePodcasts", "podkasterFraDok"], ["subscribeTech", "innovasjonerFraDok"],
    ["subscribeContent", "innholdFraDok"],
  ]) {
    const kropp = s.slice(s.indexOf(`export function ${funksjon}(`), s.indexOf("\n}\n", s.indexOf(`export function ${funksjon}(`)));
    assert.match(kropp, new RegExp(`callback\\(${oversetter}\\(dokListe\\(snapshot\\)\\)\\)`), funksjon);
  }
  assert.match(s, /callback\(sjekkerFraDok\(snap\.exists\(\) \? snap\.data\(\) : null\)\)/);
  assert.match(lesJs("dok-objekter.js"), /^(?![\s\S]*firebasejs)/, "ingen Firebase-import i den rene modulen");
  assert.ok(!/firebasejs|store\.js/.test(lesJs("studentpakke-modell.js")), "modellen er ren");
});

// ---- Byggeren (fase 1) ----

test("byggeren: startes av shared-data, bare for læreren, og bygger bare av ferske data", () => {
  const sd = lesJs("shared-data.js");
  assert.match(sd, /import \{ startStudentpakke \} from "\.\/studentpakke\.js";/);
  assert.match(sd, /if \(laererside\) settSjekketLaerer\(true\);[\s\S]{0,300}startStudentpakke\(\);/);
  const b = lesJs("studentpakke.js");
  assert.match(b, /onAuthChange\(\(u\) => \(erPakkeLaerer\(u\) \? start\(\) : stopp\(\)\)\)/);
  assert.match(b, /u\.emailVerified === true[\s\S]{0,120}TEACHER_EMAILS\.includes\(u\.email\)[\s\S]{0,120}providerId === "google\.com"/,
    "samme krav som isTeacher() i reglene");
  assert.match(b, /if \(ventesPaa\(\)\.length\) \{\n\s*planlegg\(\);\n\s*return;/, "bygger aldri før alt er ferskt");
  assert.match(b, /aktiv: aktivFra\(gjeldende\)/, "nødbryteren overlever ombyggingen");
  const s = lesJs("store.js");
  assert.match(s, /const ferskt = \(s\) => !s\.metadata\.fromCache && !s\.metadata\.hasPendingWrites;/);
  assert.match(s, /query\(collection\(db, "config"\), where\("studentpakke", "==", true\)\)/);
  assert.match(s, /export async function skrivStudentpakke\(\{ sett = \[\], slett = \[\] \}\) \{\n\s*const batch = writeBatch\(db\);/);
});

test("statuslinja på Skrivebordet: nederst i «Synlig for studentene», med varsel i overskriften ved feil", () => {
  const d = lesJs("teacher-desk.js");
  assert.match(d, /<summary>Synlig for studentene\$\{pakkeMerke\(pakkeStatus\(\)\)\}<\/summary>/);
  assert.match(d, /\$\{sjekketRegelHtml\(v\)\}\n\s*\$\{studentpakkeHtml\(pakkeStatus\(\)\)\}/);
  assert.match(d, /if \(hit\("\[data-pakke-bygg\]"\)\) return byggStudentpakkeNaa\(\);/);
  assert.match(d, /document\.addEventListener\("pensum:studentpakke"/);
  assert.ok(!/ [—–] /.test(d.slice(d.indexOf("function pakkeTekst("), d.indexOf("const pakkeMerke"))), "ingen tankestrek i tekstene");
});

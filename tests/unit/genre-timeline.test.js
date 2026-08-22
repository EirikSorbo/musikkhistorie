import { SEED_GENRE_DESCS } from "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { genreFamilyNodes, buildGenreTimeline } from "../../js/ui-timeline.js?v=4.67";
import { GENEALOGY } from "../../js/genre-model.js?v=4.67";
import { STORY_ORDER } from "../../js/story-format.js?v=4.67";

// Sjangertidslinjen over hver historie utledes av treet. Poenget med å generere
// den er at nye noder dukker opp av seg selv — testene under låser nettopp det.

test("hver historie får med NØYAKTIG tre-nodene i metasjangeren sin", () => {
  for (const meta of STORY_ORDER) {
    const fasit = GENEALOGY.filter((n) => n.g === meta).map((n) => n.l).sort();
    const med = genreFamilyNodes(meta, SEED_GENRE_DESCS).map((x) => x.n.l).sort();
    assert.deepEqual(med, fasit, meta);
  }
});

test("rot-noder holdes utenfor — kun ekte sjangre på løypen", () => {
  // Rot-nodene (g === null: Work songs, Spirituals, Euro-folk, Vestafrikansk)
  // ble tatt med til og med v3.76. De ga lite, og fordi de ligger et århundre
  // foran resten krevde de et eget aksebrudd som gjorde løypen rotete.
  for (const meta of STORY_ORDER) {
    assert.ok(genreFamilyNodes(meta, SEED_GENRE_DESCS).every((x) => x.n.g === meta),
      `${meta} skal kun inneholde noder fra sin egen metasjanger`);
  }
  const blues = genreFamilyNodes("Blues", SEED_GENRE_DESCS).map((x) => x.n.l);
  assert.ok(!blues.includes("Work songs"));
  assert.equal(blues[0], "Blues", "løypen starter på sjangeren selv");
});

test("avstamning låser rekkefølgen selv når era er upresis", () => {
  // Electric blues (het Chicago blues til v3.97) har era «midten av 1940-tallet»
  // — ingen firesifret årstall, så den leses fra raden sin. Barnet Blues rock
  // («1963–69») må uansett komme etter den.
  //
  // NB: sjekk ALLTID at noden finnes før du sammenligner indekser. Denne testen
  // het før på «British invasion», og da den noden ble slått inn i Blues rock
  // (v3.96), ga findIndex -1 — og «-1 < 2» besto stille mens testen ikke lenger
  // prøvde noe som helst. Guarden under fanget omdøpingen i v3.97 med én gang.
  const blues = genreFamilyNodes("Blues", SEED_GENRE_DESCS);
  const i = (navn) => {
    const idx = blues.findIndex((x) => x.n.l === navn);
    assert.ok(idx >= 0, `${navn} finnes ikke i Blues-familien — testen er utdatert`);
    return idx;
  };
  assert.ok(i("Electric blues") < i("Blues rock"));
  // Generelt: ingen node kan komme før en forelder i samme familie.
  for (const meta of STORY_ORDER) {
    const fam = genreFamilyNodes(meta, SEED_GENRE_DESCS);
    const pos = new Map(fam.map((x, idx) => [x.n.id, idx]));
    for (const { n } of fam) {
      for (const pid of n.p || []) {
        if (pos.has(pid)) assert.ok(pos.get(pid) < pos.get(n.id), `${meta}: ${pid} → ${n.id}`);
      }
    }
  }
});

test("de nye v3.73-nodene er med i løypene sine", () => {
  const navn = (meta) => genreFamilyNodes(meta, SEED_GENRE_DESCS).map((x) => x.n.l);
  assert.ok(navn("Country").includes("Neotrad. country"));
  assert.ok(navn("R&B").includes("Cont. R&B"));
  // Cont. hip-hop lå i R&B til v3.88, da hip-hop ble egen metasjanger.
  assert.ok(navn("Hip-hop").includes("Cont. hip-hop"));
});

test("aksen er ubrutt og bruker hele sporet", () => {
  // Aksebruddet (.tl-break / --tl-line-start) fantes kun for rot-nodene og er
  // borte sammen med dem — ingen rester i markupen.
  for (const meta of STORY_ORDER) {
    const html = buildGenreTimeline(meta, SEED_GENRE_DESCS);
    assert.ok(!html.includes("tl-break"), `${meta} skal ikke ha aksebrudd`);
    assert.ok(!html.includes("--tl-line-start"), `${meta} skal tegne heltrukken strek hele veien`);
    assert.ok(!html.includes("tl-item-root") && !html.includes("tl-root"),
      `${meta} skal ikke ha rot-markering`);
    // Første og siste punkt ligger ytterst — hele bredden er i bruk.
    const pos = [...html.matchAll(/left:([\d.]+)%/g)].map((m) => +m[1]).sort((a, b) => a - b);
    assert.ok(pos[0] <= 5, `${meta} starter ytterst til venstre, fikk ${pos[0]}`);
    assert.ok(pos[pos.length - 1] >= 95, `${meta} slutter ytterst til høyre`);
  }
});

const stemsOf = (html) =>
  [...html.matchAll(/--stem:(\d+)px/g)].map((m) => +m[1]);

test("stilkene veksler mellom to lengder i stedet for å eskalere", () => {
  // Den frie stablingen vokste monotont — hver ny etikett måtte klarere alle de
  // forrige — så i tette familier ble stilkene lengre og lengre utover i sporet.
  for (const meta of STORY_ORDER) {
    const stems = new Set(stemsOf(buildGenreTimeline(meta, SEED_GENRE_DESCS)));
    assert.ok(stems.size <= 2, `${meta} skal ha høyst to stilklengder, fikk ${[...stems].join(", ")}`);
  }
  // Jazz er den tetteste familien (12 punkter) og den som eskalerte verst.
  const jazz = stemsOf(buildGenreTimeline("Jazz", SEED_GENRE_DESCS));
  assert.ok(jazz.length >= 10, "Jazz skal ha mange punkter");
  assert.equal(new Set(jazz).size, 2, "Jazz skal veksle mellom kort og lang");
});

test("etikettene kantstilles aldri — de er midtstilt over prikken overalt", () => {
  for (const meta of STORY_ORDER) {
    const html = buildGenreTimeline(meta, SEED_GENRE_DESCS);
    assert.ok(!/tl-start|tl-end/.test(html), `${meta} skal ikke ha kantstilte etiketter`);
  }
});

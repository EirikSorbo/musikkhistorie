import { test } from "node:test";
import assert from "node:assert/strict";
import { genreFamilyNodes, buildGenreTimeline } from "../../js/ui-timeline.js?v=3.76";
import { GENEALOGY } from "../../js/genealogy.js?v=3.76";
import { STORY_ORDER } from "../../js/story-format.js?v=3.76";

// Sjangertidslinjen over hver historie utledes av treet. Poenget med å generere
// den er at nye noder dukker opp av seg selv — testene under låser nettopp det.

test("hver historie får med ALLE tre-nodene i metasjangeren sin", () => {
  for (const meta of STORY_ORDER) {
    const fasit = GENEALOGY.filter((n) => n.g === meta).map((n) => n.l).sort();
    const med = genreFamilyNodes(meta).filter((x) => !x.root).map((x) => x.n.l).sort();
    assert.deepEqual(med, fasit, meta);
  }
});

test("rot-nodene tas med og er merket som røtter", () => {
  const blues = genreFamilyNodes("Blues");
  const roots = blues.filter((x) => x.root).map((x) => x.n.l);
  assert.deepEqual(roots, ["Work songs"]);
  // Rot-noder har g === null og er derfor IKKE gyldige mainGenre — merkingen er
  // det som skiller dem visuelt (kursiv + stiplet prikk).
  assert.ok(blues.filter((x) => x.root).every((x) => !x.n.g));
});

test("avstamning låser rekkefølgen selv når era er upresis", () => {
  // Blues rock har era «sent 1960-tall» (leses som 1960) og ville uten låsingen
  // havnet FORAN forelderen British invasion («1963–66»).
  const blues = genreFamilyNodes("Blues");
  const i = (navn) => blues.findIndex((x) => x.n.l === navn);
  assert.ok(i("British invasion") < i("Blues rock"));
  // Generelt: ingen node kan komme før en forelder i samme familie.
  for (const meta of STORY_ORDER) {
    const fam = genreFamilyNodes(meta);
    const pos = new Map(fam.map((x, idx) => [x.n.id, idx]));
    for (const { n } of fam) {
      for (const pid of n.p || []) {
        if (pos.has(pid)) assert.ok(pos.get(pid) < pos.get(n.id), `${meta}: ${pid} → ${n.id}`);
      }
    }
  }
});

test("de nye v3.73-nodene er med i løypene sine", () => {
  const navn = (meta) => genreFamilyNodes(meta).map((x) => x.n.l);
  assert.ok(navn("Country").includes("Neotrad. country"));
  assert.ok(navn("R&B").includes("Cont. R&B"));
  assert.ok(navn("R&B").includes("Cont. hip-hop"));
});

test("rot-noden står utenfor proporsjonen, med et stiplet brudd inn til aksen", () => {
  // Work songs (1800-tallet) ligger et århundre foran Blues (ca. 1900). Med
  // roten på tidsaksen spiste den avstanden over halve sporet og klemte alle de
  // faktiske sjangrene sammen til høyre.
  const html = buildGenreTimeline("Blues");
  const pos = [...html.matchAll(/class="tl-item[^"]*"[^>]*left:([\d.]+)%/g)].map((m) => +m[1]);
  const rot = [...html.matchAll(/class="tl-item[^"]*tl-item-root"[^>]*left:([\d.]+)%/g)].map((m) => +m[1]);
  assert.equal(rot.length, 1, "Blues har én rot-node");
  assert.ok(rot[0] <= 5, "roten står helt til venstre, ikke på sitt egentlige årstall");
  // Første ekte sjanger starter der aksen begynner — ikke langt ute til høyre.
  const akse = pos.filter((p) => p > rot[0]).sort((a, b) => a - b);
  assert.ok(akse[0] >= 12 && akse[0] <= 22, `aksen starter ved bruddet, fikk ${akse[0]}`);
  // Bruddet tegnes som eget element mellom roten og aksen.
  const brudd = html.match(/tl-break" style="left:([\d.]+)%;width:([\d.]+)%/);
  assert.ok(brudd, "bruddet mangler");
  assert.ok(Math.abs(+brudd[1] - rot[0]) < 1, "bruddet starter ved roten");
  assert.ok(Math.abs(+brudd[1] + +brudd[2] - akse[0]) < 1, "bruddet slutter ved aksen");
});

test("familier uten rot får verken brudd eller forskjøvet akse", () => {
  for (const meta of ["R&B", "Klubbmusikk"]) {
    const html = buildGenreTimeline(meta);
    assert.ok(!html.includes("tl-break"), `${meta} skal ikke ha brudd`);
    assert.ok(!html.includes("--tl-line-start"), `${meta} skal tegne heltrukken strek hele veien`);
  }
});

const stemsOf = (html) =>
  [...html.matchAll(/--stem:(\d+)px/g)].map((m) => +m[1]);

test("stilkene veksler mellom to lengder i stedet for å eskalere", () => {
  // Den frie stablingen vokste monotont — hver ny etikett måtte klarere alle de
  // forrige — så i tette familier ble stilkene lengre og lengre utover i sporet.
  for (const meta of STORY_ORDER) {
    const stems = new Set(stemsOf(buildGenreTimeline(meta)));
    assert.ok(stems.size <= 2, `${meta} skal ha høyst to stilklengder, fikk ${[...stems].join(", ")}`);
  }
  // Jazz er den tetteste familien (12 punkter) og den som eskalerte verst.
  const jazz = stemsOf(buildGenreTimeline("Jazz"));
  assert.ok(jazz.length >= 10, "Jazz skal ha mange punkter");
  assert.equal(new Set(jazz).size, 2, "Jazz skal veksle mellom kort og lang");
});

test("etikettene kantstilles aldri — de er midtstilt over prikken overalt", () => {
  for (const meta of STORY_ORDER) {
    const html = buildGenreTimeline(meta);
    assert.ok(!/tl-start|tl-end/.test(html), `${meta} skal ikke ha kantstilte etiketter`);
  }
});

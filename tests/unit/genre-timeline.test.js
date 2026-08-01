import { test } from "node:test";
import assert from "node:assert/strict";
import { genreFamilyNodes } from "../../js/ui-timeline.js?v=3.74";
import { GENEALOGY } from "../../js/genealogy.js?v=3.74";
import { STORY_ORDER } from "../../js/story-format.js?v=3.74";

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

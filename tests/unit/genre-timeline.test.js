import { SEED_GENRE_DESCS } from "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { genreFamilyNodes } from "../../js/ui-timeline.js?v=5.68";
import { GENEALOGY } from "../../js/genre-model.js?v=5.68";
import { STORY_ORDER } from "../../js/story-format.js?v=5.68";

// Sjangerfamilien over hver historie utledes av treet. Poenget med å generere
// den er at nye noder dukker opp av seg selv — testene under låser nettopp det.
//
// Fram til v5.16 tegnet buildGenreTimeline familien som en proporsjonal
// tidslinje, og tre tester her prøvde den markupen (akse, stilker,
// etikettstilling). Historiene viser nå varmestriper i stedet, og funksjonen er
// borte; testene gikk med den. genreFamilyNodes består som eneste bruker, og
// den er viktigere enn før: den bestemmer BÅDE hvilke rader historien får og
// rekkefølgen deres.

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


// Radene i historien er kronologiske (brukervalg 2026-09-09), i motsetning til
// varmekartet, som sorterer etter første tiår med varme. Rekkefølgen kommer
// rett fra genreFamilyNodes, så den låses her.
test("familien kommer kronologisk, med metasjangeren selv først", () => {
  for (const meta of STORY_ORDER) {
    const nodes = genreFamilyNodes(meta, SEED_GENRE_DESCS);
    const ar = nodes.map((x) => x.year);
    assert.deepEqual(ar, [...ar].sort((a, b) => a - b),
      `${meta} skal komme i stigende årstall, fikk ${ar.join(", ")}`);
  }
  // Jazz er den tetteste familien og den beste prøven på at avstamningen
  // låser rekkefølgen: Bebop før Hard bop før Fusion.
  const jazz = genreFamilyNodes("Jazz", SEED_GENRE_DESCS).map((x) => x.n.l);
  const i = (n) => jazz.indexOf(n);
  assert.ok(i("Bebop") > -1 && i("Hard bop") > -1 && i("Fusion") > -1, "nodene skal finnes");
  assert.ok(i("Bebop") < i("Hard bop"), "Bebop før Hard bop");
  assert.ok(i("Hard bop") < i("Fusion"), "Hard bop før Fusion");
});

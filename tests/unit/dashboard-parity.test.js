// Dashbord-paritet: student- (index.html) og lærer-dashbordet (teacher.html)
// skal ha NØYAKTIG samme kort i samme rekkefølge (brukerkrav 2026-07-13).
// Testen leser den statiske HTML-en, så en omrokkering på bare én av sidene
// feiler `npm test` i stedet for å skli ubemerket fra hverandre.
// («Det store bildet»-hubens kort ligger i JS-injisert markup og telles ikke.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Kort-titlene i det FØRSTE (og eneste statiske) dash-gridet i fila.
function dashTitles(fil) {
  const html = readFileSync(join(rot, fil), "utf8");
  const start = html.indexOf('<div class="dash-grid">');
  assert.ok(start >= 0, `${fil}: fant ikke dash-grid`);
  const grid = html.slice(start, html.indexOf("</section>", start));
  return [...grid.matchAll(/<span class="dash-title">([^<]+)<\/span>/g)].map((m) => m[1]);
}

test("student- og lærer-dashbordet har samme kort i samme rekkefølge", () => {
  const student = dashTitles("index.html");
  const laerer = dashTitles("teacher.html");
  assert.ok(student.length >= 5, "student-dashbordet ser tomt/feilparset ut");
  assert.deepEqual(
    laerer, student,
    "Kortene i teacher.html må stå i samme rekkefølge som i index.html — endrer du den ene, endre den andre.",
  );
});

// --- Sjangernavn på to nivåer ------------------------------------------------
// Oversiktens sjangerliste teller med artistsInGenre og countPlaylistExamples.
// Begge må lese sjangertreet alene: seks navn (Blues, Gospel, Jazz, Pop, R&B,
// Rock) finnes både som node og som metasjanger, og en metaGenre-match gjorde
// «Jazz»-raden til hele jazzfamilien.

test("sjangerraden teller treets sjanger, ikke metasjangeren", async () => {
  const { artistsInGenre, countPlaylistExamples } = await import("../../js/ui.js?v=5.42");
  const artister = [
    { id: "1", name: "Tidlig", status: "active", metaGenre: "Jazz",
      mainGenre: ["Jazz"], subGenre: [], musicExamples: [{ label: "a", url: "u1" }] },
    { id: "2", name: "Bebop", status: "active", metaGenre: "Jazz",
      mainGenre: ["Bebop"], subGenre: [], musicExamples: [{ label: "b", url: "u2" }] },
    { id: "3", name: "Cool", status: "active", metaGenre: "Jazz",
      mainGenre: ["Cool jazz"], subGenre: [], musicExamples: [{ label: "c", url: "u3" }] },
  ];
  assert.deepEqual(artistsInGenre(artister, "Jazz").map((a) => a.name), ["Tidlig"]);
  assert.equal(countPlaylistExamples(artister, "Jazz"), 1, "spillelista følger samme regel som lista");
  // Bebop-noden er upåvirket — den kolliderer ikke med noe metasjangernavn.
  assert.deepEqual(artistsInGenre(artister, "Bebop").map((a) => a.name), ["Bebop"]);
});

test("tellingen og lista bak klikket er fortsatt samme regnestykke", async () => {
  const { artistsInGenre, countPlaylistExamples } = await import("../../js/ui.js?v=5.42");
  const artister = [
    { id: "1", name: "A", status: "active", metaGenre: "R&B", mainGenre: ["Soul"], subGenre: [],
      musicExamples: [{ label: "x", url: "u1" }, { label: "y", url: "u2", genre: "Funk" }] },
    { id: "2", name: "B", status: "active", metaGenre: "R&B", mainGenre: ["R&B"], subGenre: [],
      musicExamples: [{ label: "z", url: "u3" }] },
  ];
  assert.equal(artistsInGenre(artister, "R&B").length, 1);
  assert.equal(countPlaylistExamples(artister, "R&B"), 1);
  assert.equal(artistsInGenre(artister, "Soul").length, 1);
  // Eksempelet tagget «Funk» hører ikke hjemme i Soul-spillelista.
  assert.equal(countPlaylistExamples(artister, "Soul"), 1);
});

// Toppfeltet (v5.42, brukerkrav 2026-09-19): bare logoen står synlig øverst til
// venstre. Tittelen er skjult for øyet på ALLE sidene, men står igjen som h1
// og som logolenkas navn for skjermlesere.
test("toppfeltet: tittelen er skjult for øyet, men finnes for skjermlesere, på alle sidene", async () => {
  const fs = await import("node:fs");
  const les = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
  for (const side of ["index.html", "tre.html", "teacher.html", "student.html"]) {
    const brand = les(side).match(/<a class="brand"[^>]*>[\s\S]*?<\/a>/)?.[0] || "";
    assert.match(brand, /<h1 class="sr-only">Populærmusikkhistorie - Del 1<\/h1>/, side);
  }
  assert.doesNotMatch(les("css/styles.css"), /^\s*\.brand h1 \{/m, "ingen stil som gjør tittelen synlig igjen");
});

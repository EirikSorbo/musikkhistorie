import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArtistDoc } from "../../js/artist-normalize.js?v=3.47";
import { ARTIST_FIELDS } from "../../js/artist-schema.js?v=3.47";

test("alle skjemafelter finnes i dokumentet, tomme felter får tom-verdi", () => {
  const doc = buildArtistDoc({ name: "X" });
  for (const f of ARTIST_FIELDS) assert.ok(f.key in doc, f.key);
  assert.equal(doc.name, "X");
  assert.equal(doc.birthYear, null);
  assert.deepEqual(doc.mainGenre, []);
  assert.deepEqual(doc.keyWorks, []);
  assert.equal(doc.description, "");
});

test("status: active/removed bevares (lærer-import), alt annet blir pending", () => {
  assert.equal(buildArtistDoc({ name: "A", status: "active" }).status, "active");
  assert.equal(buildArtistDoc({ name: "A", status: "removed" }).status, "removed");
  assert.equal(buildArtistDoc({ name: "A", status: "hacked" }).status, "pending");
  assert.equal(buildArtistDoc({ name: "A" }).status, "pending");
});

test("removedBy settes kun når status er removed", () => {
  assert.equal(buildArtistDoc({ name: "A", status: "removed" }).removedBy, "teacher");
  assert.equal(buildArtistDoc({ name: "A", status: "active" }).removedBy, null);
});

test("votedUpBy bevares ved import, men kun rene tekster", () => {
  const doc = buildArtistDoc({ name: "A", votedUpBy: ["uid1", 42, null, "uid2", { x: 1 }] });
  assert.deepEqual(doc.votedUpBy, ["uid1", "uid2"]);
  assert.deepEqual(buildArtistDoc({ name: "A", votedUpBy: "ikke-liste" }).votedUpBy, []);
  assert.deepEqual(buildArtistDoc({ name: "A" }).votedUpBy, []);
});

test("addedYear bevares når heltall, ellers inneværende år", () => {
  assert.equal(buildArtistDoc({ name: "A", addedYear: 2024 }).addedYear, 2024);
  const doc = buildArtistDoc({ name: "A", addedYear: "2024" });
  assert.equal(doc.addedYear, new Date().getFullYear());
});

test("proposedBy/teacherChecked/priority får standardverdier", () => {
  const doc = buildArtistDoc({ name: "A" });
  assert.equal(doc.proposedBy, "Anonym");
  assert.equal(doc.teacherChecked, false);
  assert.equal(doc.priority, 0);
  const doc2 = buildArtistDoc({ name: "A", proposedBy: "Eirik", teacherChecked: true, priority: 3 });
  assert.equal(doc2.proposedBy, "Eirik");
  assert.equal(doc2.teacherChecked, true);
  assert.equal(doc2.priority, 3);
});

test("createdAt settes IKKE her (legges på i store.js med serverTimestamp)", () => {
  assert.equal("createdAt" in buildArtistDoc({ name: "A" }), false);
});

test("normalisering kjøres: metaGenre omdøpes og URL-er vaskes", () => {
  const doc = buildArtistDoc({
    name: "A",
    metaGenre: "Afroamerikansk populærmusikk",
    imageUrl: "javascript:alert(1)",
  });
  assert.equal(doc.metaGenre, "R&B");
  assert.equal(doc.imageUrl, "");
});

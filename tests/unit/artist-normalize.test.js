import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeArtist } from "../../js/artist-normalize.js?v=5.52";

test("idempotent på allerede normalisert artist", () => {
  const a = {
    name: "Robert Johnson",
    metaGenre: "Blues",
    mainGenre: ["Blues"],
    subGenre: ["Delta blues"],
    keyWorks: [{ title: "Cross Road Blues", year: 1937 }],
    kilder: [{ text: "Ward 1998", url: "https://example.com" }],
    musicExamples: [{ label: "Lytt", url: "https://youtube.com/x", year: 1937, performanceYear: null }],
    imageUrl: "https://example.com/rj.jpg",
    imageCredit: "Wikipedia",
  };
  const once = normalizeArtist(a);
  const twice = normalizeArtist(once);
  assert.deepEqual(twice, once);
});

test("søppel i mainGenre/subGenre filtreres bort (hindrer nedstrøms krasj)", () => {
  const n = normalizeArtist({
    mainGenre: ["Blues", null, "", "  ", 42, ["nested"], { x: 1 }],
    subGenre: [null, "Delta blues"],
  });
  assert.deepEqual(n.mainGenre, ["Blues"]);
  assert.deepEqual(n.subGenre, ["Delta blues"]);
});

test("keyWorks som ikke er en liste gir tom liste", () => {
  assert.deepEqual(normalizeArtist({ keyWorks: "Cross Road Blues" }).keyWorks, []);
  assert.deepEqual(normalizeArtist({ keyWorks: 42 }).keyWorks, []);
});

test("kilder som strenger blir {text}", () => {
  const n = normalizeArtist({ kilder: ["Ward 1998", { text: "Bok", url: "https://x.no" }] });
  assert.deepEqual(n.kilder, [
    { text: "Ward 1998" },
    { text: "Bok", url: "https://x.no" },
  ]);
});

test("javascript:-URLer vaskes bort overalt", () => {
  const n = normalizeArtist({
    imageUrl: "javascript:alert(1)",
    musicExamples: [{ label: "Ond", url: "javascript:alert(1)" }, { label: "OK", url: "https://ok.no" }],
    keyWorks: [{ title: "Verk", url: "javascript:alert(1)" }],
    kilder: [{ text: "Kilde", url: "data:text/html,x" }],
  });
  assert.equal(n.imageUrl, "");
  assert.deepEqual(n.musicExamples.map((m) => m.url), ["https://ok.no"]);
  assert.equal("url" in n.keyWorks[0], false);
  assert.equal(n.kilder[0].url, "");
});

test("manglende felter gir tomme arrays", () => {
  const n = normalizeArtist({ name: "X" });
  assert.deepEqual(n.mainGenre, []);
  assert.deepEqual(n.subGenre, []);
  assert.deepEqual(n.keyWorks, []);
  assert.deepEqual(n.kilder, []);
  assert.deepEqual(n.musicExamples, []);
});

test("musicExamples.genre: trimmes, ikke-streng/tom fjernes", () => {
  const n = normalizeArtist({
    musicExamples: [
      { url: "https://a.no", genre: "  Cool jazz " },
      { url: "https://b.no", genre: "" },
      { url: "https://c.no", genre: 42 },
      { url: "https://d.no" },
    ],
  });
  assert.equal(n.musicExamples[0].genre, "Cool jazz");
  assert.equal("genre" in n.musicExamples[1], false);
  assert.equal("genre" in n.musicExamples[2], false);
  assert.equal("genre" in n.musicExamples[3], false);
});

test("null/søppel-elementer i kilder/keyWorks/musicExamples krasjer ikke", () => {
  // Ett ødelagt dokument (f.eks. håndredigert import med null i en array) skal
  // ikke kaste — det ville stoppet HELE artistlista via subscribeArtists.
  const n = normalizeArtist({
    name: "X",
    kilder: [null, { text: "ekte" }, 42],
    keyWorks: [null, "Bare en streng", { title: "Verk" }],
    musicExamples: [null, { url: "https://ok.no" }, 7],
  });
  assert.deepEqual(n.kilder, [{ text: "ekte", url: "" }]);
  assert.deepEqual(n.keyWorks, [{ title: "Bare en streng" }, { title: "Verk" }]);
  assert.deepEqual(n.musicExamples.map((m) => m.url), ["https://ok.no"]);
});

// Returflyten (v5.13): status «returnert» og returfeltene skal overleve en
// eksport → import — ellers mister en gjenoppretting både tilbakemeldingen og
// koden mens et forslag er hos studenten. En STUDENTinnsending (uten feltene)
// skal derimot ikke få dem påført: reglene ville avvist dokumentet.
test("buildArtistDoc: returnert-status og returfeltene bevares ved import", async () => {
  const { buildArtistDoc } = await import("../../js/artist-normalize.js?v=5.52");
  const inn = {
    name: "Test", status: "returnert", ownerUid: "abc123",
    teacherFeedback: "Mangler kilder.", returKode: "X7K2P",
    studentComment: "", innsendtKode: "X7K2P", returnedAt: "2026-09-09T10:00:00Z",
  };
  const ut = buildArtistDoc(inn);
  assert.equal(ut.status, "returnert");
  assert.equal(ut.teacherFeedback, "Mangler kilder.");
  assert.equal(ut.returKode, "X7K2P");
  assert.equal(ut.ownerUid, "abc123");
  assert.equal("studentComment" in ut, false, "tomme returfelter skal ikke påføres");

  const student = buildArtistDoc({ name: "Fersk" });
  assert.equal(student.status, "pending");
  for (const f of ["ownerUid", "teacherFeedback", "returKode", "innsendtKode"]) {
    assert.equal(f in student, false, `studentinnsending skal ikke bære ${f}`);
  }
  // Ukjent status normaliseres fortsatt til pending.
  assert.equal(buildArtistDoc({ name: "X", status: "tull" }).status, "pending");
});

// Audit v5.19 funn 4: resubmitArtist skrev ALLE skjemafeltene, og tømte
// dermed stille felter studentskjemaet ikke har — recordLabel (satt av
// læreren via «Rediger») ble borte ved hver nye innsending av en retur.
test("resubmitArtistFields: skriver KUN feltene skjemaet sendte", async () => {
  const { resubmitArtistFields } = await import("../../js/artist-normalize.js?v=5.52");
  const data = { name: "Robert Johnson", description: "Bluespioner", keyWorks: "ikke en liste" };
  const felter = resubmitArtistFields(data);
  assert.equal("recordLabel" in felter, false, "felter skjemaet ikke har, røres ikke");
  assert.equal("instrument" in felter, false);
  assert.equal(felter.name, "Robert Johnson");
  assert.equal(felter.description, "Bluespioner");
  assert.deepEqual(felter.keyWorks, [], "søppel normaliseres som ellers");
  // Et felt som ER sendt, men tomt, skrives som tom-verdi (studenten tømte det).
  const tomt = resubmitArtistFields({ name: "X", description: "" });
  assert.equal(tomt.description, "");
});

// contentGaps er delt kilde for «Innhold som mangler» i Oversikt og tallet på
// Skrivebordet. Testene låser tellereglene: hvilke felt/sider/historier som
// regnes som hull, at bare synlige artister teller, og at total = sum av bøtter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contentGaps } from "../../js/ui-dashboard.js?v=3.66";
import { GENEALOGY_EDGES, edgeKey } from "../../js/genealogy.js?v=3.66";

const artist = (o) => ({
  status: "active", priority: 0, mainGenre: [], subGenre: [],
  imageUrl: "x", description: "d", musicExamples: [{}], kilder: [{}], ...o,
});

test("contentGaps: artist-mediahull telles per felt", () => {
  const artists = [
    artist({ name: "Full" }),
    artist({ name: "UtenBilde", imageUrl: "" }),
    artist({ name: "UtenAlt", imageUrl: "", description: "  ", musicExamples: [], kilder: [] }),
  ];
  const g = contentGaps({ artists, genreDescs: {}, content: {}, contentLoaded: true });
  assert.equal(g.noImage.length, 2);
  assert.equal(g.noDesc.length, 1);
  assert.equal(g.noMusic.length, 1);
  assert.equal(g.noSources.length, 1);
});

test("contentGaps: skjulte og pending artister telles ikke", () => {
  const artists = [
    artist({ name: "Skjult", priority: -1, imageUrl: "" }),
    artist({ name: "Pending", status: "pending", imageUrl: "" }),
  ];
  const g = contentGaps({ artists, contentLoaded: true });
  assert.equal(g.noImage.length, 0);
});

test("contentGaps: sider telles kun når innhold er lastet", () => {
  assert.equal(contentGaps({ artists: [], content: {}, contentLoaded: false }).pages.length, 0);
  assert.deepEqual(
    contentGaps({ artists: [], content: {}, contentLoaded: true }).pages.sort(),
    ["omHistorie", "rotter"],
  );
  assert.deepEqual(
    contentGaps({ artists: [], content: { rotter: { body: "x" } }, contentLoaded: true }).pages,
    ["omHistorie"],
  );
});

test("contentGaps: sjangerhistorie regnes som skrevet når story.body finnes", () => {
  assert.equal(contentGaps({ artists: [], genreDescs: {} }).stories.length, 6);
  const one = contentGaps({ artists: [], genreDescs: { Blues: { story: { body: "s" } } } });
  assert.equal(one.stories.length, 5);
  assert.ok(!one.stories.includes("Blues"));
});

test("contentGaps: main-beskrivelse fjerner sjangeren fra mainDesc", () => {
  assert.ok(contentGaps({ artists: [], genreDescs: {} }).mainDesc.includes("Blues"));
  const withBlues = contentGaps({ artists: [], genreDescs: { Blues: { main: { description: "b" } } } });
  assert.ok(!withBlues.mainDesc.includes("Blues"));
});

test("contentGaps: koblingsbeskrivelse fjerner koblingen fra edgeDesc", () => {
  const empty = contentGaps({ artists: [] });
  assert.equal(empty.edgeDesc.length, GENEALOGY_EDGES.length);
  assert.ok(empty.edgeDesc.some((e) => e.from === "blues" && e.to === "jazz"));
  const withOne = contentGaps({ artists: [], edgeDescs: { [edgeKey("blues", "jazz")]: { description: "b" } } });
  assert.equal(withOne.edgeDesc.length, GENEALOGY_EDGES.length - 1);
  assert.ok(!withOne.edgeDesc.some((e) => e.from === "blues" && e.to === "jazz"));
});

test("contentGaps: lytteeksempler uten sjangerknytning teller kun flersjanger-artister", () => {
  const artists = [
    // Én sjanger → aldri i bøtta, selv uten genre-felt.
    artist({ name: "EnSjanger", mainGenre: ["Blues"], musicExamples: [{ url: "https://x" }] }),
    // Flersjanger uten genre på eksempelet → i bøtta.
    artist({ name: "Utagget", mainGenre: ["Blues", "Soul"], musicExamples: [{ url: "https://x" }] }),
    // Flersjanger med gyldig genre → ikke i bøtta.
    artist({ name: "Tagget", mainGenre: ["Blues", "Soul"], musicExamples: [{ url: "https://x", genre: "Soul" }] }),
    // Flersjanger med genre som ikke står i mainGenre → i bøtta (mismatch).
    artist({ name: "Mismatch", mainGenre: ["Blues", "Soul"], musicExamples: [{ url: "https://x", genre: "Funk" }] }),
  ];
  const g = contentGaps({ artists, contentLoaded: true });
  assert.deepEqual(g.noExGenre.map((a) => a.name).sort(), ["Mismatch", "Utagget"]);
});

test("contentGaps: total er summen av alle bøtter", () => {
  const g = contentGaps({
    artists: [artist({ name: "X", imageUrl: "" })],
    genreDescs: {}, content: {}, contentLoaded: true,
  });
  const sum = g.stories.length + g.pages.length + g.mainDesc.length + g.subDesc.length
    + g.edgeDesc.length + g.noImage.length + g.noDesc.length + g.noMusic.length + g.noSources.length
    + g.noExGenre.length;
  assert.equal(g.total, sum);
});

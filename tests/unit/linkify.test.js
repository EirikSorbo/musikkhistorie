import { test } from "node:test";
import assert from "node:assert/strict";
import { linkifyAll } from "../../js/linkify.js?v=2.85";

const artists = [
  { id: "a1", name: "Muddy Waters", status: "active" },
  { id: "a2", name: "B.B. King", status: "active" },
];

test("artistnavn i tekst blir klikkbare lenker", () => {
  const html = linkifyAll("Inspirert av Muddy Waters.", { artists });
  assert.ok(html.includes('data-artist-id="a1"'));
});

test("delord matcher ikke (ordgrenser)", () => {
  const html = linkifyAll("Muddy Watersfestivalen", { artists });
  assert.equal(html.includes("data-artist-id"), false);
});

test("genitiv-s etter navn matcher", () => {
  const html = linkifyAll("Muddy Waters’ gitar", { artists });
  assert.ok(html.includes('data-artist-id="a1"'));
});

test("skjulte artister linkes ikke", () => {
  const hidden = [{ id: "a3", name: "Skjult Artist", status: "active", priority: -1 }];
  const html = linkifyAll("Skjult Artist var viktig.", { artists: hidden });
  assert.equal(html.includes("data-artist-id"), false);
});

test("HTML i tekst escapes før linking", () => {
  const html = linkifyAll("<script>x</script> og Muddy Waters", { artists });
  assert.ok(html.startsWith("&lt;script&gt;"));
  assert.ok(html.includes('data-artist-id="a1"'));
});

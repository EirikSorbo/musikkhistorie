import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStoryHtml, storyFor, pageFor, STORY_ORDER } from "../../js/story-format.js?v=3.24";

const artists = [
  { id: "a1", name: "Muddy Waters", status: "active" },
  { id: "a2", name: "Robert Johnson", status: "active" },
];

test("avsnitt skilles av blanke linjer", () => {
  const html = renderStoryHtml("Første avsnitt.\n\nAndre avsnitt.");
  assert.equal(html, "<p>Første avsnitt.</p><p>Andre avsnitt.</p>");
});

test("### blir mellomtittel (h3), uansett #-dybde", () => {
  assert.ok(renderStoryHtml("### Chicago blues").includes("<h3>Chicago blues</h3>"));
  assert.ok(renderStoryHtml("## Tittel").includes("<h3>Tittel</h3>"));
});

test("fet og kursiv", () => {
  const html = renderStoryHtml("Dette er **viktig** og *nyansert*.");
  assert.ok(html.includes("<strong>viktig</strong>"));
  assert.ok(html.includes("<em>nyansert</em>"));
});

test("punktliste og nummerert liste samles i ul/ol", () => {
  const ul = renderStoryHtml("- ett\n- to");
  assert.equal(ul, "<ul><li>ett</li><li>to</li></ul>");
  const ol = renderStoryHtml("1. ett\n2. to");
  assert.equal(ol, "<ol><li>ett</li><li>to</li></ol>");
});

test("artistnavn i løpende tekst og inni fet tekst lenkes", () => {
  const html = renderStoryHtml("Med **Muddy Waters** kom arven etter Robert Johnson til byen.", { artists });
  assert.ok(html.includes('data-artist-id="a1"'));
  assert.ok(html.includes('data-artist-id="a2"'));
});

test("[tekst](url) blir lenke med noopener, kun http(s)", () => {
  const html = renderStoryHtml("Hør: [Strange Fruit](https://www.youtube.com/results?search_query=Strange%20Fruit) nå.");
  assert.ok(html.includes('<a href="https://www.youtube.com/results?search_query=Strange%20Fruit" target="_blank" rel="noopener">Strange Fruit</a>'));
  // javascript:-URL-er skal IKKE bli lenker
  const evil = renderStoryHtml("[klikk](javascript:alert(1))");
  assert.equal(evil.includes("<a "), false);
  assert.ok(evil.includes("klikk"));
});

test("lenketekst escapes og linkifiseres IKKE (ingen nøstede lenker)", () => {
  const html = renderStoryHtml("[Muddy Waters](https://example.com/x)", { artists });
  assert.equal(html.includes("data-artist-id"), false);
  assert.ok(html.includes(">Muddy Waters</a>"));
});

test("lenker fungerer sammen med fet/kursiv i samme linje", () => {
  const html = renderStoryHtml("**Viktig:** hør [låta](https://example.com) og *tenk*.");
  assert.ok(html.includes("<strong>Viktig:</strong>"));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes("<em>tenk</em>"));
});

test("HTML i teksten escapes (ingen XSS gjennom historien)", () => {
  const html = renderStoryHtml('<script>alert(1)</script> og **<b>x</b>**');
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<b>"), false);
});

test("HTML i lenketekst og URL escapes", () => {
  const html = renderStoryHtml('[<b>x</b>](https://example.com/?a="1")');
  assert.equal(html.includes("<b>"), false);
  assert.equal(html.includes('a="1"'), false);
});

test("storyFor: null når ingen tekst er lagret (ingen fallback)", () => {
  assert.equal(storyFor("Blues", {}), null);
  assert.equal(storyFor("Blues", { Blues: {} }), null);
});

test("storyFor: lagret story-felt brukes", () => {
  const s = storyFor("Blues", { Blues: { story: { body: "Min egen bluestekst." } } });
  assert.equal(s.body, "Min egen bluestekst.");
});

test("storyFor: tom/whitespace-tekst regnes som manglende", () => {
  assert.equal(storyFor("Blues", { Blues: { story: { body: "   " } } }), null);
});

test("pageFor: samme regler for innholdssidene", () => {
  assert.equal(pageFor("omHistorie", {}), null);
  assert.equal(pageFor("omHistorie", { omHistorie: { body: " " } }), null);
  assert.equal(pageFor("omHistorie", { omHistorie: { body: "Tekst." } }).body, "Tekst.");
});

test("STORY_ORDER er de seks historiene i fast rekkefølge", () => {
  assert.deepEqual(STORY_ORDER, ["Blues", "Country", "Gospel", "Jazz", "R&B", "Klubbmusikk"]);
});

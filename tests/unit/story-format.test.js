import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStoryHtml, storyFor, STORY_ORDER } from "../../js/story-format.js?v=2.97";
import { DEFAULT_STORIES } from "../../js/stories-default.js?v=2.97";

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

test("HTML i teksten escapes (ingen XSS gjennom historien)", () => {
  const html = renderStoryHtml('<script>alert(1)</script> og **<b>x</b>**');
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<b>"), false);
});

test("storyFor: standardtekst når ingen overstyring finnes", () => {
  const s = storyFor("Blues", {});
  assert.equal(s.custom, false);
  assert.equal(s.body, DEFAULT_STORIES.Blues);
});

test("storyFor: lærer-redigert story-felt overstyrer", () => {
  const s = storyFor("Blues", { Blues: { story: { body: "Min egen bluestekst." } } });
  assert.equal(s.custom, true);
  assert.equal(s.body, "Min egen bluestekst.");
});

test("storyFor: tom/whitespace-overstyring faller tilbake til standard", () => {
  const s = storyFor("Blues", { Blues: { story: { body: "   " } } });
  assert.equal(s.custom, false);
});

test("alle sjangre i STORY_ORDER har standardtekst som rendrer", () => {
  assert.equal(STORY_ORDER.length, 6);
  for (const g of STORY_ORDER) {
    const html = renderStoryHtml(DEFAULT_STORIES[g]);
    assert.ok(html.includes("<h3>"), `${g} mangler mellomtitler`);
    assert.ok(html.length > 1000, `${g} rendrer mistenkelig kort`);
  }
});

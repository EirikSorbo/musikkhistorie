import { test } from "node:test";
import assert from "node:assert/strict";
import { rowInnerHtml, WORK_SPEC, MUSIC_SPEC, SOURCE_SPEC } from "../../js/row-editor.js?v=3.15";

test("rowInnerHtml escaper verdier (lukker XSS-fella)", () => {
  const html = rowInnerHtml(SOURCE_SPEC, { text: `"><img src=x onerror=alert(1)>`, url: "https://ex.com" });
  assert.equal(html.includes("<img"), false, "rå HTML skal ikke slippe gjennom");
  assert.match(html, /&quot;&gt;&lt;img/);
  assert.match(html, /value="https:\/\/ex\.com"/);
});

test("rowInnerHtml bygger riktige felter og fjern-knapp per spec", () => {
  const work = rowInnerHtml(WORK_SPEC, { title: "Cross Road Blues", year: 1936 });
  assert.match(work, /class="work-title"[^>]*value="Cross Road Blues"/);
  assert.match(work, /class="work-year"[^>]*value="1936"/);
  assert.match(work, /min="1800" max="2030"/);
  assert.match(work, /class="btn ghost small remove-work"/);

  const me = rowInnerHtml(MUSIC_SPEC, {});
  for (const cls of ["me-label", "me-year", "me-url", "me-perf-year"]) {
    assert.match(me, new RegExp(`class="${cls}"`));
  }
});

test("tomme verdier gir tomme value-attributter", () => {
  const html = rowInnerHtml(SOURCE_SPEC, {});
  assert.match(html, /class="source-text"[^>]*value=""/);
  assert.match(html, /class="source-url"[^>]*value=""/);
});

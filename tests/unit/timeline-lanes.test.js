import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSpan, packLanes, timelineBounds } from "../../js/timeline-lanes.js?v=3.58";

const NOW = 2026;

test("resolveSpan: kjent sluttår brukes direkte", () => {
  assert.deepEqual(resolveSpan({ influenceStart: 1936, influenceEnd: 1938 }, NOW),
    { start: 1936, end: 1938, open: false });
});

test("resolveSpan: deathYear brukes som tak når influenceEnd mangler", () => {
  assert.deepEqual(resolveSpan({ influenceStart: 1949, deathYear: 2014 }, NOW),
    { start: 1949, end: 2014, open: false });
});

test("resolveSpan: uten sluttår og dødsår → åpen ende mot nå", () => {
  assert.deepEqual(resolveSpan({ influenceStart: 1962 }, NOW),
    { start: 1962, end: NOW, open: true });
});

test("resolveSpan: ugyldig data avvises ærlig", () => {
  assert.equal(resolveSpan({}, NOW), null);
  assert.equal(resolveSpan({ influenceStart: null }, NOW), null);
  // sluttår FØR start ignoreres (velger deathYear/åpen i stedet for å lyve)
  assert.deepEqual(resolveSpan({ influenceStart: 1980, influenceEnd: 1955 }, NOW),
    { start: 1980, end: NOW, open: true });
});

test("packLanes: ikke-overlappende deler bane, overlappende får nye", () => {
  const mk = (name, start, end) => ({ name, span: { start, end, open: false } });
  const lanes = packLanes([
    mk("A", 1920, 1940),
    mk("B", 1945, 1960),   // 1940+3 <= 1945 → samme bane som A
    mk("C", 1930, 1970),   // overlapper A → ny bane
  ]);
  assert.equal(lanes.length, 2);
  assert.deepEqual(lanes[0].map((i) => i.name), ["A", "B"]);
  assert.deepEqual(lanes[1].map((i) => i.name), ["C"]);
});

test("packLanes: gap respekteres og korte perioder får visuell minimumsbredde", () => {
  const mk = (name, start, end) => ({ name, span: { start, end, open: false } });
  // B starter kun 2 år etter A slutter → gap på 3 tvinger ny bane
  const lanes = packLanes([mk("A", 1920, 1940), mk("B", 1942, 1950)], { gap: 3 });
  assert.equal(lanes.length, 2);
  // Kort periode (2 år) pakkes med minSpan-bredde så navnet får plass
  const [only] = packLanes([mk("Kort", 1936, 1938)], { minSpan: 6 });
  assert.equal(only[0].visualEnd, 1942);
});

test("timelineBounds: hele tiår som omslutter data og nå", () => {
  assert.deepEqual(timelineBounds([{ start: 1923, end: 1968 }, { start: 1955, end: 2026 }], NOW),
    { y0: 1920, y1: 2030 });
  assert.deepEqual(timelineBounds([], NOW), { y0: 1900, y1: 2030 });
});

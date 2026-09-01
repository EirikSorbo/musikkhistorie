// Viktighetsgrad-kortet i lærer-oversikten. Lærersiden krever innlogging og
// kan ikke klikkes gjennom i en preview, så tallene sjekkes her: renderDashboard
// er ren strengbygging, og et objekt med innerHTML/onclick holder som «element».
import "../helpers/seed-model.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDashboard } from "../../js/ui-dashboard.js?v=5.06";

const artist = (id, priority, status = "active") => ({
  id, name: `Artist ${id}`, status, priority,
  metaGenre: "Jazz", instrument: "Trompet", influenceStart: 1950,
});

// To viktigst, én viktig, én mindre viktig, én uten grad, to skjulte — og ett
// forslag som ennå ikke er godkjent (skal ikke telle noe sted).
const ARTISTER = [
  artist("a", 3), artist("b", 3),
  artist("c", 2),
  artist("d", 1),
  artist("e", 0),
  artist("f", -1), artist("g", -1),
  artist("h", 3, "pending"),
];

function tegn(artists) {
  const el = { innerHTML: "", onclick: null };
  renderDashboard(el, { artists });
  return el.innerHTML;
}

// Gradene er halvbrede felt i nøkkeltall-raden: knappen bærer data-ov-prio,
// og tallet står i samme .ov-kpi-n som de andre nøkkeltallene.
const tallFor = (html, grad) => {
  const m = html.match(new RegExp(`data-ov-prio="${grad}"[\\s\\S]*?ov-kpi-n">(\\d+)<`));
  assert.ok(m, `fant ingen tall for viktighetsgrad ${grad}`);
  return Number(m[1]);
};

// «Artister uten viktighetsgrad» står nederst, blant det som gjenstår å fylle.
const utenGrad = (html) => {
  const m = html.match(/<span>Artister uten viktighetsgrad<\/span>\s*<span class="ov-count [^"]*">(\d+)</);
  assert.ok(m, "fant ikke «Artister uten viktighetsgrad» under Innhold som mangler");
  return Number(m[1]);
};

test("hver viktighetsgrad får sitt eget tall", () => {
  const html = tegn(ARTISTER);
  assert.equal(tallFor(html, 3), 2, "Viktigst");
  assert.equal(tallFor(html, 2), 1, "Viktig");
  assert.equal(tallFor(html, 1), 1, "Mindre viktig");
});

test("skjulte kort telles for seg — de ligger utenfor artisttallet ellers", () => {
  const html = tegn(ARTISTER);
  assert.equal(tallFor(html, -1), 2);
  // «Artister»-nøkkeltallet er de SYNLIGE: 5 av de 7 aktive.
  assert.match(html, /<span class="ov-kpi-n">5<\/span>\s*<span class="ov-kpi-l">Artister</);
});

test("forslag som venter på godkjenning teller ikke med", () => {
  // Artist «h» har grad 3, men status pending: uten dette ville tallet vært 3.
  assert.equal(tallFor(tegn(ARTISTER), 3), 2);
});

test("gradene pluss «uten grad» går opp i artisttallet", () => {
  const html = tegn(ARTISTER);
  const sum = tallFor(html, 3) + tallFor(html, 2) + tallFor(html, 1);
  assert.equal(utenGrad(html), 1);
  assert.equal(sum + utenGrad(html), 5, "summen skal være de synlige artistene");
});

test("kortet står der også når ingen har fått en grad ennå", () => {
  const html = tegn([artist("x", 0), artist("y", 0)]);
  assert.equal(tallFor(html, 3), 0);
  assert.equal(tallFor(html, -1), 0);
  assert.equal(utenGrad(html), 2);
});

test("skjulte kort teller ikke som «uten viktighetsgrad»", () => {
  // -1 er en grad, ikke et tomt felt: uten dette ville de to skjulte havnet
  // i lista over artister som mangler en grad.
  assert.equal(utenGrad(tegn(ARTISTER)), 1);
});

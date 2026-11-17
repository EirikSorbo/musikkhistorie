// «Om appen» (v7.33, brukerbestilling 2026-11-17): «i» i toppmenyen med «Slik
// bruker du appen», Referanser og KI-erklæringen. De to første lå før i «Det
// store bildet» og følger de samme bryterne. Fra v7.34 (brukerbestilling
// 2026-11-17) er det et vindu med tre kort i Innstillingers stil, og ikonet står
// rett før Innstillinger.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INFO_VALG, synligeInfoValg, infoKortHtml } from "../../js/ui/info-vindu.js";
import { parseVisVerdi } from "../../js/felles/vis-lenke.js";
import { lesJs } from "../helpers/js-filer.js";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const ider = (l) => l.map((v) => v.id);
const KI = { kiErklaering: { body: "Historieappen.no er laget med Claude." } };

test("valgene: guiden, referansene og KI-erklæringen, og alle er gyldige mål", () => {
  assert.deepEqual(ider(INFO_VALG), ["guide", "referanser", "ki"]);
  assert.deepEqual(INFO_VALG.map((v) => v.tekst), ["Slik bruker du appen", "Referanser", "KI-erklæring"]);
  for (const v of INFO_VALG) assert.ok(parseVisVerdi(v.vis), v.vis);
});

test("studentene: bryterne styrer guiden og referansene, og KI-erklæringen venter på teksten", () => {
  const alt = { "sb-guide": false, "sb-referanser": false };
  assert.deepEqual(ider(synligeInfoValg({ skjulHub: alt, content: KI })), ["guide", "referanser", "ki"]);
  assert.deepEqual(ider(synligeInfoValg({ skjulHub: { "sb-guide": true, "sb-referanser": false }, content: KI })), ["referanser", "ki"]);
  assert.deepEqual(ider(synligeInfoValg({ skjulHub: { "sb-guide": true, "sb-referanser": true }, content: KI })), ["ki"]);
  // Innholdet er lest, men teksten mangler: ingen tom side for studentene.
  assert.deepEqual(ider(synligeInfoValg({ skjulHub: alt, content: {} })), ["guide", "referanser"]);
  assert.deepEqual(ider(synligeInfoValg({ skjulHub: alt, content: { kiErklaering: { body: "  " } } })), ["guide", "referanser"]);
  // Innholdet er ikke lest (forslagsskjemaet og utskriften): den står med.
  assert.deepEqual(ider(synligeInfoValg({ skjulHub: alt, content: null })), ["guide", "referanser", "ki"]);
});

test("læreren ser alltid alle tre", () => {
  const skjult = { "sb-guide": true, "sb-referanser": true };
  assert.deepEqual(ider(synligeInfoValg({ laerer: true, skjulHub: skjult, content: {} })), ["guide", "referanser", "ki"]);
});

test("ikonet står rett før Innstillinger på alle sidene, også for studentene", () => {
  for (const f of ["index.html", "teacher.html", "tre.html", "student.html", "utskrift.html"]) {
    const s = les(f);
    const nav = s.slice(s.indexOf('<nav class="nav">'), s.indexOf("</nav>"));
    const titler = [...nav.matchAll(/title="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(titler.slice(-2), ["Om appen", "Innstillinger"], `${f}: Innstillinger er ytterst til høyre`);
    assert.match(nav, /<button type="button" class="nav-icon nav-info" data-info aria-haspopup="dialog" title="Om appen" aria-label="Om appen">/, f);
  }
  const css = les("css/styles.css");
  assert.match(css, /body\.role-student \.nav \.nav-icon\.nav-info \{ display: inline-flex; \}/);
  assert.match(css, /--icon-ki: var\(--icon-mono, /);
});

test("vinduet: ett kort per valg i Innstillingers stil, med Åpne som lenke til forsiden", () => {
  const html = infoKortHtml(INFO_VALG[2]);
  assert.match(html, /<section class="innst-gruppe" data-info-kort="ki">/);
  assert.match(html, /<div class="innst-kort"><div class="innst-rad">/);
  assert.match(html, /<span class="innst-ikon" style="--farge:var\(--icon-ki\)" aria-hidden="true"><svg /);
  assert.match(html, /<span class="innst-tittel">KI-erklæring<\/span><span class="innst-desc">Hvordan appen er laget med KI, og hvem som har ansvaret for innholdet\.<\/span>/);
  assert.match(html, /<a class="btn ghost small" href="index\.html\?vis=side%3AkiErklaering" data-info-vis="side:kiErklaering" aria-label="Åpne KI-erklæring">Åpne<\/a>/);
  for (const v of INFO_VALG) assert.ok(v.desc && v.ikon && v.farge, v.id);
  const m = lesJs("info-vindu.js");
  assert.match(m, /<div class="modal modal-narrow modal-innstillinger" role="dialog" aria-labelledby="info-tittel">/, "samme vindu som Innstillinger");
  assert.match(m, /<h2 id="info-tittel">Om appen<\/h2>/);
});

test("koblingen: utforsk-sidene åpner der man står, de andre går til forsiden", () => {
  assert.match(lesJs("explore.js"), /initInfoVindu\(\{ apne: apneMaal \}\);/);
  assert.match(lesJs("student.js"), /^\s*initInfoVindu\(\{ escape: true \}\);/m, "skjemasiden har ingen egen Escape");
  assert.match(lesJs("utskrift.js"), /^\s*initInfoVindu\(\);/m);
  assert.match(lesJs("explore.js"), /^\s*oppdaterInfoVindu\(\);/m, "tegnes på nytt når innholdet lander");
});

test("KI-erklæringen: egen side med Rediger, uten Sjekk, ikke pensum, og ?vis=side:kiErklaering åpner den", () => {
  assert.match(lesJs("explore-modals.js"), /<div class="modal-backdrop" id="modal-ki-erklaering" data-vis="side:kiErklaering">/);
  assert.match(lesJs("explore-apne.js"), /if \(apne\.id === "kiErklaering"\) return openKiErklaering\(\);/);
  assert.match(lesJs("explore-innhold.js"), /renderPage\("kiErklaering", "ki-erklaering-body", "ki-erklaering-extra"\);/);
  assert.match(lesJs("explore.js"), /if \(isOpen\("modal-ki-erklaering"\)\) renderPage\("kiErklaering"/, "tegnes på nytt når teksten endres");
  assert.match(lesJs("teacher-content.js"), /kiErklaering: "KI-erklæring"/);
  assert.match(lesJs("teacher-content.js"), /editorTarget\.id === "kiErklaering"\) ctx\.explore\.openKiErklaering\(\);/);
  assert.match(lesJs("gjennomgang-modell.js"), /IKKE_PENSUM_SIDER = new Set\(\["appGuide", "kiErklaering"\]\)/);
});

test("Det store bildet: Referanser og Slik bruker du appen er borte fra huben", () => {
  const m = lesJs("explore-modals.js");
  const hub = m.slice(m.indexOf('id="modal-store-bildet"'), m.indexOf("modal-backdrop", m.indexOf('id="modal-store-bildet"') + 40));
  assert.ok(!hub.includes('id="sb-referanser"'));
  assert.ok(!hub.includes('id="sb-guide"'));
  const e = lesJs("explore.js");
  assert.ok(!e.includes('paaKort("sb-referanser"'));
  assert.ok(!e.includes('paaKort("sb-guide"'));
});

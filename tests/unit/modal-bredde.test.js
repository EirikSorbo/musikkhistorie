// ============================================================================
//  INNHOLDSKORTENES BREDDE (v5.86, brukervalg 2026-09-29)
// ----------------------------------------------------------------------------
//  Kortene arvet 640 og 860 px fra lærerens skjemaer i første versjon, og de
//  ble for smale. Innholdskortene deler nå .modal-innhold (1000 px, aldri over
//  90 % av skjermen), mens skjemaer, søket og små dialoger beholder sine
//  bredder. Låst på kildenivå, så en opprydding ikke sender ett kort tilbake
//  til 640 px, eller gjør et skjema bredt.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const les = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

// Klassene på .modal rett innenfor modal-backdropen med gitt id.
function modalKlasser(src, id) {
  const m = src.match(new RegExp(`<div class="modal-backdrop"[^>]*\\bid="${id}"[^>]*>\\s*<div class="([^"]*)"`));
  assert.ok(m, `fant ikke #${id}`);
  return m[1].split(/\s+/);
}

const INNHOLDSKORT = {
  "index.html": ["modal-artister", "modal-detail"],
  "tre.html": ["modal-artist-detail"],
  "teacher.html": ["modal-detail"],
  "js/utforsk/explore-modals.js": [
    "modal-teknologi", "modal-instrumenter", "modal-podkaster", "modal-instr-tech",
    "modal-decade-view", "modal-varmekart", "modal-sjangerperioder", "modal-sjangerhimmel",
    "modal-tidslinje", "modal-subgenre-list", "modal-undersjangre", "modal-subgenre-info",
    "modal-store-bildet", "modal-referanser", "modal-app-guide", "modal-om-historie",
    "modal-rotter", "modal-historier",
  ],
  "js/ui/ui-modal-fragments.js": ["modal-sjanger", "modal-artistliste", "modal-spilleliste", "modal-tech-detail"],
};

const BEHOLDER_BREDDEN = {
  "index.html": ["modal-proposal"],
  "js/utforsk/explore-modals.js": ["modal-sok", "modal-vk-edit"],
  "teacher.html": ["modal-edit", "modal-oversikt", "modal-retur"],
  "js/laerer/teacher-genres.js": ["modal-genre-admin", "modal-genre-edit"],
};

test("innholdskortene har den brede rammen", () => {
  for (const [fil, ider] of Object.entries(INNHOLDSKORT)) {
    const src = les(fil);
    for (const id of ider) {
      const k = modalKlasser(src, id);
      assert.ok(k.includes("modal-innhold"), `${fil} #${id} mangler modal-innhold`);
      assert.ok(!k.includes("modal-wide"), `${fil} #${id}: modal-wide og modal-innhold på samme kort`);
    }
  }
});

test("skjemaer, søket og små dialoger beholder sine bredder", () => {
  for (const [fil, ider] of Object.entries(BEHOLDER_BREDDEN)) {
    const src = les(fil);
    for (const id of ider) {
      assert.ok(!modalKlasser(src, id).includes("modal-innhold"), `${fil} #${id} skal ikke ha den brede rammen`);
    }
  }
});

test("rammen og tekstgrensen, og presentasjonen holdes utenfor tekstgrensen", () => {
  const css = les("css/styles.css");
  assert.match(css, /\.modal\.modal-innhold \{ max-width: clamp\(860px, 90vw, 1000px\); \}/,
    "1000 px, aldri over 90 % av skjermen, aldri under 860 px (da fyller kortet vinduet som før)");
  assert.match(css, /body:not\(\.presentasjon\) \.modal\.modal-innhold :is\(p, \.rt, \.info-text\) \{ max-width: 68ch; \}/,
    "lesbar linjelengde i appen; presentasjonen har sine egne 80ch");
});

// v5.94: metasjanger-oversikten ble lagt i markupen uten å bli registrert, og
// da hadde ← ingen lytter. Hver modal i den delte markupen må stå i wireModals.
test("alle modalene i den delte markupen er registrert (← og ✕ virker)", () => {
  const ider = [...les("js/utforsk/explore-modals.js").matchAll(/class="modal-backdrop"[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  const reg = les("js/utforsk/explore.js");
  const start = reg.indexOf("function wireModals()");
  const liste = reg.slice(start, reg.indexOf("setupModal(id)", start));
  assert.ok(ider.length > 20, "fant modalene i markupen");
  for (const id of ider) assert.ok(liste.includes(`"${id}"`), `#${id} mangler i wireModals`);
});

// v6.04: i det brede kortet ventet tidslinja på at 240 px-bildet var slutt
// (clear:right), og det ga et tomrom under boblene. Stripa står nå først i
// artistkortet, og teksten flyter ved siden av bildet. Beslektede artister
// venter på bildet, så skillelinja ikke går inn under det.
test("artistkortet: tidslinja først, så bildet, og beslektede under bildet", () => {
  const ui = les("js/ui/ui.js");
  const start = ui.indexOf("export function renderArtistDetail");
  const kropp = ui.slice(start, ui.indexOf("wireLinks(el, lc);", start));
  const sekter = [...kropp.matchAll(/sekt\("([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(sekter.slice(0, 3), ["stripe", "bilde", "fakta"]);
  const css = les("css/styles.css");
  assert.match(css, /body:not\(\.presentasjon\) :is\(#detail-body, #ad-body\) \.related \{ clear: right; \}/);
});

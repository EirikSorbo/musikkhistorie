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
  "index.html": ["modal-artister", "modal-dagens-navn", "modal-detail"],
  "tre.html": ["modal-artist-detail"],
  "teacher.html": ["modal-detail"],
  "js/explore-modals.js": [
    "modal-teknologi", "modal-instrumenter", "modal-podkaster", "modal-instr-tech",
    "modal-decade-view", "modal-varmekart", "modal-sjangerperioder", "modal-sjangerhimmel",
    "modal-tidslinje", "modal-subgenre-list", "modal-undersjangre", "modal-subgenre-info",
    "modal-store-bildet", "modal-referanser", "modal-app-guide", "modal-om-historie",
    "modal-rotter", "modal-historier",
  ],
  "js/ui-modal-fragments.js": ["modal-sjanger", "modal-artistliste", "modal-spilleliste", "modal-tech-detail"],
};

const BEHOLDER_BREDDEN = {
  "index.html": ["modal-proposal"],
  "js/explore-modals.js": ["modal-sok", "modal-vk-edit"],
  "teacher.html": ["modal-edit", "modal-oversikt", "modal-retur"],
  "js/teacher-genres.js": ["modal-genre-admin", "modal-genre-edit"],
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

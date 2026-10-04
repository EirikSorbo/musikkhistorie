// Navn fra timen (v5.82, brukerbestilling 2026-09-28): tasten L i visningen
// åpner et panel der læreren noterer en artist som kom opp og hvem som
// foreslo den; postene går til samlingen timeforslag (bare læreren) og
// vises på Skrivebordet. Kildelåser for hele kjeden, så en del ikke faller
// ut uten at det merkes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const les = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("reglene: timeforslag er bare lærerens, med hviteliste og tak", () => {
  const r = les("firestore.rules");
  assert.match(r, /match \/timeforslag\/\{doc\} \{/);
  assert.match(r, /hasOnly\(\["artist", "student", "kontekst", "laget"\]\)/);
  assert.match(r, /strOk\("artist", 120\) && strOk\("student", 60\) && strOk\("kontekst", 200\) && strOk\("laget", 40\)/);
  const blokk = r.slice(r.indexOf("match /timeforslag/"));
  assert.match(blokk, /allow read: if isTeacher\(\);/);
  assert.match(blokk, /allow create, update: if isTeacher\(\) && timeforslagOk\(\);/);
  assert.match(blokk, /allow delete: if isTeacher\(\);/);
  assert.match(les("tests/rules/firestore-rules.test.js"), /collection\("timeforslag"\)/, "regeltesten dekker samlingen");
});

test("lagringen: store.js har abonnement, ny post og sletting, og posten kuttes til takene", () => {
  const s = les("js/data/store.js");
  assert.match(s, /const timeforslagCol = collection\(db, "timeforslag"\);/);
  assert.match(s, /export function subscribeTimeforslag\(callback\)/);
  assert.match(s, /export async function addTimeforslag\(\{ artist, student = "", kontekst = "" \}\)/);
  assert.match(s, /artist: String\(artist \|\| ""\)\.trim\(\)\.slice\(0, 120\)/);
  assert.match(s, /laget: new Date\(\)\.toISOString\(\)/);
  assert.match(s, /export async function deleteTimeforslag\(id\)/);
});

test("visningen: L åpner panelet bare for læreren, med kontekst, Enter-lagring og angre", () => {
  const p = les("js/visning/presentasjon.js");
  assert.match(p, /case "timeliste": return vekslTimeliste\(\);/);
  assert.match(p, /function vekslTimeliste\(\) \{\n\s*if \(!erLaerer\) return;/);
  // Lærerflagget settes også i fri visning (uten plan), ikke bare inne i if (planId).
  const auth = p.indexOf("onAuthChange((user) => { erLaerer = erLaererBruker(user); oppdaterLeggTil(); oppdaterHubKort(); });");
  const planBlokk = p.indexOf("if (planId) {\n    const planUi");
  assert.ok(auth > 0 && planBlokk > auth, "lærerflagget settes før og utenfor planblokka");
  assert.match(p, /m\.id = "modal-timeliste";/);
  assert.match(p, /id="timeliste-artist" maxlength="120"/);
  assert.match(p, /id="timeliste-student" maxlength="60"/);
  assert.match(p, /addTimeforslag\(post\)/);
  assert.match(p, /data-time-angre/);
  assert.match(p, /function timeKontekst\(\)/);
});

test("lærersiden: abonnementet og bolken på Skrivebordet, med Foreslå og Fjern", () => {
  assert.match(les("js/teacher.js"), /subscribeTimeforslag\(\(liste\) => \{ state\.timeforslag = liste; state\.timeforslagLoaded = true; refreshDesk\(\); \}\);/);
  assert.match(les("js/laerer/teacher-state.js"), /timeforslag: \[\],\n\s*timeforslagLoaded: false,/);
  const d = les("js/laerer/teacher-desk.js");
  assert.match(d, /\$\{timeforslagHtml\(\)\}/);
  assert.match(d, /href="student\.html\?navn=\$\{encodeURIComponent\(p\.artist \|\| ""\)\}"/);
  assert.match(d, /data-desk-time-slett="\$\{escapeHtml\(p\.id\)\}"/);
  assert.match(d, /async function slettTimeforslag\(id\)/);
  const css = les("css/styles.css");
  assert.match(css, /\.desk-time \{/);
  assert.match(css, /\.modal-timeliste \.timeliste-skjema \{/);
});

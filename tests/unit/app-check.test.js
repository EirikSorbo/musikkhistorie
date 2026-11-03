// ============================================================================
//  APP CHECK (js/data/app-check.js, v7.22)
// ----------------------------------------------------------------------------
//  App Check skal startes på historieappen.no, med feilsøkingsbevis på
//  localhost (v7.23), aldri i emulatormodus, og før Firestore og Auth i
//  store.js. Ellers går de første forespørslene ut uten bevis, og
//  overvåkingen i Firebase-konsollen viser feil bilde.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appCheckModus, APP_CHECK_NOKKEL } from "../../js/data/app-check.js";

const sted = (hostname) => ({ hostname });

test("ekte på historieappen.no, feilsøking på localhost, ellers ingen", () => {
  for (const host of ["historieappen.no", "www.historieappen.no", "HISTORIEAPPEN.NO"]) {
    assert.equal(appCheckModus(sted(host)), "ekte", host);
  }
  for (const host of ["localhost", "127.0.0.1"]) {
    assert.equal(appCheckModus(sted(host)), "feilsoking", host);
  }
  for (const host of ["eiriksorbo.github.io", "historieappen.no.evil.com", "localhost.evil.com", ""]) {
    assert.equal(appCheckModus(sted(host)), null, host);
  }
  assert.equal(appCheckModus(undefined), null);
});

test("feilsøkingsbeviset står aldri i koden, bare flagget som lar biblioteket lage det", () => {
  const kilde = ["js/data/app-check.js", "js/data/store.js"]
    .map((f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(kilde, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.match(kilde, /if \(APP_CHECK === "feilsoking"\) self\.FIREBASE_APPCHECK_DEBUG_TOKEN = true;/);
});

test("nøkkelen ser ut som en reCAPTCHA-nøkkel", () => {
  assert.match(APP_CHECK_NOKKEL, /^6L[\w-]{38}$/);
});

test("store.js starter App Check før Firestore og Auth, og ikke i emulatormodus", () => {
  const store = readFileSync(new URL("../../js/data/store.js", import.meta.url), "utf8");
  const start = store.indexOf("initializeAppCheck(app");
  assert.ok(start > 0, "initializeAppCheck kalles");
  assert.ok(start < store.indexOf("initializeFirestore(app"), "før Firestore");
  assert.ok(start < store.indexOf("getAuth(app)"), "før Auth");
  assert.match(store, /const APP_CHECK = EMULATOR \? null : appCheckModus\(\);/);
  assert.match(store, /if \(APP_CHECK\) \{\s*try \{\s*if \(APP_CHECK === "feilsoking"\)[^\n]*\n\s*initializeAppCheck\(app, \{\s*provider: new ReCaptchaEnterpriseProvider\(APP_CHECK_NOKKEL\)/);
});

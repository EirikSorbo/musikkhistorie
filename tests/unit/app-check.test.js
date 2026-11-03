// ============================================================================
//  APP CHECK (js/data/app-check.js, v7.22)
// ----------------------------------------------------------------------------
//  App Check skal bare startes på historieappen.no, aldri i emulatormodus, og
//  før Firestore og Auth i store.js. Ellers går de første forespørslene ut
//  uten bevis, og overvåkingen i Firebase-konsollen viser feil bilde.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appCheckSkalBrukes, APP_CHECK_NOKKEL } from "../../js/data/app-check.js";

const sted = (hostname) => ({ hostname });

test("bare på historieappen.no", () => {
  for (const host of ["historieappen.no", "www.historieappen.no", "HISTORIEAPPEN.NO"]) {
    assert.equal(appCheckSkalBrukes(sted(host)), true, host);
  }
  for (const host of ["localhost", "127.0.0.1", "eiriksorbo.github.io", "historieappen.no.evil.com", ""]) {
    assert.equal(appCheckSkalBrukes(sted(host)), false, host);
  }
  assert.equal(appCheckSkalBrukes(undefined), false);
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
  assert.match(store, /if \(!EMULATOR && appCheckSkalBrukes\(\)\) \{\s*try \{\s*initializeAppCheck\(app, \{\s*provider: new ReCaptchaEnterpriseProvider\(APP_CHECK_NOKKEL\)/);
});

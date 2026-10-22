// ============================================================================
//  EMULATORBRYTEREN (js/data/emulator.js, v7.13)
// ----------------------------------------------------------------------------
//  Nettlesertestene kobler appen til Firebase-emulatoren. Bryteren er
//  sikkerhetsgrensen: den skal ALDRI slå inn på historieappen.no, bare på
//  localhost med ?emulator=1, og emulatormodus skal aldri bære noe fra det
//  ekte prosjektet.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emulatorModus, EMULATOR_KONFIG, EMULATOR_PROSJEKT } from "../../js/data/emulator.js";
import { firebaseConfig } from "../../js/firebase-config.js";

function lager() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const sted = (hostname, search = "") => ({ hostname, search });

test("aldri på historieappen.no, heller ikke med flagget eller et lagret valg", () => {
  const l = lager();
  l.setItem("pensum-emulator", "1");
  for (const host of ["historieappen.no", "www.historieappen.no", "eiriksorbo.github.io", "localhost.evil.com", ""]) {
    assert.equal(emulatorModus(sted(host, "?emulator=1"), l), false, host);
  }
});

test("på localhost bare med ?emulator=1, og valget huskes i fanen", () => {
  const l = lager();
  assert.equal(emulatorModus(sted("localhost"), l), false, "uten flagget");
  assert.equal(emulatorModus(sted("localhost", "?emulator=0"), l), false);
  assert.equal(emulatorModus(sted("localhost", "?emulator=1"), l), true);
  assert.equal(emulatorModus(sted("localhost", "?vis=artister"), l), true, "huskes ved neste side");
  assert.equal(emulatorModus(sted("127.0.0.1", "?emulator=1"), lager()), true);
});

test("tåler at lageret kaster", () => {
  const kaster = { getItem() { throw new Error("blokkert"); }, setItem() { throw new Error("blokkert"); } };
  assert.equal(emulatorModus(sted("localhost", "?emulator=1"), kaster), false);
});

test("emulatorkonfigurasjonen har ingenting fra det ekte prosjektet", () => {
  assert.equal(EMULATOR_KONFIG.projectId, EMULATOR_PROSJEKT);
  assert.match(EMULATOR_PROSJEKT, /^demo-/, "demo-prosjekter når aldri ekte Google-tjenester");
  for (const [k, v] of Object.entries(EMULATOR_KONFIG)) {
    assert.ok(!Object.values(firebaseConfig).includes(v), `${k} er hentet fra det ekte prosjektet`);
  }
});

test("store.js kobler til emulatoren bare i emulatormodus, og testinnloggingen bare der", () => {
  const src = readFileSync(new URL("../../js/data/store.js", import.meta.url), "utf8");
  assert.match(src, /const EMULATOR = emulatorModus\(\);/);
  assert.match(src, /initializeApp\(EMULATOR \? EMULATOR_KONFIG : firebaseConfig\)/);
  const blokk = src.slice(src.indexOf("const auth = getAuth(app);"), src.indexOf("const googleProvider"));
  assert.match(blokk, /^const auth = getAuth\(app\);\nif \(EMULATOR\) \{/, "alt det andre står inne i if (EMULATOR)");
  assert.equal((src.match(/__pensumTest/g) || []).length, 1, "testinnloggingen settes bare ett sted");
  assert.equal((src.match(/connectFirestoreEmulator\(/g) || []).length, 1);
  assert.equal((src.match(/connectAuthEmulator\(/g) || []).length, 1);
});

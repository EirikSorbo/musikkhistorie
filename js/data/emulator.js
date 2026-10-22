// ============================================================================
//  EMULATORBRYTEREN — appen mot Firebase-emulatoren i nettlesertestene (v7.13)
// ----------------------------------------------------------------------------
//  Nettlesertestene (tests/e2e/) kjører hele appen mot Firebase-emulatoren,
//  en lukket kopi av databasen og innloggingen på testmaskinen, under det
//  oppdiktede prosjektet demo-pensum. Den ekte databasen røres aldri.
//
//  Bryteren slår bare inn når BEGGE gjelder:
//    - siden kjøres fra localhost eller 127.0.0.1 (aldri på historieappen.no)
//    - adressen har ?emulator=1. Valget huskes i sessionStorage for resten av
//      fanen, så det følger med når testen går fra side til side.
//  Ellers er appen som før. Slår den likevel inn ved en feil, finner appen
//  ingen database og virker ikke for den brukeren; den åpner ingenting.
//
//  Ren modul (Node-testbar): stedet og lageret kan gis inn.
// ============================================================================

export const EMULATOR_PROSJEKT = "demo-pensum";
export const EMULATOR_FIRESTORE = { host: "127.0.0.1", port: 8080 };
export const EMULATOR_AUTH = "http://127.0.0.1:9099";
const NOKKEL = "pensum-emulator";
const LOKALE = new Set(["localhost", "127.0.0.1"]);

export function emulatorModus(sted = globalThis.location, lager = globalThis.sessionStorage) {
  if (!LOKALE.has(String(sted?.hostname || ""))) return false;
  try {
    if (new URLSearchParams(String(sted?.search || "")).get("emulator") === "1") lager?.setItem(NOKKEL, "1");
    return lager?.getItem(NOKKEL) === "1";
  } catch (e) {
    return false;
  }
}

// Konfigurasjonen i emulatormodus: ingen nøkler eller id-er fra det ekte
// prosjektet, så ingenting kan nå det, selv ved en feil.
export const EMULATOR_KONFIG = Object.freeze({
  apiKey: "demo-nokkel",
  authDomain: "localhost",
  projectId: EMULATOR_PROSJEKT,
  appId: "demo-app",
});

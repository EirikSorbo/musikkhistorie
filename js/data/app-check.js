// ============================================================================
//  APP CHECK — bevis på at forespørslene kommer fra historieappen.no (v7.22)
// ----------------------------------------------------------------------------
//  Lesekvoten ble tømt 2. og 3. november av noe som leste hele innholdet på
//  nytt omtrent hvert 40. sekund. Reglene lar alle lese, så hvem som helst kan
//  gjøre det med API-nøkkelen fra firebase-config.js. App Check (Fraud Defense,
//  tidligere reCAPTCHA Enterprise) gir hver nettleser som kjører appen et
//  bevis, og Firestore merker forespørslene som godkjente eller ukjente.
//
//  Foreløpig bare OVERVÅKING: håndhevingen («Enforce» i Firebase-konsollen)
//  er av, så forespørsler uten bevis slipper fortsatt gjennom. Slås den på,
//  stenges alt annet enn historieappen.no ute, også localhost mot det ekte
//  prosjektet. Da trengs et feilsøkingsbevis (debug token) for lokal testing.
//
//  Nøkkelen er offentlig (den sendes til alle nettlesere), og den virker bare
//  på domenet historieappen.no med underdomener.
//
//  Ren modul (Node-testbar): stedet kan gis inn.
// ============================================================================

export const APP_CHECK_NOKKEL = "6LeuyQ4uAAAAAAKhxwhYMYNLShg78Duw5bp4z9VA";

const VERTER = new Set(["historieappen.no", "www.historieappen.no"]);

// Bare på det ekte domenet: på localhost ville reCAPTCHA avvist nøkkelen og
// fylt konsollen med feil, og nettlesertestene kjører mot emulatoren uansett.
export function appCheckSkalBrukes(sted = globalThis.location) {
  return VERTER.has(String(sted?.hostname || "").toLowerCase());
}

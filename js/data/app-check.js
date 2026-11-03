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
//  stenges alt annet enn historieappen.no ute.
//
//  Localhost mot det ekte prosjektet (v7.23) får et feilsøkingsbevis i stedet
//  for reCAPTCHA. Biblioteket lager det selv første gang, lagrer det i
//  nettleseren for den adressen (localhost:8077 er en annen enn :8731) og
//  skriver det i konsollen. Det virker først når det er lagt inn under App
//  Check → Apps → ⋮ → Manage debug tokens. Beviset står aldri i koden: det
//  ville gitt alle som leser repoet en vei forbi håndhevingen.
//
//  Nøkkelen er offentlig (den sendes til alle nettlesere), og den virker bare
//  på domenet historieappen.no med underdomener.
//
//  Ren modul (Node-testbar): stedet kan gis inn.
// ============================================================================

export const APP_CHECK_NOKKEL = "6LeuyQ4uAAAAAAKhxwhYMYNLShg78Duw5bp4z9VA";

const VERTER = new Set(["historieappen.no", "www.historieappen.no"]);
const LOKALE = new Set(["localhost", "127.0.0.1"]);

// «ekte» på historieappen.no, «feilsoking» på localhost, ellers ingen: på
// andre adresser ville reCAPTCHA avvist nøkkelen. Emulatormodus (også
// localhost) sjekkes i store.js, der App Check aldri startes.
export function appCheckModus(sted = globalThis.location) {
  const vert = String(sted?.hostname || "").toLowerCase();
  if (VERTER.has(vert)) return "ekte";
  if (LOKALE.has(vert)) return "feilsoking";
  return null;
}

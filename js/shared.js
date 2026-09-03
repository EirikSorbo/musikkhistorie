// ============================================================================
//  DELTE HJELPERE — brukes av alle sider
// ============================================================================

import { firebaseConfig } from "./firebase-config.js?v=5.11";
import { VERSION } from "./version.js?v=5.11";

export const CONFIGURED = !String(firebaseConfig.apiKey).startsWith("DIN_");

export const $ = (sel) => document.querySelector(sel);

const vEl = document.getElementById("app-version");
if (vEl) vEl.textContent = `v${VERSION}`;

// Viser oppsett-banneret når Firebase ikke er koblet til
export function showSetupBanner(extra = "") {
  const banner = $("#banner");
  if (!banner) return;
  banner.innerHTML = `
    <strong>Oppsettmodus.</strong> Firebase er ikke koblet til ennå, så
    ingenting lagres eller deles. ${extra}
    Følg <code>README.md</code> for å koble til databasen (ca. 5 min).
  `;
  banner.classList.add("show");
}

// Kobler #banner til firestore-error-hendelsene fra datalaget (store.js), så
// siden viser en forklarende feilmelding i stedet for å feile stille når
// Firestore-lesing avvises (typisk upubliserte regler).
// Feilteksten var HARDKODET til «reglene tillater trolig ikke lesing … publiser
// oppdaterte regler», men onSubscribeError sender ALLE lesefeil hit. Da
// lesekvoten gikk tom 2026-09-02, fikk studentene og læreren en melding som
// pekte på feil årsak, og en regelpublisering ville ikke hjulpet.
const FEILTEKST = {
  // Firestores gratiskvote (50 000 lesinger) nullstilles ved midnatt Pacific.
  "resource-exhausted":
    "Databasen har brukt opp dagens lesekvote. Appen virker igjen når kvoten nullstilles (ved midnatt Pacific-tid, altså rundt klokka 09 norsk tid). Ingenting er tapt.",
  "permission-denied":
    "Firestore-reglene tillater ikke lesing uten innlogging. Publiser oppdaterte regler i Firebase Console.",
  unavailable:
    "Får ikke kontakt med databasen. Sjekk nettforbindelsen, og prøv igjen om litt.",
  "failed-precondition":
    "Databasen mangler en indeks eller er i en tilstand appen ikke forventet. Se konsollen for detaljer.",
  unauthenticated:
    "Innloggingen mot databasen mangler eller er utløpt. Last siden på nytt.",
};

export function wireFirestoreErrorBanner() {
  document.addEventListener("firestore-error", (e) => {
    const banner = $("#banner");
    if (!banner) return;
    const kode = e.detail?.code || "ukjent feil";
    const forklaring = FEILTEKST[kode]
      || "Kunne ikke laste data fra databasen. Se konsollen for detaljer.";
    banner.textContent = `${forklaring} (${kode})`;
    banner.className = "banner banner-error";
    banner.style.display = "block";
  });
}

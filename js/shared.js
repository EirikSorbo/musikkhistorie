// ============================================================================
//  DELTE HJELPERE — brukes av alle sider
// ============================================================================

import { firebaseConfig } from "./firebase-config.js";

// Er Firebase satt opp, eller kjører vi i oppsett-/utforskningsmodus?
export const CONFIGURED = !String(firebaseConfig.apiKey).startsWith("DIN_");

export const $ = (sel) => document.querySelector(sel);

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

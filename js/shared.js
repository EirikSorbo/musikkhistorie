// ============================================================================
//  DELTE HJELPERE — brukes av alle sider
// ============================================================================

import { firebaseConfig } from "./firebase-config.js?v=2.51";
import { VERSION } from "./version.js?v=2.51";

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

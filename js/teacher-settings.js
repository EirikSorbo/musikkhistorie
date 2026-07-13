// ============================================================================
//  LÆRER — INNSTILLINGER
// ----------------------------------------------------------------------------
//  Den eneste gjenværende konfig-innstillingen er instrument-vokabularet
//  (nedtrekksmenyene i forslagsskjema og filtre). Grense-apparatet fra
//  forslagsfasen (maks totalt / per tiår / sjanger / instrument) er fjernet
//  (v3.20); hovedsjangre utledes fra slektstreet og tiårene fra DECADES.
//  updateConfig skriver hele objektet, så en lagring her vasker samtidig ut
//  eventuelle gamle grense-felter fra Firestore-dokumentet.
// ============================================================================

import { state, splitList, setupModals } from "./teacher-state.js?v=3.26";
import { updateConfig } from "./store.js?v=3.26";
import { CONFIGURED, $ } from "./shared.js?v=3.26";

export function setupAdmin() {
  setupModals();

  $("#save-instruments").addEventListener("click", async () => {
    const msgEl = $("#msg-instruments");
    const instruments = splitList($("#cfg-instruments").value, state.config.instruments || []);

    if (!CONFIGURED) { msgEl.textContent = "Firebase ikke koblet til."; return; }
    // Fallback-config = standardverdier fordi lesingen feilet. Å lagre nå ville
    // overskrevet lærerens ekte liste med standard — blokker og forklar.
    if (state.configIsFallback) {
      msgEl.textContent = "Ikke lagret: konfigurasjonen kunne ikke leses fra databasen, så feltet viser standardverdier. Last siden på nytt før du lagrer.";
      return;
    }
    try {
      await updateConfig({ instruments });
      msgEl.textContent = "Lagret ✓";
      setTimeout(() => (msgEl.textContent = ""), 2500);
    } catch (err) {
      msgEl.textContent = "Feil ved lagring: " + (err?.message || err);
    }
  });
}

export function fillAdminForm() {
  $("#cfg-instruments").value = (state.config.instruments || []).join(", ");
}

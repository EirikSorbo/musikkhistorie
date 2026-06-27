// ============================================================================
//  SMÅ DELTE HJELPERE
// ----------------------------------------------------------------------------
//  Avhengighetsfrie pure-funksjoner som brukes flere steder. Holdes uten
//  imports, så de trygt kan deles av moduler som ellers ville fått en syklus.
// ============================================================================

// Escaper tekst for trygg innsetting i HTML (innhold og attributter).
export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

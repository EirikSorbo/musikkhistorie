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

// Strukturert kilde-liste (artist, sjanger, tiår, slektstre). Lagt her — uten
// avhengigheter — så både genealogy og ui-helpers kan dele samme implementasjon.
export function buildKilderList(kilder, label = "Kilder") {
  if (!Array.isArray(kilder) || !kilder.length) return "";
  const items = kilder.map((k) => {
    const text = escapeHtml(k.text || "");
    return k.url
      ? `<li><a href="${escapeHtml(k.url)}" target="_blank" rel="noopener">${text}</a></li>`
      : `<li>${text}</li>`;
  }).join("");
  return `<div class="kilder"><strong>${escapeHtml(label)}:</strong><ul>${items}</ul></div>`;
}

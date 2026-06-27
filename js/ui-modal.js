// ============================================================================
//  UI — MODALER
// ----------------------------------------------------------------------------
//  Felles åpne/lukke-logikk for popup-modaler. Re-eksporteres fra ui.js, så
//  resten av appen importerer dem derfra som før.
// ============================================================================

window._modalZ = window._modalZ || 100;
export function modalOpen(el) { el.style.zIndex = ++window._modalZ; el.classList.add("open"); }
export function modalClose(el) { el.classList.remove("open"); }
export function modalCloseTop() {
  const open = [...document.querySelectorAll(".modal-backdrop.open")];
  if (!open.length) return;
  open.sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));
  modalClose(open[open.length - 1]);
}
export function modalCloseAll() {
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => modalClose(m));
}

// Standardoppkobling av en modal: lukk ved klikk på bakgrunnen og på ←-knappen.
// `onClose` lar f.eks. spilleliste-popupen gå «tilbake» i stedet for å bare lukke.
export function setupModal(idOrEl, onClose) {
  const m = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
  if (!m) return;
  const close = onClose || (() => modalClose(m));
  m.addEventListener("click", (e) => { if (e.target === m) close(); });
  m.querySelector(".modal-close")?.addEventListener("click", close);
}

// Konverter eksisterende ✕-knapp til ←-tilbakeknapp og injiser ny ✕ for "lukk alle".
function initModalHeaders() {
  document.querySelectorAll(".modal-head").forEach((head) => {
    const closeBtn = head.querySelector(".modal-close");
    if (!closeBtn || head.querySelector(".modal-close-all")) return;
    closeBtn.innerHTML = "&larr;";
    closeBtn.title = "Tilbake";
    const closeAll = document.createElement("button");
    closeAll.type = "button";
    closeAll.className = "modal-close-all btn ghost small";
    closeAll.innerHTML = "&times;";
    closeAll.title = "Lukk alle";
    closeAll.addEventListener("click", modalCloseAll);
    closeBtn.parentNode.insertBefore(closeAll, closeBtn.nextSibling);
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initModalHeaders);
} else {
  initModalHeaders();
}

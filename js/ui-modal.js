// ============================================================================
//  UI — MODALER
// ----------------------------------------------------------------------------
//  Felles åpne/lukke-logikk for popup-modaler. Re-eksporteres fra ui.js, så
//  resten av appen importerer dem derfra som før.
//
//  Tilgjengelighet (WCAG): modalOpen setter role="dialog"/aria-modal, flytter
//  fokus inn i dialogen og husker hvor fokus sto; modalCloseTop/modalClose
//  flytter fokus tilbake. En global Tab-felle holder fokus inne i den øverste
//  åpne modalen.
// ============================================================================

// Toppnivå-side-effekter guardes så modulen også kan lastes i Node (tester
// importerer moduler som transitivt drar inn denne).
const IS_BROWSER = typeof document !== "undefined";
if (IS_BROWSER) window._modalZ = window._modalZ || 100;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(backdrop) {
  return [...backdrop.querySelectorAll(FOCUSABLE)]
    .filter((el) => el.offsetParent !== null);
}

function topOpenModal() {
  const open = [...document.querySelectorAll(".modal-backdrop.open")];
  if (!open.length) return null;
  open.sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));
  return open[open.length - 1];
}

export function modalOpen(el) {
  el.style.zIndex = ++window._modalZ;
  const dialog = el.querySelector(".modal");
  if (dialog) {
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const h = el.querySelector(".modal-head h2");
    if (h) {
      if (!h.id) h.id = (el.id || "modal") + "-label";
      dialog.setAttribute("aria-labelledby", h.id);
    }
    if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
  }
  // Husk hvor fokus sto (per modal, så nøstede popuper går riktig tilbake).
  el._restoreFocus = document.activeElement;
  el.classList.add("open");
  (focusables(el)[0] || dialog)?.focus();
}

export function modalClose(el) {
  el.classList.remove("open");
  if (el._restoreFocus && document.contains(el._restoreFocus)) {
    el._restoreFocus.focus();
  }
  el._restoreFocus = null;
}

export function modalCloseTop() {
  const top = topOpenModal();
  if (top) modalClose(top);
}

function modalCloseAll() {
  document.querySelectorAll(".modal-backdrop.open").forEach((m) => modalClose(m));
}

// Fokusfelle: Tab sirkulerer inne i den øverste åpne modalen.
if (IS_BROWSER) document.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const top = topOpenModal();
  if (!top) return;
  const foc = focusables(top);
  if (!foc.length) return;
  const first = foc[0], last = foc[foc.length - 1];
  if (!top.contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

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
// Idempotent (hopper over modaler som allerede har .modal-close-all), så den kan
// kjøres på nytt etter at flere modaler er injisert dynamisk (se explore.js).
export function initModalHeaders() {
  document.querySelectorAll(".modal-head").forEach((head) => {
    const closeBtn = head.querySelector(".modal-close");
    if (!closeBtn || head.querySelector(".modal-close-all")) return;
    closeBtn.innerHTML = "&larr;";
    closeBtn.title = "Tilbake";
    closeBtn.setAttribute("aria-label", "Tilbake");
    const closeAll = document.createElement("button");
    closeAll.type = "button";
    closeAll.className = "modal-close-all btn ghost small";
    closeAll.innerHTML = "&times;";
    closeAll.title = "Lukk alle";
    closeAll.setAttribute("aria-label", "Lukk alle");
    closeAll.addEventListener("click", modalCloseAll);
    closeBtn.parentNode.insertBefore(closeAll, closeBtn.nextSibling);
  });
}
if (IS_BROWSER) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModalHeaders);
  } else {
    initModalHeaders();
  }
}

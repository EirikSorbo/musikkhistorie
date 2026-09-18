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

// Øverste åpne modal (høyest z-index), eller null. Eksportert (v5.38) for
// presentasjonens «Legg til her» og samleøktas +-tast: begge trenger målet
// til kortet som ligger øverst.
export function topOpenModal() {
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
  // KUN ved faktisk åpning: re-åpnes en allerede åpen modal (f.eks. klikk på en
  // chip inne i detaljmodalen → openDetail på nytt), ville dette ellers pekt på
  // et element inne i modalen som re-renderingen straks fjerner, og den
  // opprinnelige utløseren utenfor mister fokusrestaureringen.
  if (!el.classList.contains("open")) el._restoreFocus = document.activeElement;
  // «Kopier lenke» (v5.22) vises bare når backdropen bærer et mål: åpnerne
  // setter data-vis for dynamiske mål (artist, tiår, …) rett før modalOpen,
  // markupen for de statiske (varmekart, sidene, …).
  const lenkeKnapp = el.querySelector(".modal-head .modal-lenke");
  if (lenkeKnapp) lenkeKnapp.hidden = !el.dataset.vis;
  // Samleøktas plussknapp (v5.27, injiseres av plan-innsamling.js) følger
  // samme regel som lenkeknappen: bare mål som kan bli et stopp.
  const plussKnapp = el.querySelector(".modal-head .plan-pluss");
  if (plussKnapp) plussKnapp.hidden = !el.dataset.vis;
  // Samleøkt-kroken (v5.27): hver faktiske åpning av et lenkbart mål meldes
  // til leverandøren — plan-innsamling.js tar opp (opptak) eller sørger for
  // plussknapp (plukk, også på modaler laget etter øktstart, som spilleren).
  if (el.dataset.vis) modalApnetProvider?.(el.dataset.vis, el);
  el.classList.add("open");
  (focusables(el)[0] || dialog)?.focus();
}

// En modal kan sette el._beforeClose = () => boolean. Returnerer den false,
// AVBRYTES lukkingen: hooken har tatt over (typisk «spør først»), og lukker
// selv etterpå ved å sette el._skipBeforeClose = true rett før neste kall.
// Kroken sitter her fordi ALLE lukkeveiene går gjennom modalClose: ✕, ←,
// «Lukk alle», Escape (modalCloseTop) og klikk på bakgrunnen. En hook per
// knapp ville måttet gjentas fem steder, og Escape ville uansett gått forbi.
export function modalClose(el) {
  const hopp = el._skipBeforeClose;
  el._skipBeforeClose = false;
  if (!hopp && typeof el._beforeClose === "function" && el._beforeClose() === false) return;
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
  // Idempotent: kalles setupModal to ganger på samme modal (podkast-admin ble
  // koblet ved hver åpning), får den doble lyttere, og lukkingen spør to
  // ganger om avspilling. Fjerner hele klassen, også de latente tilfellene.
  if (m.dataset.modalWired) return;
  m.dataset.modalWired = "1";
  const close = onClose || (() => modalClose(m));
  m.addEventListener("click", (e) => { if (e.target === m) close(); });
  m.querySelector(".modal-close")?.addEventListener("click", close);
}

// «Kopier lenke» (v5.22): dyplenke til modalens gjeldende innhold, lest fra
// backdropens data-vis. Kvitteringen skjer i selve knappen (lenke → hake);
// timeren flipper bare ikonet tilbake, så den er ufarlig om modalen lukkes.
const LENKE_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
const HAKE_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

// Modernt API først; execCommand som reserve. Verifisert nødvendig i praksis:
// innebygde/administrerte nettlesere kan nekte Clipboard-API-et («Write
// permission denied») selv med ekte klikk, og skolemaskiner har ofte samme
// sperre. execCommand krever bare brukerbevegelsen, som klikket er.
function kopierTilUtklipp(tekst) {
  return navigator.clipboard.writeText(tekst).catch(() => new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = tekst;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    if (ok) resolve(); else reject(new Error("utklippstavle sperret"));
  }));
}

// «Legg til i kjøreplan»-menyen (v5.26). ui-modal kjenner bevisst ingen
// Firestore (testene importerer denne fila via ui.js, og store.js drar inn
// SDK-en over nett) — sidene registrerer i stedet en leverandør som får
// knappen etter hvert kopiklikk. js/plan-meny.js kobler den på, og viser
// menyen bare når nettleseren er logget inn som lærer.
let lenkeMenyProvider = null;
export function setLenkeMenyProvider(fn) { lenkeMenyProvider = fn; }

// Kalles fra modalOpen med modalens data-vis — opptaksmodusen i
// plan-innsamling.js (v5.27) lytter. Samme frikobling som lenkeMenyProvider:
// ui-modal skal aldri dra inn Firestore.
let modalApnetProvider = null;
export function setModalApnetProvider(fn) { modalApnetProvider = fn; }

async function kopierVisLenke(knapp) {
  const verdi = knapp.closest(".modal-backdrop")?.dataset.vis;
  if (!verdi) return;
  lenkeMenyProvider?.(knapp);
  // Lenken peker alltid på forsiden — det er den som har ?vis=-ruteren, og
  // fra lærersiden/tre-siden ligger index.html i samme mappe.
  const url = new URL("index.html", window.location.href);
  url.searchParams.set("vis", verdi);
  try {
    await kopierTilUtklipp(url.href);
    knapp.focus();   // execCommand-reserven flytter fokus via textarea-en
    knapp.innerHTML = HAKE_SVG;
    knapp.title = "Lenke kopiert";
    clearTimeout(knapp._kvittering);
    knapp._kvittering = setTimeout(() => {
      knapp.innerHTML = LENKE_SVG;
      knapp.title = "Kopier lenke";
    }, 1400);
  } catch (e) {
    // Utklippstavla kan være sperret (styrte profiler, eldre nettlesere):
    // vis lenken, så den kan kopieres for hånd.
    window.prompt("Kopier lenken:", url.href);
  }
}

// Konverter eksisterende ✕-knapp til ←-tilbakeknapp og injiser ny ✕ for "lukk alle",
// pluss «Kopier lenke»-knappen foran dem.
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
    const lenke = document.createElement("button");
    lenke.type = "button";
    lenke.className = "modal-lenke btn ghost small";
    lenke.title = "Kopier lenke";
    lenke.setAttribute("aria-label", "Kopier lenke");
    lenke.hidden = true;   // modalOpen slår den på når backdropen har data-vis
    lenke.innerHTML = LENKE_SVG;
    lenke.addEventListener("click", () => kopierVisLenke(lenke));
    closeBtn.parentNode.insertBefore(lenke, closeBtn);
  });
}
if (IS_BROWSER) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModalHeaders);
  } else {
    initModalHeaders();
  }
}

// ----------------------------------------------------------------------------
//  LITEN VALG-DIALOG
// ----------------------------------------------------------------------------
//  Bygges i farten i stedet for som markup i sidene: den trengs på forsiden,
//  lærersiden og tre-siden, og tre kopier av samme HTML ville drevet fra
//  hverandre. Bruker de samme klassene som de faste modalene, så den arver
//  utseende, z-index-stabling og fokusfelle uten egen CSS.
//
//  Returnerer valgets `value`. Escape og klikk på bakgrunnen gir
//  `dismissValue` — sett den til det ufarlige valget, siden det er dét en
//  bortkommen Escape havner på.
export function askChoice({ title, text = "", buttons = [], dismissValue = null }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const dialog = document.createElement("div");
    // modal-valg: presentasjonens brede kort (v5.36) gjelder ikke små dialoger.
    dialog.className = "modal modal-valg";
    backdrop.append(dialog);

    const head = document.createElement("div");
    head.className = "modal-head";
    const h = document.createElement("h2");
    h.textContent = title;
    head.append(h);
    dialog.append(head);

    if (text) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = text;
      dialog.append(p);
    }

    const foot = document.createElement("div");
    foot.className = "modal-foot-right";
    foot.style.gap = "8px";
    dialog.append(foot);

    // Idempotent: både knappene, bakgrunnsklikket og Escape lander her, og
    // bare det første kallet teller.
    let ferdig = false;
    const avslutt = (value) => {
      if (ferdig) return;
      ferdig = true;
      backdrop._beforeClose = null;
      backdrop._skipBeforeClose = true;
      modalClose(backdrop);
      backdrop.remove();
      resolve(value);
    };

    for (const b of buttons) {
      const knapp = document.createElement("button");
      knapp.type = "button";
      knapp.className = `btn ${b.className || "ghost"}`;
      knapp.textContent = b.label;
      knapp.addEventListener("click", () => avslutt(b.value));
      foot.append(knapp);
    }

    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) avslutt(dismissValue); });
    // Escape går via modalCloseTop → modalClose, altså gjennom kroken over.
    backdrop._beforeClose = () => { avslutt(dismissValue); return false; };

    document.body.append(backdrop);
    modalOpen(backdrop);
  });
}

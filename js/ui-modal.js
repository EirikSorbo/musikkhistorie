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
// ---------------------------------------------------------------------------
//  ADRESSE OG TILBAKEKNAPP (v6.08, strukturgjennomgangen S7)
// ---------------------------------------------------------------------------
//  Et kort med mål (data-vis) får sin egen oppføring i nettleserens historikk,
//  med ?vis=<mål> i adressen. Tilbakeknappen (og sveipet på mobil) lukker da
//  det øverste kortet i stedet for å forlate appen, en oppdatering åpner
//  kortet igjen (ruteren i explore-apne.js leser ?vis=), og adressen kan
//  deles. Bare kort med data-vis: skjemaer og redigering har ingen adresse,
//  og tilbakeknappen lukker aldri et halvskrevet skjema (oppføringen legges
//  tilbake). Av i presentasjonsvisningen, som styrer adressen selv.
const histStabel = [];   // backdrops med egen oppføring, nederst først
let histIgnorer = 0;     // popstate-hendelser vi selv utløste (back/go)
let histFraPop = false;  // lukking fra tilbakeknappen: ikke rør historikken

function histPaa() {
  return IS_BROWSER && !!window.history?.pushState && !document.body.classList.contains("presentasjon");
}

function adresseMedVis(vis) {
  const u = new URL(window.location.href);
  if (vis) u.searchParams.set("vis", vis);
  else u.searchParams.delete("vis");
  return u.pathname + u.search + u.hash;
}

function histApnet(el) {
  if (!histPaa() || !el.dataset.vis) return;
  const i = histStabel.indexOf(el);
  if (i !== -1) {
    // Samme kort med nytt innhold (f.eks. en sjanger fra et sjangerkort):
    // adressen følger, uten ny oppføring. Ligger kortet lenger ned (en
    // sjangerboble på et artistkort som står over sjangerkortet), heves det
    // også i stabelen, så den følger det som faktisk ligger øverst. Før
    // v6.23 ble det bare hevet på skjermen, og popstate tolket det som et
    // skjema over kortet: tilbakeknappen gjorde ingenting (Fable F1).
    if (i !== histStabel.length - 1) {
      histStabel.splice(i, 1);
      histStabel.push(el);
    }
    window.history.replaceState(window.history.state, "", adresseMedVis(el.dataset.vis));
    return;
  }
  histStabel.push(el);
  window.history.pushState({ pensumModal: el.id || true }, "", adresseMedVis(el.dataset.vis));
}

// Kalles når et kort faktisk er lukket. Lukket brukeren det (✕, ←, Escape,
// bakgrunnen), går historikken ett steg tilbake så den følger stabelen.
function histLukket(el) {
  const i = histStabel.indexOf(el);
  if (i === -1) return;
  histStabel.splice(i, 1);
  if (!histFraPop && histPaa()) {
    histIgnorer++;
    window.history.back();
  }
}

if (IS_BROWSER) {
  window.addEventListener("popstate", (e) => {
    if (histIgnorer > 0) {
      histIgnorer--;
      // Alle kortene er lukket og vi står på sidens første oppføring: ingen
      // ?vis= som peker på et lukket kort.
      if (!histStabel.length && !e.state?.pensumModal && new URL(window.location.href).searchParams.has("vis")) {
        window.history.replaceState(window.history.state, "", adresseMedVis(null));
      }
      return;
    }
    const top = histStabel[histStabel.length - 1];
    if (top) {
      const overst = topOpenModal();
      // Et skjema (uten adresse) ligger over kortet: legg oppføringen tilbake.
      if (overst && overst !== top) {
        window.history.pushState({ pensumModal: top.id || true }, "", adresseMedVis(top.dataset.vis));
        return;
      }
      histFraPop = true;
      try { modalClose(top); } finally { histFraPop = false; }
      // Lukkingen ble avbrutt (_beforeClose, f.eks. «spør først»): kortet står,
      // så oppføringen må tilbake.
      if (top.classList.contains("open")) {
        window.history.pushState({ pensumModal: top.id || true }, "", adresseMedVis(top.dataset.vis));
        return;
      }
      // Oppføringen vi landet på kan tilhøre et kort som siden ble hevet og
      // har byttet plass i stabelen (histApnet): adressen følger kortet som
      // nå ligger øverst.
      const nyTopp = histStabel[histStabel.length - 1];
      if (nyTopp?.dataset.vis) {
        window.history.replaceState(window.history.state, "", adresseMedVis(nyTopp.dataset.vis));
        return;
      }
    }
    // Tilbake på sidens første oppføring: ingen ?vis= som peker på et lukket kort.
    if (!e.state?.pensumModal && new URL(window.location.href).searchParams.has("vis")) {
      window.history.replaceState(window.history.state, "", adresseMedVis(null));
    }
  });
  // Målet kan skifte mens kortet står åpent (tiårsfanene, stripa, varmekartets
  // metasjanger): adressen følger det øverste kortet.
  if ("MutationObserver" in window) {
    new MutationObserver((recs) => {
      const top = histStabel[histStabel.length - 1];
      if (!top || !histPaa() || !top.dataset.vis) return;
      if (recs.some((r) => r.target === top)) {
        window.history.replaceState(window.history.state, "", adresseMedVis(top.dataset.vis));
      }
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-vis"] });
  }
}

// Sjangerkortet som sidepanel på slektstresiden (S8, brede skjermer): treet
// til venstre skal kunne brukes mens panelet står, så panelet er ikke modalt
// for skjermlesere (aria-modal) og har ingen Tab-felle (v6.23, Fable).
function erSidepanel(el) {
  return IS_BROWSER && el?.id === "modal-sjanger"
    && document.body.classList.contains("tre-side")
    && !document.body.classList.contains("presentasjon")
    && !!window.matchMedia?.("(min-width: 1100px)").matches;
}

// Piltastene i en fanerad (ARIA-mønsteret for faner, v6.23): venstre/høyre
// går til forrige/neste fane og velger den, Home/End til første/siste. Bare
// den valgte fanen er i Tab-rekkefølgen (tabindex settes der fanene tegnes).
export function kobleFanePiler(rad, velger = '[role="tab"]') {
  if (!rad || rad.dataset.pilerKoblet) return;
  rad.dataset.pilerKoblet = "1";
  rad.addEventListener("keydown", (e) => {
    const faner = [...rad.querySelectorAll(velger)].filter((f) => !f.hidden);
    const i = faner.indexOf(document.activeElement);
    if (i === -1) return;
    const ny = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: faner.length - 1 }[e.key];
    if (ny === undefined) return;
    e.preventDefault();
    const fane = faner[(ny + faner.length) % faner.length];
    fane.focus();
    fane.click();
  });
}

// En fanerad som rulles sidelengs (smale skjermer): den valgte fanen rulles
// inn i synsfeltet, bare vannrett, så kortet ikke hopper (v6.23).
export function visValgtFane(rad) {
  const aktiv = rad?.querySelector(".active");
  if (!aktiv || rad.scrollWidth <= rad.clientWidth) return;
  const r = rad.getBoundingClientRect(), a = aktiv.getBoundingClientRect();
  if (a.left < r.left || a.right > r.right) {
    rad.scrollLeft += a.left - r.left - (r.width - a.width) / 2;
  }
}

export function topOpenModal() {
  const open = [...document.querySelectorAll(".modal-backdrop.open")];
  if (!open.length) return null;
  open.sort((a, b) => (parseInt(a.style.zIndex) || 0) - (parseInt(b.style.zIndex) || 0));
  return open[open.length - 1];
}

// ---------------------------------------------------------------------------
//  FANER SOM ER EGNE KORT (v6.12, brukervalg 2026-10-03)
// ---------------------------------------------------------------------------
//  Sjangre, Sjangerperioder, Varmekart, Artisttidslinje og Undersjangre er
//  egne kort (egne adresser, egne innganger i huben og fra tiårene), men står
//  som faner i samme vindu. Et fanebytte setter det nye kortet på det gamles
//  plass: samme oppføring i historikken (adressen byttes, ← går dit fanene ble
//  åpnet fra), fokus tilbake til samme utløser når vinduet lukkes, og ingen
//  inngangsanimasjon. `apne` er kortets vanlige åpner, så innholdet tegnes
//  som før. Står målet allerede åpent lenger ned i stabelen, lukkes alt som
//  ligger over det, og målet tegnes på nytt, så det samme kortet aldri ligger
//  to steder. Før v6.23 ble bare det øverste lukket, og et sjangerkort som lå
//  imellom kom til syne i stedet for målet (Fable F3).
let byttUt = null;
export function modalBytt(fra, til, apne) {
  if (!fra?.classList.contains("open")) { apne(); return; }
  if (til && til !== fra && til.classList.contains("open")) {
    const z = parseInt(til.style.zIndex) || 0;
    lukkFlere([...document.querySelectorAll(".modal-backdrop.open")]
      .filter((m) => (parseInt(m.style.zIndex) || 0) > z));
    apne();
    return;
  }
  byttUt = fra;
  try { apne(); } finally { byttUt = null; }
}

export function modalOpen(el) {
  const ut = byttUt && byttUt !== el && byttUt.classList.contains("open") ? byttUt : null;
  byttUt = null;
  el.classList.toggle("modal-bytt", !!ut);
  if (ut) {
    el._restoreFocus = ut._restoreFocus;
    ut._restoreFocus = null;
    ut.classList.remove("open");
    const i = histStabel.indexOf(ut);
    if (i !== -1) histStabel[i] = el;   // histApnet under bytter adressen
  }
  el.style.zIndex = ++window._modalZ;
  const dialog = el.querySelector(".modal");
  if (dialog) {
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", erSidepanel(el) ? "false" : "true");
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
  if (!el.classList.contains("open") && !ut) el._restoreFocus = document.activeElement;
  // «Kopier lenke» (v5.22) vises bare når backdropen bærer et mål: åpnerne
  // setter data-vis for dynamiske mål (artist, tiår, …) rett før modalOpen,
  // markupen for de statiske (varmekart, sidene, …).
  const lenkeKnapp = el.querySelector(".modal-head .modal-lenke");
  if (lenkeKnapp) lenkeKnapp.hidden = !el.dataset.vis;
  // Pila til menyen (v5.76) følger samme regel; CSS viser den bare når en
  // kjøreplan er aktiv.
  const menyPil = el.querySelector(".modal-head .modal-lenke-meny");
  if (menyPil) menyPil.hidden = !el.dataset.vis;
  // Samleøktas plussknapp (v5.27, injiseres av plan-innsamling.js) følger
  // samme regel som lenkeknappen: bare mål som kan bli et stopp.
  const plussKnapp = el.querySelector(".modal-head .plan-pluss");
  if (plussKnapp) plussKnapp.hidden = !el.dataset.vis;
  // Samleøkt-kroken (v5.27): hver faktiske åpning av et lenkbart mål meldes
  // til leverandøren — plan-innsamling.js tar opp (opptak) eller sørger for
  // plussknapp (plukk, også på modaler laget etter øktstart, som spilleren).
  if (el.dataset.vis) modalApnetProvider?.(el.dataset.vis, el);
  el.classList.add("open");
  histApnet(el);
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
  histLukket(el);
  if (el._restoreFocus && document.contains(el._restoreFocus)) {
    el._restoreFocus.focus();
  }
  el._restoreFocus = null;
}

export function modalCloseTop() {
  const top = topOpenModal();
  if (top) modalClose(top);
}

// Lukker flere kort på én gang, og historikken går tilbake i ett hopp for
// alle kortene som hadde en oppføring (flere history.back() etter hverandre
// er ikke pålitelig). Brukes av «Lukk alle» og av modalBytt.
function lukkFlere(kort) {
  const forHist = histStabel.length;
  histFraPop = true;
  try {
    kort.forEach((m) => modalClose(m));
  } finally { histFraPop = false; }
  const igjen = histStabel.length;
  const steg = forHist - igjen;
  if (steg > 0 && histPaa()) {
    histIgnorer++;
    window.history.go(-steg);
  }
}

// «Lukk alle».
function modalCloseAll() {
  lukkFlere([...document.querySelectorAll(".modal-backdrop.open")]);
}

// Fokusfelle: Tab sirkulerer inne i den øverste åpne modalen.
if (IS_BROWSER) document.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const top = topOpenModal();
  if (!top || erSidepanel(top)) return;
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

// Visningsknappen i modalhodene (v5.68, brukervalg 2026-09-25): ÉN måte å
// legge noe i en kjøreplan på, med samme ikon som Visning i toppmenyen.
// Knappen åpner «Legg til som stopp i»-menyen (js/plan-meny.js), der
// «Kopier lenke» (v5.22) nå bor som siste punkt. Fram til v5.67 var dette
// lenkeknappen, som kopierte lenken ved hvert klikk og viste menyen attåt.
export const VISNING_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M10 7.5l5 2.5-5 2.5z"/></svg>';

// Modernt API først; execCommand som reserve. Verifisert nødvendig i praksis:
// innebygde/administrerte nettlesere kan nekte Clipboard-API-et («Write
// permission denied») selv med ekte klikk, og skolemaskiner har ofte samme
// sperre. execCommand krever bare brukerbevegelsen, som klikket er.
export function kopierTilUtklipp(tekst) {
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
// visningsknappen ved hvert klikk. js/plan-meny.js kobler den på, og viser
// menyen bare når nettleseren er logget inn som lærer.
let lenkeMenyProvider = null;
export function setLenkeMenyProvider(fn) { lenkeMenyProvider = fn; }

// Kalles fra modalOpen med modalens data-vis — opptaksmodusen i
// plan-innsamling.js (v5.27) lytter. Samme frikobling som lenkeMenyProvider:
// ui-modal skal aldri dra inn Firestore.
let modalApnetProvider = null;
export function setModalApnetProvider(fn) { modalApnetProvider = fn; }

// «Kopier lenke» (v5.22; fra v5.68 et punkt i kjøreplan-menyen): dyplenke
// til målet. Lenken peker alltid på forsiden, som har ?vis=-ruteren, og fra
// lærersiden/tre-siden ligger index.html i samme mappe. Returnerer true når
// lenken ligger på utklippstavla; ellers vises den i en dialog, så den kan
// kopieres for hånd (styrte profiler og eldre nettlesere kan sperre
// utklippstavla).
export async function kopierVisLenke(verdi) {
  if (!verdi) return false;
  const url = new URL("index.html", window.location.href);
  url.searchParams.set("vis", verdi);
  try {
    await kopierTilUtklipp(url.href);
    return true;
  } catch (e) {
    visLenke("Kopier lenken:", url.href);
    return false;
  }
}

// Konverter eksisterende ✕-knapp til ←-tilbakeknapp og injiser ny ✕ for "lukk alle",
// pluss visningsknappen foran dem.
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
    // Klassen heter fortsatt modal-lenke: den er merket «hodet kan bære et
    // mål» for plan-innsamling.js og utskrift-utvalg.js. Bare synlig i en
    // lærerøkt (CSS, body.laerer-okt satt av plan-meny.js): bare læreren
    // har kjøreplaner å legge i.
    const lenke = document.createElement("button");
    lenke.type = "button";
    lenke.className = "modal-lenke btn ghost small";
    lenke.title = "Legg til i kjøreplan";
    lenke.setAttribute("aria-label", "Legg til i kjøreplan");
    lenke.hidden = true;   // modalOpen slår den på når backdropen har data-vis
    lenke.innerHTML = VISNING_SVG;
    lenke.addEventListener("click", () => lenkeMenyProvider?.(lenke));
    closeBtn.parentNode.insertBefore(lenke, closeBtn);
    // Pila (v5.76): når en kjøreplan er aktiv, legger knappen rett til, og
    // menyen med de andre planene ligger bak denne. Synlig bare da (CSS).
    const pil = document.createElement("button");
    pil.type = "button";
    pil.className = "modal-lenke-meny btn ghost small";
    pil.title = "Velg en annen kjøreplan, eller kopier lenke";
    pil.setAttribute("aria-label", "Velg kjøreplan");
    pil.hidden = true;
    pil.innerHTML = PIL_SVG;
    pil.addEventListener("click", () => lenkeMenyProvider?.(lenke, { meny: true }));
    closeBtn.parentNode.insertBefore(pil, closeBtn);
  });
}

const PIL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
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

// ---------------------------------------------------------------------------
//  APPENS EGNE MELDINGSBOKSER (v6.25, brukervalg 2026-10-04)
// ---------------------------------------------------------------------------
//  Erstatter nettleserens alert, confirm og prompt. De grå boksene kunne ikke
//  styles, så «historieappen.no sier» over en grå boks brøt med resten av
//  appen, og i fullskjerm (visningen på prosjektoren) oppførte de seg ulikt
//  mellom nettleserne. Disse er vanlige kort i stabelen (som askChoice over):
//  Escape og klikk på bakgrunnen avbryter, Enter velger hovedknappen.
//
//  Forskjellen fra nettleserens: de stopper ikke koden, men gir et løfte.
//  Kallstedene venter derfor med await der svaret trengs (bekreft, sporTekst).
//  Tekst med linjeskift (\n) vises med linjeskift.
const FELT = Symbol("felt");

function dialogBoks({ tittel = "", tekst = "", felt = null, knapper = [], avbrytVerdi = null }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const dialog = document.createElement("div");
    // modal-valg: presentasjonens brede kort (v5.36) gjelder ikke små dialoger.
    dialog.className = "modal modal-valg modal-melding";
    backdrop.append(dialog);

    if (tittel) {
      const head = document.createElement("div");
      head.className = "modal-head";
      const h = document.createElement("h2");
      h.textContent = tittel;
      head.append(h);
      dialog.append(head);
    } else {
      dialog.setAttribute("aria-label", "Melding");
    }
    if (tekst) {
      const p = document.createElement("p");
      p.className = "melding-tekst";
      p.textContent = tekst;
      dialog.append(p);
    }
    let input = null;
    if (felt) {
      input = document.createElement("input");
      input.type = "text";
      input.className = "melding-felt";
      input.value = felt.verdi || "";
      if (felt.lesbar) input.readOnly = true;
      if (tekst) input.setAttribute("aria-label", tekst);
      dialog.append(input);
    }

    const foot = document.createElement("div");
    foot.className = "modal-foot-right melding-knapper";
    dialog.append(foot);

    let ferdig = false;
    const avslutt = (verdi) => {
      if (ferdig) return;
      ferdig = true;
      backdrop._beforeClose = null;
      backdrop._skipBeforeClose = true;
      modalClose(backdrop);
      backdrop.remove();
      resolve(verdi === FELT ? input.value : verdi);
    };

    let hoved = null;
    for (const k of knapper) {
      const knapp = document.createElement("button");
      knapp.type = "button";
      knapp.className = `btn small ${k.klasse || "ghost"}`;
      knapp.textContent = k.tekst;
      knapp.addEventListener("click", () => avslutt(k.verdi));
      foot.append(knapp);
      if (k.hoved) hoved = knapp;
    }
    // Enter i feltet = hovedknappen (som OK i nettleserens prompt).
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); hoved?.click(); }
    });

    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) avslutt(avbrytVerdi); });
    // Escape går via modalCloseTop → modalClose, altså gjennom kroken.
    backdrop._beforeClose = () => { avslutt(avbrytVerdi); return false; };

    document.body.append(backdrop);
    modalOpen(backdrop);
    // Fokus: feltet (med teksten merket), ellers hovedknappen. En farlig
    // bekreftelse har ingen hovedknapp, så fokus står på «Avbryt» (første).
    if (input) { input.focus(); input.select(); }
    else hoved?.focus();
  });
}

// alert: en melding med OK. Løftet løses når den er lukket.
export function melding(tekst, { tittel = "" } = {}) {
  return dialogBoks({ tittel, tekst,
    knapper: [{ tekst: "OK", verdi: undefined, klasse: "primary", hoved: true }], avbrytVerdi: undefined });
}

// confirm: true for ja, false for nei/Escape/bakgrunnen. `farlig` gir en rød
// ja-knapp, og fokus på «Avbryt», så Enter ikke sletter noe ved et uhell.
export function bekreft(tekst, { tittel = "", ja = "OK", nei = "Avbryt", farlig = false } = {}) {
  return dialogBoks({ tittel, tekst, avbrytVerdi: false, knapper: [
    { tekst: nei, verdi: false, klasse: "ghost" },
    { tekst: ja, verdi: true, klasse: farlig ? "danger" : "primary", hoved: !farlig },
  ] });
}

// prompt: teksten i feltet, eller null ved Avbryt/Escape/bakgrunnen.
export function sporTekst(tekst, verdi = "", { tittel = "", ok = "OK", avbryt = "Avbryt" } = {}) {
  return dialogBoks({ tittel, tekst, felt: { verdi }, avbrytVerdi: null, knapper: [
    { tekst: avbryt, verdi: null, klasse: "ghost" },
    { tekst: ok, verdi: FELT, klasse: "primary", hoved: true },
  ] });
}

// En lenke som må kopieres for hånd (utklippstavla er sperret): feltet er
// skrivebeskyttet og merket, så Cmd/Ctrl+C holder.
export function visLenke(tekst, url) {
  return dialogBoks({ tekst, felt: { verdi: url, lesbar: true }, avbrytVerdi: undefined,
    knapper: [{ tekst: "Lukk", verdi: undefined, klasse: "primary", hoved: true }] });
}

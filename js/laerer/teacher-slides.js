// ============================================================================
//  SLIDES PÅ SKRIVEBORDET — lag, rediger og slett (v7.06)
// ----------------------------------------------------------------------------
//  Lærerens egne sider til visningen, utenfor pensum: en overskrift og et felt
//  med markdown (appens vanlige formatering, samme formatlinje som elles).
//  Lagring og lesing: js/visning/slides.js (samlingen notater, bare læreren).
//
//  Flisen «Slides» under Innhold på lærersiden åpner vinduet #modal-slides
//  (teacher.html), som viser lista og skjemaet. Innholdet er ETT varig element,
//  så en slide midt i skrivingen står igjen hvis vinduet lukkes og åpnes. Lista
//  tegnes på nytt når slidene endrer seg; selve redigeringen røres aldri av det.
//  «Vis slide» åpner sliden som kortet i visningen (slide-kort.js), så du ser
//  hvordan den tar seg ut.
// ============================================================================

import { escapeHtml } from "../felles/util.js";
import { renderRichText } from "../felles/rich-text.js";
import { setupFormatBars } from "../ui/format-bar.js";
import { askChoice, melding } from "../ui/ui-modal.js";
import { openAdminModal } from "./teacher-state.js";
import { openSlide } from "../visning/slide-kort.js";
import { slider, slidesLastet, slidesFeil, onSlidesEndret } from "../visning/slides-liste.js";
import { lagreSlide, slettSlide } from "../visning/slides.js";
import { slideForLang, skrivSlide, SLIDE_TITTEL_MAKS, SLIDE_LAGRING_MAKS } from "../visning/slides-modell.js";

let el = null;            // den varige bolken
let redigerer = null;     // { id: string|null, tittel, innhold, opprinnelig } mens læreren skriver
let lagrer = false;

export const slideRedigererNaa = () => !!redigerer;

const utdrag = (md) => String(md || "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*_>\-\[\]()`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);

function listeHtml() {
  const feil = slidesFeil();
  if (feil) return `<p class="hint">${escapeHtml(feil)}</p>`;
  if (!slidesLastet()) return `<p class="muted">Laster slidene …</p>`;
  const liste = slider();
  if (!liste.length) return `<p class="muted">Ingen slides ennå. Trykk «Ny slide» for å lage den første.</p>`;
  return `<ul class="desk-slides-liste">${liste.map((s) => `<li class="desk-slide-rad${redigerer?.id === s.id ? " redigeres" : ""}">
      <span class="desk-slide-tekst"><b>${escapeHtml(s.tittel)}</b>${s.innhold ? `<span class="muted desk-slide-utdrag">${escapeHtml(utdrag(s.innhold))}</span>` : ""}</span>
      <span class="desk-time-knapper">
        <button type="button" class="btn ghost small" data-slide-vis="${escapeHtml(s.id)}" title="Åpne sliden slik den ser ut i visningen">Vis slide</button>
        <button type="button" class="btn ghost small" data-slide-rediger="${escapeHtml(s.id)}">Rediger</button>
        <button type="button" class="btn ghost small" data-slide-slett="${escapeHtml(s.id)}">Slett</button>
      </span>
    </li>`).join("")}</ul>`;
}

function teller() {
  const lengde = skrivSlide(redigerer || {}).length;
  return `${lengde} av ${SLIDE_LAGRING_MAKS} tegn`;
}

function editorHtml() {
  if (!redigerer) return "";
  return `<div class="desk-slide-editor">
    <label class="desk-slide-felt">Overskrift
      <input type="text" id="slide-tittel" maxlength="${SLIDE_TITTEL_MAKS}" value="${escapeHtml(redigerer.tittel)}" placeholder="F.eks. Innleveringer" autocomplete="off">
    </label>
    <label class="desk-slide-felt">Innhold (markdown)
      <textarea id="slide-innhold" rows="10" data-format="full" placeholder="Skriv teksten her. ### gir mellomtittel, **fet**, *kursiv*, - for punktliste, 1. for nummerert liste, [tekst](https://…) for lenke.">${escapeHtml(redigerer.innhold)}</textarea>
    </label>
    <div class="desk-slide-forhaand"><span class="muted">Forhåndsvisning</span>
      <div class="slide-forhaand-tittel" id="slide-forhaand-tittel"></div>
      <div class="slide-forhaand-kropp rt" id="slide-forhaand-kropp"></div>
    </div>
    <div class="desk-slide-knapper">
      <button type="button" class="btn primary small" data-slide-lagre>Lagre</button>
      <button type="button" class="btn ghost small" data-slide-avbryt>Avbryt</button>
      <span class="muted" id="slide-teller">${teller()}</span>
    </div>
  </div>`;
}

function tegnForhaand() {
  if (!redigerer || !el) return;
  const t = el.querySelector("#slide-forhaand-tittel");
  const k = el.querySelector("#slide-forhaand-kropp");
  if (t) t.textContent = redigerer.tittel || "(uten overskrift)";
  if (k) k.innerHTML = renderRichText(redigerer.innhold || "");
  const tel = el.querySelector("#slide-teller");
  if (tel) {
    tel.textContent = teller();
    tel.classList.toggle("feil", slideForLang(redigerer));
  }
}

function tegnListe() {
  const boks = el?.querySelector(".desk-slides-liste-slot");
  if (boks) boks.innerHTML = listeHtml();
}

function tegnEditor(fokus = true) {
  const boks = el?.querySelector(".desk-slide-editor-slot");
  if (!boks) return;
  boks.innerHTML = editorHtml();
  if (redigerer) {
    setupFormatBars(boks);
    tegnForhaand();
    if (fokus) boks.querySelector("#slide-tittel")?.focus();
  }
}

function sikreEl() {
  if (el) return el;
  el = document.createElement("div");
  el.className = "desk-slides";
  el.innerHTML = `
    <p class="muted desk-slides-hint">Egne sider i visningen, utenfor pensum: innleveringer, kursinfo og annen generell info. Bare du ser dem. Søk dem opp i visningen (tasten S), eller legg dem inn som stopp i en kjøreplan.</p>
    <div class="desk-slide-topp"><button type="button" class="btn small" data-slide-ny title="Lag en egen side til visningen">Ny slide</button></div>
    <div class="desk-slide-editor-slot"></div>
    <div class="desk-slides-liste-slot"></div>`;
  el.addEventListener("click", klikk);
  el.addEventListener("input", skriv);
  onSlidesEndret(() => { if (el) tegnListe(); });
  return el;
}

// Åpner vinduet (flisen «Slides»). Elementet settes inn første gang og står der siden.
export function openSlides() {
  const e = sikreEl();
  const body = document.getElementById("slides-body");
  if (!body) return;
  if (e.parentNode !== body) body.appendChild(e);
  tegnListe();
  openAdminModal("modal-slides");
}

function skriv(e) {
  if (!redigerer) return;
  if (e.target.id === "slide-tittel") redigerer.tittel = e.target.value;
  else if (e.target.id === "slide-innhold") redigerer.innhold = e.target.value;
  else return;
  tegnForhaand();
}

const endret = () => !!redigerer && (redigerer.tittel !== redigerer.opprinnelig.tittel || redigerer.innhold !== redigerer.opprinnelig.innhold);

async function forkastHvisUlagret() {
  if (!endret()) return true;
  return askChoice({
    title: "Forkaste endringene?",
    text: "Sliden du skriver på er ikke lagret.",
    buttons: [{ label: "Forkast", value: true, className: "primary" }, { label: "Fortsett å skrive", value: false }],
    dismissValue: false,
  });
}

async function lagre() {
  if (!redigerer || lagrer) return;
  const slide = { tittel: redigerer.tittel, innhold: redigerer.innhold };
  if (!skrivSlide(slide)) return melding("Skriv en overskrift eller noe innhold først.");
  if (slideForLang(slide)) return melding(`Sliden er for lang (høyst ${SLIDE_LAGRING_MAKS} tegn).`);
  lagrer = true;
  const knapp = el.querySelector("[data-slide-lagre]");
  if (knapp) knapp.disabled = true;
  try {
    await lagreSlide(redigerer.id, slide);
    redigerer = null;
    tegnEditor(false);
    tegnListe();
    melding("Sliden er lagret.");
  } catch (err) {
    if (knapp) knapp.disabled = false;
    melding(`Fikk ikke lagret sliden (${err?.message || err}).`);
  } finally {
    lagrer = false;
  }
}

async function slett(id) {
  const s = slider().find((x) => x.id === id);
  const ok = await askChoice({
    title: "Slette sliden?",
    text: `«${s?.tittel || ""}» slettes. Kjøreplaner som har den som stopp, får et stopp som ikke finnes lenger.`,
    buttons: [{ label: "Slett", value: true, className: "primary" }, { label: "Avbryt", value: false }],
    dismissValue: false,
  });
  if (!ok) return;
  try {
    await slettSlide(id);
    if (redigerer?.id === id) { redigerer = null; tegnEditor(false); }
  } catch (err) {
    melding(`Fikk ikke slettet sliden (${err?.message || err}).`);
  }
}

async function klikk(e) {
  const hit = (sel) => e.target.closest(sel);
  if (hit("[data-slide-ny]")) {
    if (!(await forkastHvisUlagret())) return;
    redigerer = { id: null, tittel: "", innhold: "", opprinnelig: { tittel: "", innhold: "" } };
    tegnEditor();
    tegnListe();
    return;
  }
  const rediger = hit("[data-slide-rediger]");
  if (rediger) {
    if (!(await forkastHvisUlagret())) return;
    const s = slider().find((x) => x.id === rediger.dataset.slideRediger);
    if (!s) return;
    redigerer = { id: s.id, tittel: s.tittel === "(uten overskrift)" ? "" : s.tittel, innhold: s.innhold, opprinnelig: { tittel: s.tittel === "(uten overskrift)" ? "" : s.tittel, innhold: s.innhold } };
    tegnEditor();
    tegnListe();
    return;
  }
  const vis = hit("[data-slide-vis]");
  if (vis) return void openSlide(vis.dataset.slideVis);
  const sl = hit("[data-slide-slett]");
  if (sl) return slett(sl.dataset.slideSlett);
  if (hit("[data-slide-lagre]")) return lagre();
  if (hit("[data-slide-avbryt]")) {
    if (!(await forkastHvisUlagret())) return;
    redigerer = null;
    tegnEditor(false);
    tegnListe();
  }
}

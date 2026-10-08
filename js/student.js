// ============================================================================
//  STUDENTSIDEN (student.html) — foreslå artist, legg til info, se liste, stem
// ============================================================================

import {
  fetchArtists,
  addArtist,
  fetchArtist,
  resubmitArtist,
  subscribeContent,
} from "./data/store.js";
import { loadArtists } from "./data/artist-cache.js";
import { GENDERS, INSTRUMENTS } from "./felles/limits.js";
import { GENEALOGY_META_GENRES, GENEALOGY_MAIN_GENRES, applyGenealogyDoc } from "./sjangre/genre-model.js";
import { fillSelect } from "./ui/ui.js";
import { TREG_SENDING_MELDING, escapeHtml } from "./felles/util.js";
import { renderRichText } from "./felles/rich-text.js";
import { pageFor } from "./felles/story-format.js";
import { CONFIGURED, $, showSetupBanner, wireFirestoreErrorBanner } from "./data/shared.js";
import { WORK_SPEC, SOURCE_SPEC, musicSpecWithGenres, addRow, buildRows, collectRows, collectRawRows } from "./ui/row-editor.js";
import { setupFormatBars } from "./ui/format-bar.js";
import { setupGenrePicker, fillGenrePicker, buildGenrePicker, collectGenrePicker } from "./sjangre/genre-picker.js";
import { initUtskriftValg } from "./utskrift/utskrift-utvalg.js";
import { bekreft } from "./ui/ui-modal.js";

// Musikkeksempel-spec med sjangervelger (alle tre-sjangre, alfabetisk).
// Bygges ved KALL, ikke ved import: sjangertreet kommer fra Firestore (v4.51),
// så vokabularet er tomt de første øyeblikkene. En modulnivå-konstant her ga
// en tom sjangerliste i skjemaet for alltid.
const sorterteSjangre = () => [...GENEALOGY_MAIN_GENRES].sort((a, b) => a.localeCompare(b, "no"));
const musicSpecSj = () => musicSpecWithGenres(sorterteSjangre());

const state = {
  artists: [],
};

// Returflyt (v5.13): åpnes siden med ?retur=<id>, er dette en NY INNSENDING av
// et returnert forslag — samme skjema, prefylt, og lagringen går til samme
// dokument med koden som bevis (fetchArtist leverer returKode sammen med
// resten; koden i seg selv er ikke hemmelig, hele basen er lesbar — den er
// reglenes bevis på at klienten faktisk har LEST returen den skriver over).
// doc er forslaget slik det kom tilbake, så «Forkast endringene» kan fylle
// skjemaet med det igjen.
const returState = { aktiv: false, id: null, kode: "", doc: null };

// Sjangervokabularet (metasjanger-nedtrekket + sjangervelgeren) kommer
// asynkront fra Firestore. Prefyllingen må vente på det: å sette et select-
// felt uten options gir tom verdi. Løses i subscribeContent-callbacken;
// racer mot en tidsfrist så en feilet content-lasting ikke henger siden.
let vokabKlarResolve;
const vokabKlar = new Promise((r) => { vokabKlarResolve = r; });
const vokabEllerFrist = () => Promise.race([vokabKlar, new Promise((r) => setTimeout(r, 5000))]);

// ----------------------------------------------------------------------------
//  Render
// ----------------------------------------------------------------------------

function refreshControls() {
  fillSelect($("#in-metaGenre"), GENEALOGY_META_GENRES, { placeholder: "Velg metasjanger …" });
  fillSelect($("#in-instrument"), INSTRUMENTS, { placeholder: "Velg instrument …" });
  fillSelect($("#in-gender"), GENDERS, { placeholder: "Velg kjønn …" });
  // Sjangrene kommer fra samme tre som metasjangrene — kun vokabularet
  // fylles her, studentens valgte brikker står urørt.
  fillGenrePicker($("#in-mainGenre"), sorterteSjangre());
}

// ----------------------------------------------------------------------------
//  Skjema
// ----------------------------------------------------------------------------

function setupForm() {
  const form = $("#add-form");
  const msg = $("#form-msg");
  const submitBtn = $("#send-knapp");

  $("#add-work").addEventListener("click", () => addWorkRow());
  $("#add-me").addEventListener("click", () => addMusicExampleRow());
  $("#add-source").addEventListener("click", () => addSourceRow());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Enter i et felt sender skjemaet. Før siste steg betyr det «Neste».
    if (steg.aktivt < stegEl().length - 1) return gaTil(steg.aktivt + 1);
    msg.textContent = "";
    msg.className = "form-msg";

    // Alle stegene sjekkes på nytt: i returflyten kan studenten ha hoppet
    // rett hit, og et felt kan være tømt etter at steget ble godkjent.
    const feilen = forsteFeil(0, STEG_SJEKK.length);
    if (feilen) {
      if (feilen.steg !== steg.aktivt) visSteg(feilen.steg);
      return visFeil(feilen);
    }

    if (!CONFIGURED) {
      return showMsg(
        msg,
        "Firebase er ikke satt opp ennå (se README.md). Skjemaet validerer, men lagrer ikke ennå.",
        "error"
      );
    }

    // Duplikatsjekken er alt gjort ved «Neste» i første steg; her slår den
    // bare inn hvis navnet er endret siden.
    if (!(await sjekkDuplikat())) {
      visSteg(0);
      return;
    }

    const candidate = lesKandidat();
    submitBtn.disabled = true;
    const origText = submitBtn.textContent;
    submitBtn.textContent = "Sender …";
    // Firestore køer skrivingen og retryer i det uendelige uten å avvise når
    // nettet er borte: knappen sto i «Sender …» til siden ble lastet på nytt,
    // og studenten sendte inn på nytt. Vi avbryter ikke skrivingen, men sier
    // fra når den drøyer.
    const tregVarsel = setTimeout(() => showMsg(msg,
      TREG_SENDING_MELDING, "warn"), 8000);
    let levertPaNytt = false;
    try {
      if (returState.aktiv) {
        await resubmitArtist(returState.id, candidate, returState.kode, $("#retur-comment")?.value.trim() || "");
        // Skjemaet blir stående (studenten kan ville se over), men knappen
        // låses: en ny innsending oppå en alt levert avvises av reglene og
        // ville bare gitt en kryptisk feil. Utkastet er levert og slettes.
        levertPaNytt = true;
        slettUtkast();
        utkast.nokkel = null;
        $("#utkast-linje").hidden = true;
        showMsg(msg, `«${candidate.name}» er sendt inn på nytt. Læreren ser den i køen sin.`, "ok");
        submitBtn.textContent = "Sendt inn på nytt ✓";
      } else {
        await addArtist(candidate);
        slettUtkast();
        tomSkjema();
        visSteg(0);
        showMsg(msg, `«${candidate.name}» er sendt inn og venter på godkjenning fra lærer`, "ok");
      }
    } catch (err) {
      showMsg(msg, "Noe gikk galt: " + err.message, "error");
    } finally {
      clearTimeout(tregVarsel);
      if (!levertPaNytt) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    }
  });
}

function lesKandidat() {
  return {
    name: $("#in-name").value.trim(),
    birthYear: parseInt($("#in-birthyear").value, 10) || null,
    deathYear: parseInt($("#in-deathyear").value, 10) || null,
    gender: $("#in-gender").value,
    metaGenre: $("#in-metaGenre").value,
    instrument: $("#in-instrument").value,
    mainGenre: collectGenrePicker($("#in-mainGenre")),
    subGenre: $("#in-subGenre").value.split(",").map(s => s.trim()).filter(Boolean),
    influenceStart: parseInt($("#in-start").value, 10) || null,
    influenceEnd: parseInt($("#in-end").value, 10) || null,
    description: $("#in-desc").value.trim(),
    keyWorks: collectWorks(),
    geography: $("#in-geo").value.trim(),
    imageUrl: $("#in-image-url").value.trim(),
    imageCredit: $("#in-image-credit").value.trim(),
    proposedBy: $("#in-by").value.trim(),
    musicExamples: collectMusicExamples(),
    kilder: collectSources(),
  };
}

// Tømmer skjemaet etter innsending eller «Tøm skjemaet». form.reset() rører
// ikke radene og sjangerbrikkene, så de bygges på nytt for seg.
function tomSkjema() {
  $("#add-form").reset();
  resetWorkRows();
  resetMusicExampleRows();
  resetSourceRows();
  buildGenrePicker($("#in-mainGenre"), []);
  $("#utkast-linje").hidden = true;
  steg.maks = 0;
  steg.godkjentNavn = "";
}

// ----------------------------------------------------------------------------
//  Stegene (v6.57)
// ----------------------------------------------------------------------------

// Fem steg i stedet for ett langt skjema (brukervalg 2026-10-08). «Neste»
// sjekker bare steget man står på; innsendingen sjekker alle og går til det
// første steget med en feil. Lista øverst fører tilbake til steg studenten
// alt har vært på, og i returflyten til alle stegene, siden skjemaet da er
// fylt ut fra før. Stegene er seksjonene .steg i student.html, og navnet i
// lista er overskriften deres.
const steg = { aktivt: 0, maks: 0, travel: false, godkjentNavn: "" };
const stegEl = () => [...document.querySelectorAll("#add-form .steg")];

const feil = (el, tekst) => ({ el: typeof el === "string" ? $(el) : el, tekst });
// required alene slipper gjennom et felt med bare mellomrom; derfor trim.
const paakrevd = (sel, tekst) => ($(sel).value.trim() ? null : feil(sel, tekst));
const tallFra = (sel) => parseInt($(sel).value, 10) || null;
const forTidlig = (fraSel, tilSel) => {
  const fra = tallFra(fraSel), til = tallFra(tilSel);
  return !!(fra && til && til < fra);
};

// Felt nettleseren selv underkjenner i steget: årstall utenfor min/max, en
// lenke som ikke er en lenke, en starttid som ikke kan leses. Skjemaet har
// novalidate (ellers stopper nettleseren innsendingen på et påkrevd felt i et
// skjult steg, uten å kunne vise hvor), så sjekken gjøres her. Tomme påkrevde
// felt har egne meldinger i STEG_SJEKK.
function ugyldigFelt(i) {
  for (const el of stegEl()[i].querySelectorAll("input, select, textarea")) {
    if (!el.checkValidity() && !el.validity.valueMissing) {
      return feil(el, `${feltnavn(el)}: ${el.validationMessage}`);
    }
  }
  return null;
}

function feltnavn(el) {
  const label = el.closest("label");
  const tekst = label ? label.firstChild?.textContent : el.getAttribute("aria-label");
  return (tekst || "Feltet").replace("*", "").trim();
}

// Én sjekk per steg, i samme rekkefølge som feltene står. Gir den første
// feilen ({ el, tekst }) eller null.
const STEG_SJEKK = [
  () => paakrevd("#in-name", "Skriv inn navnet på artisten.")
    || paakrevd("#in-gender", "Velg kjønn.")
    || ugyldigFelt(0)
    // Årstall-rekkefølge: hindrer at artisten stille forsvinner fra tiårsfiltre.
    || (forTidlig("#in-birthyear", "#in-deathyear") ? feil("#in-deathyear", "Dødsår kan ikke være før fødselsår.") : null),
  () => paakrevd("#in-metaGenre", "Velg metasjanger.")
    || paakrevd("#in-instrument", "Velg instrument.")
    || paakrevd("#in-start", "Skriv inn året innflytelsen begynte.")
    || ugyldigFelt(1)
    || (forTidlig("#in-start", "#in-end") ? feil("#in-end", "«Innflytelse til»-året kan ikke være før «fra»-året.") : null),
  () => ugyldigFelt(2),
  // Rader med innhold men ugyldig eller manglende lenke droppes ellers stille.
  () => validateExampleRows() || ugyldigFelt(3),
  () => (collectSources().length ? null : feil("#source-rows .source-text", "Legg til minst én kilde."))
    || validateSourceRows()
    || ugyldigFelt(4)
    // Navnet er PÅKREVD (brukervalg 2026-09-02): læreren skal kunne gå i
    // dialog med den som foreslår.
    || paakrevd("#in-by", "Skriv fornavnet ditt, så læreren vet hvem forslaget kommer fra."),
];

function forsteFeil(fra, til) {
  for (let i = fra; i < til; i++) {
    const f = STEG_SJEKK[i]();
    if (f) return { ...f, steg: i };
  }
  return null;
}

function visFeil(f) {
  showMsg($("#form-msg"), f.tekst, "error");
  if (!f.el) return;
  f.el.setAttribute("aria-invalid", "true");
  f.el.focus({ preventScroll: true });
  f.el.scrollIntoView({ block: "center", behavior: "smooth" });
}

function visSteg(i, { fokus = true } = {}) {
  const alle = stegEl();
  steg.aktivt = i;
  steg.maks = Math.max(steg.maks, i);
  alle.forEach((s, n) => { s.hidden = n !== i; });
  tegnStegliste();
  const siste = i === alle.length - 1;
  $("#steg-tilbake").hidden = i === 0;
  $("#steg-neste").hidden = siste;
  $("#send-knapp").hidden = !siste;
  if (siste) tegnOppsummering();
  if (!fokus) return;
  // Overskriften får fokus, så skjermlesere hører hvilket steg de er på, og
  // panelet rulles opp når toppen er ute av syne (etter et langt steg).
  alle[i].querySelector(".steg-tittel")?.focus({ preventScroll: true });
  const panel = $("#forslag-panel");
  if (panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ block: "start", behavior: "smooth" });
}

function tegnStegliste() {
  const alle = stegEl();
  $("#steg-liste").innerHTML = alle.map((s, n) => {
    const navn = s.querySelector(".steg-tittel").textContent.trim();
    const besokt = returState.aktiv || n <= steg.maks;
    const aktiv = n === steg.aktivt;
    const klasse = "steg-knapp" + (aktiv ? "" : besokt ? " besokt" : "");
    return `<li${aktiv ? ' class="aktiv"' : ""}><button type="button" class="${klasse}" data-steg="${n}"`
      + ` aria-label="Steg ${n + 1} av ${alle.length}: ${escapeHtml(navn)}"`
      + (aktiv ? ' aria-current="step"' : "") + (besokt ? "" : " disabled")
      + `><span class="steg-nr" aria-hidden="true">${n + 1}</span><span class="steg-navn">${escapeHtml(navn)}</span></button></li>`;
  }).join("");
}

// Til et annet steg. Framover sjekkes stegene som hoppes over (og navnet mot
// artistlista); bakover går alltid. fritt: returflytens hopp fra lista, der
// skjemaet alt er fylt ut og studenten skal kunne gå rett til det som rettes.
async function gaTil(maal, { fritt = false } = {}) {
  const antall = stegEl().length;
  if (steg.travel || maal === steg.aktivt || maal < 0 || maal >= antall) return;
  steg.travel = true;
  try {
    if (maal > steg.aktivt && !fritt) {
      const feilen = forsteFeil(steg.aktivt, maal);
      if (feilen) {
        if (feilen.steg !== steg.aktivt) visSteg(feilen.steg);
        return visFeil(feilen);
      }
      if (steg.aktivt === 0 && !(await sjekkDuplikat())) return;
    }
    showMsg($("#form-msg"), "", "");
    visSteg(maal);
    lagreUtkastSnart();
  } finally {
    steg.travel = false;
  }
}

// Myk duplikatsjekk: navnekollisjoner kan være legitime, så studenten kan gå
// videre etter en bekreftelse. Den gjøres ved «Neste» i første steg, før det
// er skrevet en hel beskrivelse om en artist som alt ligger inne, og huskes
// for navnet så den ikke spør igjen. Ved retur er «duplikatet» studentens
// eget forslag, så sjekken hoppes over.
async function sjekkDuplikat() {
  if (returState.aktiv) return true;
  const navn = $("#in-name").value.trim();
  if (navn.toLowerCase() === steg.godkjentNavn) return true;
  const msg = $("#form-msg");
  const neste = $("#steg-neste");
  showMsg(msg, "Sjekker om artisten finnes fra før …", "");
  neste.disabled = true;
  try {
    // Hentingen kan henge uten nett. Da går studenten videre etter fire
    // sekunder; et duplikat fanges uansett av læreren i godkjenningskøen.
    await Promise.race([ensureArtists(), new Promise((r) => setTimeout(r, 4000))]);
  } finally {
    neste.disabled = false;
    showMsg(msg, "", "");
  }
  const dup = findDuplicate(navn);
  if (dup && !(await bekreft(`«${navn}» ser ut til å finnes fra før${dup.status === "pending" ? " (venter på godkjenning)" : ""}. Vil du fortsette likevel?`, { ja: "Fortsett likevel" }))) {
    return false;
  }
  if (dup || state.artists.length) steg.godkjentNavn = navn.toLowerCase();
  return true;
}

// Oversikten i siste steg: en linje per steg før det, med «Endre».
function tegnOppsummering() {
  const v = (id) => document.getElementById(id).value.trim();
  const valgt = (id) => {
    const s = document.getElementById(id);
    return s.value ? (s.selectedOptions[0]?.textContent || s.value) : "";
  };
  const spenn = (fra, til, bareFra, bareTil) =>
    fra && til ? `${fra}–${til}` : fra ? `${bareFra} ${fra}` : til ? `${bareTil} ${til}` : "";
  const ledd = (...xs) => xs.filter(Boolean).join(" · ");
  const ord = v("in-desc").split(/\s+/).filter(Boolean).length;
  const verk = collectWorks().length;
  const eksempler = collectMusicExamples().length;
  const innflytelse = spenn(v("in-start"), v("in-end"), "fra", "til");
  const tekster = [
    ledd(v("in-name"), valgt("in-gender"), spenn(v("in-birthyear"), v("in-deathyear"), "født", "død"), v("in-geo")),
    ledd(valgt("in-metaGenre"), valgt("in-instrument"), collectGenrePicker($("#in-mainGenre")).join(", "),
      innflytelse && `innflytelse ${innflytelse}`),
    ord ? `${ord} ord` : "",
    ledd(verk ? `${verk} verk` : "", eksempler ? `${eksempler} ${eksempler === 1 ? "lytteeksempel" : "lytteeksempler"}` : ""),
  ];
  const navn = stegEl().map((s) => s.querySelector(".steg-tittel").textContent.trim());
  $("#oppsummering").innerHTML = tekster.map((t, i) => `<div class="opps-rad">`
    + `<dt>${escapeHtml(navn[i])}</dt>`
    + `<dd>${t ? escapeHtml(t) : '<span class="opps-tom">Ikke fylt ut</span>'}</dd>`
    + `<dd><button type="button" class="btn ghost small" data-til-steg="${i}">Endre</button></dd>`
    + `</div>`).join("");
}

function setupSteg() {
  const form = $("#add-form");
  $("#steg-liste").addEventListener("click", (e) => {
    const b = e.target.closest(".steg-knapp");
    if (b && !b.disabled) gaTil(Number(b.dataset.steg), { fritt: returState.aktiv });
  });
  $("#steg-neste").addEventListener("click", () => gaTil(steg.aktivt + 1));
  $("#steg-tilbake").addEventListener("click", () => gaTil(steg.aktivt - 1));
  $("#oppsummering").addEventListener("click", (e) => {
    const b = e.target.closest("[data-til-steg]");
    if (b) gaTil(Number(b.dataset.tilSteg));
  });

  // Enter i et tekstfelt går til neste steg. Uten dette ville nettleseren
  // sendt skjemaet med den skjulte send-knappen, eller ikke gjort noe.
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing || e.target.tagName !== "INPUT") return;
    if (steg.aktivt >= stegEl().length - 1) return;
    e.preventDefault();
    gaTil(steg.aktivt + 1);
  });

  // Utkastet lagres ved hver endring. Knapper som legger til eller fjerner
  // rader og sjangerbrikker endrer skjemaet uten input-hendelse.
  const endret = (e) => {
    e.target.removeAttribute?.("aria-invalid");
    lagreUtkastSnart();
  };
  form.addEventListener("input", endret);
  form.addEventListener("change", endret);
  form.addEventListener("click", (e) => { if (e.target.closest("button")) lagreUtkastSnart(); });
  window.addEventListener("pagehide", () => { if (utkast.timer) lagreUtkast(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && utkast.timer) lagreUtkast(); });

  $("#utkast-tom").addEventListener("click", async () => {
    const retur = returState.aktiv && returState.doc;
    const ok = await bekreft(retur
      ? "Forkaste endringene og gå tilbake til forslaget slik læreren sendte det tilbake?"
      : "Tømme skjemaet og slette utkastet?", { ja: retur ? "Forkast endringene" : "Tøm skjemaet", farlig: true });
    if (!ok) return;
    slettUtkast();
    if (retur) {
      fyllSkjema(returState.doc);
      $("#utkast-linje").hidden = true;
    } else {
      tomSkjema();
    }
    showMsg($("#form-msg"), "", "");
    visSteg(0);
  });

  visSteg(0, { fokus: false });
}

// ----------------------------------------------------------------------------
//  Utkast (v6.57): skjemaet lagres i nettleseren til det er sendt inn
// ----------------------------------------------------------------------------

// Bare localStorage: utkastet er studentens eget og skal aldri til Firestore.
// Én nøkkel for nye forslag og én per returnert forslag. Returutkastet bærer
// returkoden, så et utkast fra en tidligere runde (læreren har sendt
// forslaget tilbake igjen, med ny kode) ikke legges over den nye
// tilbakemeldingen. Nøkkelen står som null til siden vet hvilken modus den er
// i; ellers kunne det tomme skjemaet blitt lagret over utkastet før det var
// lest inn.
const UTKAST_NY = "pensum-artistutkast";
const utkastNokkelRetur = (id) => `pensum-artistutkast:retur:${id}`;
const UTKAST_FELT = ["in-name", "in-gender", "in-birthyear", "in-deathyear", "in-geo",
  "in-metaGenre", "in-instrument", "in-start", "in-end", "in-subGenre",
  "in-desc", "in-image-url", "in-image-credit", "in-by", "retur-comment"];
const utkast = { nokkel: null, timer: 0 };

function lesUtkast() {
  return {
    v: 1,
    felt: Object.fromEntries(UTKAST_FELT.map((id) => [id, document.getElementById(id)?.value ?? ""])),
    sjangre: collectGenrePicker($("#in-mainGenre")),
    verk: collectRawRows($("#work-rows"), WORK_SPEC),
    eksempler: collectRawRows($("#me-rows"), musicSpecSj()),
    kilder: collectRawRows($("#source-rows"), SOURCE_SPEC),
    steg: steg.aktivt,
    maks: steg.maks,
    // Svaret på duplikatspørsmålet, så det ikke kommer igjen etter omlasting.
    godkjentNavn: steg.godkjentNavn,
    kode: returState.kode,
  };
}

const harInnhold = (u) => Object.values(u.felt).some((v) => String(v).trim())
  || u.sjangre.length || u.verk.length || u.eksempler.length || u.kilder.length;

function lagreUtkast() {
  clearTimeout(utkast.timer);
  utkast.timer = 0;
  if (!utkast.nokkel) return;
  try {
    const u = lesUtkast();
    if (harInnhold(u)) localStorage.setItem(utkast.nokkel, JSON.stringify(u));
    else localStorage.removeItem(utkast.nokkel);
  } catch (e) { /* utkast: uten lagring (privat vindu, full kvote) virker skjemaet som før */ }
}

function lagreUtkastSnart() {
  if (!utkast.nokkel) return;
  clearTimeout(utkast.timer);
  utkast.timer = setTimeout(lagreUtkast, 400);
}

function hentUtkast(nokkel) {
  try {
    const u = JSON.parse(localStorage.getItem(nokkel) || "null");
    return u && u.v === 1 && u.felt ? u : null;
  } catch (e) { return null; }
}

function slettUtkast() {
  clearTimeout(utkast.timer);
  utkast.timer = 0;
  try { if (utkast.nokkel) localStorage.removeItem(utkast.nokkel); } catch (e) { /* utkast: se lagreUtkast */ }
}

function leggInnUtkast(u) {
  for (const id of UTKAST_FELT) {
    const el = document.getElementById(id);
    if (el && typeof u.felt[id] === "string") el.value = u.felt[id];
  }
  buildGenrePicker($("#in-mainGenre"), u.sjangre || []);
  buildRows($("#work-rows"), WORK_SPEC, u.verk);
  buildRows($("#me-rows"), musicSpecSj(), u.eksempler);
  buildRows($("#source-rows"), SOURCE_SPEC, u.kilder);
  // Metasjangeren og sjangeren i lytteeksemplene velges fra slektstreet, som
  // kan komme etter utkastet. Uten valgene i nedtrekket blir metasjangeren
  // stående tom, og et lytteeksempel har bare sin egen sjanger å velge.
  vokabKlar.then(() => {
    const meta = $("#in-metaGenre");
    if (!meta.value && u.felt["in-metaGenre"]) meta.value = u.felt["in-metaGenre"];
    const wrap = $("#me-rows");
    if (u.eksempler?.length && !wrap.contains(document.activeElement)) {
      buildRows(wrap, musicSpecSj(), collectRawRows(wrap, musicSpecSj()));
    }
  });
  const siste = stegEl().length - 1;
  steg.godkjentNavn = typeof u.godkjentNavn === "string" ? u.godkjentNavn : "";
  steg.maks = Math.min(Math.max(0, u.maks | 0), siste);
  visSteg(Math.min(Math.max(0, u.steg | 0), steg.maks), { fokus: false });
}

function visUtkastLinje(retur) {
  $("#utkast-tekst").textContent = retur
    ? "Skjemaet viser endringene du gjorde sist, men ikke har sendt inn."
    : "Skjemaet er fylt inn med utkastet du ikke sendte inn.";
  $("#utkast-tom").textContent = retur ? "Forkast endringene" : "Tøm skjemaet";
  $("#utkast-linje").hidden = false;
}

// Nytt forslag: les inn utkastet, om det finnes. «Foreslå» fra lærerens
// Skrivebord (?navn=) gjelder en bestemt artist, så et utkast om en annen
// artist legges ikke over navnet. Det blir da erstattet når det skrives.
function startUtkast(navnFraTimen) {
  utkast.nokkel = UTKAST_NY;
  const u = hentUtkast(UTKAST_NY);
  if (!u) return;
  const utkastNavn = String(u.felt["in-name"] || "").trim().toLowerCase();
  if (navnFraTimen && utkastNavn !== navnFraTimen.trim().toLowerCase()) return;
  leggInnUtkast(u);
  visUtkastLinje(false);
}

// http/https-sjekk (samme regel som safeUrl bruker ved lagring).
function isHttpUrl(u) {
  return /^https?:\/\//i.test((u || "").trim());
}

// En musikkeksempel-rad med tittel men uten gyldig lenke ville blitt droppet
// stille av normaliseringen — flagg den i stedet. Gir { el, tekst } eller null.
function validateExampleRows() {
  for (const r of document.querySelectorAll("#me-rows .me-row")) {
    const label = r.querySelector(".me-label").value.trim();
    const urlEl = r.querySelector(".me-url");
    const url = urlEl.value.trim();
    if (!label && !url) continue;
    if (!isHttpUrl(url)) {
      return feil(urlEl, `Musikkeksempelet ${label ? `«${label}»` : "(uten tittel)"} mangler en gyldig lenke (må starte med https://).`);
    }
    // Starttidsfeltet (v5.88) merker seg selv ugyldig, se kobleStarttid.
    const start = r.querySelector(".me-start");
    if (start && !start.validity.valid) {
      return feil(start, `Starttiden for ${label ? `«${label}»` : "musikkeksempelet"}: ${start.validationMessage}`);
    }
  }
  return null;
}

// En kilde-rad med lenke men uten tekst ville blitt droppet (teksten er det
// som lagres); en ugyldig lenke ville blitt fjernet stille.
function validateSourceRows() {
  for (const r of document.querySelectorAll("#source-rows .source-row")) {
    const textEl = r.querySelector(".source-text");
    const urlEl = r.querySelector(".source-url");
    const text = textEl.value.trim();
    const url = urlEl.value.trim();
    if (!text && !url) continue;
    if (!text) return feil(textEl, "En kilde har en lenke, men mangler tekst. Skriv inn kildehenvisningen.");
    if (url && !isHttpUrl(url)) return feil(urlEl, `Kilden «${text}» har en ugyldig lenke (må starte med https://). Fjern eller rett lenken.`);
  }
  return null;
}

// Artistlista til duplikatsjekken. Hentes fra den delte localStorage-cachen
// forsiden fyller (studenten kommer alltid hit via en lenke derfra), og kun
// ved direkte-besøk med tom cache gjøres én engangs-henting. Siden abonnerte
// før på HELE artistsamlingen i sanntid utelukkende for dette oppslaget.
// Feiler hentingen, står lista tom: duplikatsjekken er en myk advarsel, og et
// duplikat fanges uansett av læreren i godkjenningskøen. Hentingen huskes, så
// et nytt «Neste» mens den første fortsatt går, ikke henter lista en gang til.
let artisterHentes = null;
function ensureArtists() {
  if (state.artists.length) return Promise.resolve();
  state.artists = loadArtists();
  if (state.artists.length) return Promise.resolve();
  artisterHentes ||= fetchArtists()
    .then((liste) => { state.artists = liste; })
    .catch((err) => console.warn("Kunne ikke hente artistlista til duplikatsjekk:", err?.message || err));
  return artisterHentes;
}

// Case-insensitiv navnematch mot eksisterende (ikke-fjernede) forslag.
function findDuplicate(name) {
  const n = (name || "").trim().toLowerCase();
  return state.artists.find((a) => a.status !== "removed" && (a.name || "").trim().toLowerCase() === n);
}

// Rad-editorene (verk/musikkeksempler/kilder) bor nå i den delte row-editor.js
// (spec-drevet, med escaping). Disse er tynne innpakninger mot skjemaets wrap-er.
function addMusicExampleRow(v) { return addRow($("#me-rows"), musicSpecSj(), v || {}); }
function resetMusicExampleRows() { buildRows($("#me-rows"), musicSpecSj()); }
function collectMusicExamples() { return collectRows($("#me-rows"), musicSpecSj()); }

function addWorkRow(v) { return addRow($("#work-rows"), WORK_SPEC, v || {}); }
function resetWorkRows() { buildRows($("#work-rows"), WORK_SPEC); }
function collectWorks() { return collectRows($("#work-rows"), WORK_SPEC); }

function addSourceRow(v) { return addRow($("#source-rows"), SOURCE_SPEC, v || {}); }
function resetSourceRows() { buildRows($("#source-rows"), SOURCE_SPEC); }
function collectSources() { return collectRows($("#source-rows"), SOURCE_SPEC); }

// ----------------------------------------------------------------------------
//  Returflyt: prefyll skjemaet fra det returnerte forslaget
// ----------------------------------------------------------------------------

function fyllSkjema(a) {
  $("#in-name").value = a.name || "";
  $("#in-birthyear").value = a.birthYear ?? "";
  $("#in-deathyear").value = a.deathYear ?? "";
  $("#in-gender").value = a.gender || "";
  $("#in-metaGenre").value = a.metaGenre || "";
  $("#in-instrument").value = a.instrument || "";
  buildGenrePicker($("#in-mainGenre"), a.mainGenre || []);
  $("#in-subGenre").value = (a.subGenre || []).join(", ");
  $("#in-start").value = a.influenceStart ?? "";
  $("#in-end").value = a.influenceEnd ?? "";
  $("#in-desc").value = a.description || "";
  $("#in-geo").value = a.geography || "";
  $("#in-image-url").value = a.imageUrl || "";
  $("#in-image-credit").value = a.imageCredit || "";
  $("#in-by").value = a.proposedBy || "";
  buildRows($("#work-rows"), WORK_SPEC, a.keyWorks || []);
  buildRows($("#me-rows"), musicSpecSj(), a.musicExamples || []);
  buildRows($("#source-rows"), SOURCE_SPEC, a.kilder || []);
}

async function startRetur(id) {
  const banner = $("#retur-banner");
  const tekst = $("#retur-banner-tekst");
  try {
    // Vent på både dokumentet og sjangervokabularet: nedtrekkene kan ikke
    // prefylles før options finnes (fillSelect bevarer verdien etterpå).
    const [a] = await Promise.all([fetchArtist(id), vokabEllerFrist()]);
    if (!a || a.status !== "returnert") {
      banner.hidden = false;
      tekst.innerHTML = "<strong>Dette forslaget er ikke til retting lenger.</strong> Kanskje det alt er levert på nytt eller behandlet av læreren. Skjemaet under legger inn et nytt forslag.";
      // Kommentarfeltet blir stående skjult: det er ingen retur å svare på.
      startUtkast(null);
      return;
    }
    returState.aktiv = true;
    returState.id = id;
    returState.kode = a.returKode || "";
    banner.hidden = false;
    tekst.innerHTML = `<strong>Tilbakemelding fra læreren:</strong> ${escapeHtml(a.teacherFeedback || "")}`;
    // Kommentarfeltet står nederst ved navnet (v5.18), og vises bare her.
    $("#retur-comment-felt").hidden = false;
    const tittel = $("#form-tittel");
    if (tittel) tittel.textContent = `Lever på nytt: ${a.name || ""}`;
    const submitBtn = document.querySelector('#add-form button[type="submit"]');
    if (submitBtn) submitBtn.textContent = "Send inn på nytt";
    returState.doc = a;
    fyllSkjema(a);
    // Endringer studenten ikke har sendt inn ennå, fra et tidligere besøk.
    // Stegene er alle åpne fra nå (returState.aktiv), også uten utkast.
    utkast.nokkel = utkastNokkelRetur(id);
    const u = hentUtkast(utkast.nokkel);
    if (u && u.kode === returState.kode) {
      leggInnUtkast(u);
      visUtkastLinje(true);
    } else {
      visSteg(steg.aktivt, { fokus: false });
    }
  } catch (err) {
    banner.hidden = false;
    tekst.textContent = "Kunne ikke hente forslaget (" + (err?.message || err) + "). Gå tilbake til forsiden og prøv igjen.";
  }
}

// ----------------------------------------------------------------------------
//  Skriveveiledningen
// ----------------------------------------------------------------------------

// Teksten er innholdssiden content/skriveveiledning, redigerbar for læreren fra
// «Innhold som mangler» på Oversikten. Ingen reservetekst i koden (brukerkrav
// fra v3.3): mangler siden, står hele blokka skjult i stedet for å vise en tom
// veiledning til studentene. Tegnes på nytt ved hvert content-snapshot, så en
// lærerendring slår gjennom uten sidelast. <details> beholder åpen/lukket-
// tilstanden sin, fordi bare innholdet inni byttes ut.
function visSkrivehjelp(content) {
  const boks = $("#skrivehjelp");
  const tekst = $("#skrivehjelp-tekst");
  if (!boks || !tekst) return;
  const side = pageFor("skriveveiledning", content);
  if (!side?.body) { boks.hidden = true; return; }
  tekst.innerHTML = renderRichText(side.body);
  boks.hidden = false;
}

// ----------------------------------------------------------------------------
//  Hjelpere + oppstart
// ----------------------------------------------------------------------------

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = "form-msg " + type;
}

function init() {
  // Navn fra timen (v5.82): «Foreslå» på lærerens Skrivebord åpner skjemaet
  // med artistnavnet fylt inn (?navn=…). Bare når feltet står tomt.
  let navnFraTimen = null;
  try {
    const navn = new URLSearchParams(window.location.search).get("navn");
    const felt = document.getElementById("in-name");
    if (navn && felt && !felt.value) felt.value = navnFraTimen = navn.trim().slice(0, 120);
  } catch (e) { /* navn-fra-timen: uten URL-støtte står feltet tomt */ }
  // Merket på skriverikonet (v5.56); siden har ingen kort å ta med herfra.
  initUtskriftValg();
  setupForm();
  setupSteg();
  setupGenrePicker($("#in-mainGenre"));
  setupFormatBars();
  resetWorkRows();
  resetMusicExampleRows();
  resetSourceRows();

  if (!CONFIGURED) {
    refreshControls();
    startUtkast(navnFraTimen);
    showSetupBanner("Du kan likevel se hvordan skjemaet ser ut.");
    return;
  }

  wireFirestoreErrorBanner();
  refreshControls();

  // Returflyt: ?retur=<id> gjør skjemaet om til «lever på nytt».
  // Uten retur er det et nytt forslag, og utkastet leses inn med en gang.
  const returId = new URLSearchParams(location.search).get("retur");
  if (returId) startRetur(returId);
  else startUtkast(navnFraTimen);
  // Artistlista hentes først når navnet sjekkes (ensureArtists, ved «Neste»
  // i første steg). Siden viser ingen artister, så et sanntidsabonnement her
  // var ren kostnad.
  //
  // Sjangertreet MÅ derimot hentes: metasjanger-velgeren og sjangervalget i
  // musikkeksemplene kommer fra det, og fra v4.51 bor det i Firestore. Uten
  // dette sto skjemaet med tomme nedtrekk. content er ett lite dokumentsett.
  subscribeContent((c) => {
    applyGenealogyDoc(c?.genealogy);
    refreshControls();
    vokabKlarResolve();
    visSkrivehjelp(c);
    // Bygg musikkeksempel-radene på nytt KUN når de er urørte. Snapshotet
    // fyrer ved enhver endring i content-samlingen (varmekartceller,
    // innholdssider, referanser) — en ubetinget rebuild slettet alt studenten
    // hadde skrevet i radene, midt i utfyllingen. Hensikten her er bare å
    // fylle sjangervelgeren når treet lander, og da er radene tomme.
    // (Sjekker rå inputverdier, ikke collectRows: den dropper rader uten URL,
    // og en halvskrevet rad skal også overleve.)
    const harInnhold = [...($("#me-rows")?.querySelectorAll("input, select") || [])]
      .some((el) => String(el.value || "").trim());
    if (!harInnhold) resetMusicExampleRows();
  });
}

// Vent på klassepassordet (js/gate.js); uten gate.js er __pensumGate undefined
// og init() kjører umiddelbart som før (sperren feiler åpent).
Promise.resolve(window.__pensumGate?.klar).then(init);

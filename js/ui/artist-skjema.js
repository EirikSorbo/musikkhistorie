// ============================================================================
//  ARTISTSKJEMAET I FEM STEG — ett skjema overalt (v6.96)
// ----------------------------------------------------------------------------
//  Brukervalg 2026-10-13: samme femstegs skjema som studentene fikk i v6.57,
//  overalt der en artist legges til eller redigeres:
//    ny        studentens nye forslag (student.html), med utkast og duplikatsjekk
//    retur     studentens rettede forslag (student.html?retur=<id>)
//    forslag   studentens «Foreslå endring» på en artist (vindu på forsiden og
//              i slektstreet); diffen mot dagens verdier blir endringsforslaget
//    laerer-ny lærerens nye artist (vindu på lærersiden), lagres som aktiv
//    laerer    lærerens redigering (vindu på lærersiden)
//
//  Låste valg:
//   - Alle kan hoppe fritt fram og tilbake mellom stegene, også med tomme
//     felt. De obligatoriske feltene sjekkes ved innsending: feilmeldingen
//     lister alt som mangler, og skjemaet går til første steg med feil.
//   - «Sentrale verk» står ikke i noe skjema lenger (fases ut). Verkene på
//     artistene blir liggende: skjemaet verken leser eller skriver feltet.
//   - Lærerfeltene står der de hører hjemme: Instrument 2 og plateselskap i
//     steg 2, punktene i steg 3, «Foreslått av» i steg 5.
//   - Nye artister lagres som utkast i nettleseren. Redigeringer spør før
//     vinduet lukkes med endringer som ikke er lagret.
//
//  Modulen bygger markupen selv, så skjemaet er det samme på alle sidene.
//  Siden gir det den lagringen den trenger (onSend).
// ============================================================================

import { GENDERS, INSTRUMENTS } from "../felles/limits.js";
import { GENEALOGY_META_GENRES, GENEALOGY_MAIN_GENRES } from "../sjangre/genre-model.js";
import { SOURCE_SPEC, musicSpecWithGenres, addRow, buildRows, collectRows, collectRawRows, normalizeRows } from "./row-editor.js";
import { setupGenrePicker, fillGenrePicker, buildGenrePicker, collectGenrePicker } from "../sjangre/genre-picker.js";
import { setupFormatBars } from "./format-bar.js";
import { fyllPunktfelt, lesPunktfelt } from "./ui-helpers.js";
import { bekreft, modalOpen, modalClose, setupModal } from "./ui-modal.js";
import { escapeHtml, TREG_SENDING_MELDING } from "../felles/util.js";
import { renderRichText } from "../felles/rich-text.js";

const STUDENTMODUS = ["ny", "retur", "forslag"];
const LAERERMODUS = ["laerer", "laerer-ny"];

const sorterteSjangre = () => [...GENEALOGY_MAIN_GENRES].sort((a, b) => a.localeCompare(b, "no"));
// «Sentralt»-avkrysningen på lytteeksempler vises bare i lærermodus; settes når skjemaet startes.
let musikkLaerer = false;
const musicSpecSj = () => musicSpecWithGenres(sorterteSjangre(), { laerer: musikkLaerer });

// Obligatoriske felt per modus. Lærerens skjema krevde aldri instrument eller
// kilder, og et endringsforslag krever bare navnet på den som foreslår: det
// gjelder en artist som alt står i appen.
function paakrevdeFor(modus) {
  if (modus === "forslag") return new Set(["proposedBy"]);
  if (LAERERMODUS.includes(modus)) return new Set(["name", "gender", "metaGenre", "influenceStart"]);
  return new Set(["name", "gender", "metaGenre", "instrument", "influenceStart", "kilder", "proposedBy"]);
}

const STEGNAVN = ["Artisten", "Sjanger og periode", "Beskrivelse", "Lytteeksempler", "Kilder og innsending"];

// ----------------------------------------------------------------------------
//  Markup
// ----------------------------------------------------------------------------

function markup(modus) {
  const laerer = LAERERMODUS.includes(modus);
  const p = paakrevdeFor(modus);
  const stj = (k) => (p.has(k) ? " *" : "");
  const student = STUDENTMODUS.includes(modus);
  return `
  <div class="retur-info" data-as-retur hidden><span data-as-retur-tekst></span></div>
  <ol class="steg-liste" data-as-stegliste aria-label="Stegene i skjemaet"></ol>
  <div class="utkast-linje" data-as-utkast hidden>
    <span data-as-utkast-tekst></span>
    <button type="button" class="btn ghost small" data-as-utkast-tom></button>
  </div>
  <form class="steg-skjema" novalidate>
    <section class="steg" data-steg="0">
      <h3 class="steg-tittel" tabindex="-1">${STEGNAVN[0]}</h3>
      <p class="hint steg-ingress">${modus === "forslag" ? "Endre det som skal rettes. Du kan hoppe fritt mellom stegene." : "Felt merket med * må fylles ut. Du kan hoppe fritt mellom stegene."}</p>
      <div class="add-grid">
        <label>Navn${stj("name")}
          <input type="text" data-felt="name" placeholder="f.eks. Robert Johnson" />
        </label>
        <label>Kjønn${stj("gender")}
          <select data-felt="gender"></select>
        </label>
        <label>Fødselsår
          <input type="number" data-felt="birthYear" min="1800" max="2030" placeholder="1911" />
        </label>
        <label>Dødsår
          <input type="number" data-felt="deathYear" min="1800" max="2030" placeholder="1938" />
        </label>
        <label class="full">Geografisk tilhørighet
          <input type="text" data-felt="geography" placeholder="f.eks. Mississippi Delta" />
        </label>
      </div>
    </section>

    <section class="steg" data-steg="1" hidden>
      <h3 class="steg-tittel" tabindex="-1">${STEGNAVN[1]}</h3>
      <p class="hint steg-ingress">Hvor hører artisten hjemme, og når var innflytelsen størst?</p>
      <div class="add-grid">
        <label>Metasjanger${stj("metaGenre")}
          <select data-felt="metaGenre"></select>
        </label>
        <label>Instrument${stj("instrument")}
          <select data-felt="instrument"></select>
        </label>
        ${laerer ? `<label>Instrument 2
          <select data-felt="instrument2"></select>
        </label>` : ""}
        ${laerer || modus === "forslag" ? `<label>Plateselskap
          <input type="text" data-felt="recordLabel" placeholder="f.eks. Motown" />
        </label>` : ""}
        <label>Innflytelse fra (år)${stj("influenceStart")}
          <input type="number" data-felt="influenceStart" min="1800" max="2030" placeholder="f.eks. 1955" />
        </label>
        <label>Innflytelse til (år)
          <input type="number" data-felt="influenceEnd" min="1800" max="2030" placeholder="f.eks. 1972" />
        </label>
        <div class="full genre-picker" data-felt="mainGenre">
          <span class="field-label">Sjangre (fra slektstreet)</span>
          <select class="gp-velg" aria-label="Legg til sjanger"></select>
          <div class="gp-valgte"></div>
        </div>
        <label class="full">Undersjangre / tags (frie, kommaseparert)
          <input type="text" data-felt="subGenre" placeholder="f.eks. Delta blues, Akustisk blues" />
        </label>
      </div>
    </section>

    <section class="steg" data-steg="2" hidden>
      <h3 class="steg-tittel" tabindex="-1">${STEGNAVN[2]}</h3>
      <p class="hint steg-ingress">Fortell kort hvorfor artisten er viktig i musikkhistorien.</p>
      <details class="instr-guide skrivehjelp" data-as-skrivehjelp hidden>
        <summary>Slik skriver du beskrivelsen</summary>
        <div class="rt" data-as-skrivehjelp-tekst></div>
      </details>
      <div class="add-grid">
        <label class="full">Begrunnelse / hvorfor relevant
          <textarea data-felt="description" rows="8" data-format placeholder="Kort om musikkhistorisk betydning …"></textarea>
        </label>
        ${laerer ? `<div class="full punktfelt">
          <label>Oppsummering i punkter
            <textarea data-felt="punkter" rows="5" data-format="inline" placeholder="Ett punkt per linje, helst 3–5"></textarea>
          </label>
          <p class="hint">Ett punkt per linje. Vises foreløpig bare i presentasjonen: nivå 2 viser punktene, nivå 3 hele beskrivelsen.</p>
          <p class="hint punkt-varsel" hidden></p>
        </div>` : ""}
      </div>
    </section>

    <section class="steg" data-steg="3" hidden>
      <h3 class="steg-tittel" tabindex="-1">${STEGNAVN[3]}</h3>
      <p class="hint steg-ingress">Hva bør man lytte til? Valgfritt.</p>
      <div class="add-grid">
        <div class="full">
          <span class="field-label">Musikkeksempler</span>
          <div data-rader="musicExamples"></div>
          <button type="button" class="btn ghost small" data-legg-til="musicExamples">+ Legg til musikkeksempel</button>
        </div>
      </div>
    </section>

    <section class="steg" data-steg="4" hidden>
      <h3 class="steg-tittel" tabindex="-1">${STEGNAVN[4]}</h3>
      <p class="hint steg-ingress">${p.has("kilder") ? "Hvor har du opplysningene fra? Minst én kilde må være med." : "Kildene og bildet."}</p>
      <div class="add-grid">
        <div class="full">
          <span class="field-label">Kilder${stj("kilder")}</span>
          ${student ? `<p class="hint">Bøker, artikler, nettsider eller andre referanser brukt om denne artisten.</p>` : ""}
          <div data-rader="kilder"></div>
          <button type="button" class="btn ghost small" data-legg-til="kilder">+ Legg til kilde</button>
        </div>
        <label class="full">Bilde-URL
          <input type="url" data-felt="imageUrl" placeholder="https://… (lenke til bilde av artisten${laerer ? "" : ", valgfritt"})" />
        </label>
        <label class="full">Bildekreditering / kilde
          <input type="text" data-felt="imageCredit" placeholder="f.eks. Wikipedia / CC BY-SA 4.0" />
        </label>
        <div class="full steg-oversikt">
          <span class="field-label">Se over før du ${laerer ? "lagrer" : "sender inn"}</span>
          <dl class="oppsummering" data-as-oppsummering></dl>
        </div>
        <label class="full">${laerer ? "Foreslått av" : `Ditt navn (kun fornavn)${stj("proposedBy")}`}
          <input type="text" data-felt="proposedBy" placeholder="${laerer ? "Hvem som foreslo artisten" : "Fornavn"}" maxlength="100" />
        </label>
        <label class="full retur-kommentar" data-as-kommentarfelt hidden>Kommentar til læreren (valgfritt)
          <textarea data-felt="studentComment" rows="2" maxlength="1000" placeholder="F.eks. hva du har endret"></textarea>
        </label>
      </div>
    </section>

    <div class="steg-knapper">
      <button type="button" class="btn ghost" data-as-tilbake hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Tilbake</button>
      <button type="button" class="btn primary as-neste" data-as-neste>Neste<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></button>
      <button type="submit" class="btn primary as-send" data-as-send hidden></button>
      <div class="form-msg" data-as-msg role="status" aria-live="polite"></div>
    </div>
  </form>`;
}

// ----------------------------------------------------------------------------
//  Hjelpere
// ----------------------------------------------------------------------------

// Nedtrekk med vern for lagrede verdier utenfor vokabularet: verdien beholdes,
// merket, så en eldre artist aldri mister den stille ved lagring.
function fyllNedtrekk(sel, verdier, { tom, ukjentTekst = "ukjent verdi" } = {}) {
  if (!sel) return;
  const naa = sel.value || sel.dataset.onsket || "";
  const liste = verdier.map((v) => (typeof v === "object" ? v : { value: v, label: v }));
  const valg = [...(tom != null ? [{ value: "", label: tom }] : []), ...liste];
  if (naa && !liste.some((v) => v.value === naa)) valg.push({ value: naa, label: `${naa} (${ukjentTekst})` });
  sel.innerHTML = valg.map((v) => `<option value="${escapeHtml(v.value)}">${escapeHtml(v.label)}</option>`).join("");
  sel.value = naa;
}

const tall = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const erHttpUrl = (u) => /^https?:\/\//i.test((u || "").trim());

const FELTNAVN = {
  name: "Navn", gender: "Kjønn", metaGenre: "Metasjanger", instrument: "Instrument",
  influenceStart: "Innflytelse fra", kilder: "Kilder", proposedBy: "Ditt navn",
};
// Steget hvert obligatorisk felt står i.
const FELTSTEG = { name: 0, gender: 0, metaGenre: 1, instrument: 1, influenceStart: 1, kilder: 4, proposedBy: 4 };

// Lengdegrensene i firestore.rules for studentenes innsendinger og
// endringsforslag (artistInnholdOk og forslagOk). Over grensen avviser reglene
// skrivingen, og studenten fikk bare «Missing or insufficient permissions».
// Sjekkes derfor her, med en melding som sier hva som er for langt (v7.03).
// Læreren skriver uten disse grensene.
const STUDENT_MAKS = {
  name: { maks: 120, navn: "Navn", steg: 0 },
  geography: { maks: 200, navn: "Geografisk tilhørighet", steg: 0 },
  recordLabel: { maks: 200, navn: "Plateselskap", steg: 1 },
  description: { maks: 5000, navn: "Begrunnelsen", steg: 2 },
  imageUrl: { maks: 2000, navn: "Bilde-URL", steg: 4 },
  imageCredit: { maks: 300, navn: "Bildekrediteringen", steg: 4 },
};
const STUDENT_MAKS_UNDERSJANGRE = 20;

// Utkast fra skjemaet i v6.57–v6.95 (feltene lagret med student.html-id-ene).
// Oversettes, så ingen student mister et halvferdig forslag ved oppdateringen.
const V1_FELT = {
  "in-name": "name", "in-gender": "gender", "in-birthyear": "birthYear", "in-deathyear": "deathYear",
  "in-geo": "geography", "in-metaGenre": "metaGenre", "in-instrument": "instrument",
  "in-start": "influenceStart", "in-end": "influenceEnd", "in-subGenre": "subGenre",
  "in-desc": "description", "in-image-url": "imageUrl", "in-image-credit": "imageCredit",
  "in-by": "proposedBy", "retur-comment": "studentComment",
};
export function fraUtkastV1(u) {
  const verdier = {};
  for (const [gml, ny] of Object.entries(V1_FELT)) {
    if (typeof u.felt?.[gml] === "string") verdier[ny] = u.felt[gml];
  }
  verdier.subGenre = String(verdier.subGenre || "").split(",").map((x) => x.trim()).filter(Boolean);
  verdier.mainGenre = Array.isArray(u.sjangre) ? u.sjangre : [];
  const maks = Math.max(0, Math.min(4, u.maks | 0));
  return {
    v: 2,
    verdier,
    eksempler: Array.isArray(u.eksempler) ? u.eksempler : [],
    kilder: Array.isArray(u.kilder) ? u.kilder : [],
    // Steg 4 het «Verk og lytteeksempler»; verkene er ute av skjemaet.
    steg: Math.min(u.steg | 0, maks),
    besokt: Array.from({ length: maks + 1 }, (_, i) => i),
    godkjentNavn: typeof u.godkjentNavn === "string" ? u.godkjentNavn : "",
    kode: u.kode || "",
  };
}

// ----------------------------------------------------------------------------
//  Skjemaet
// ----------------------------------------------------------------------------

// cfg: { modus, verdier, onSend(v, api), sendTekst, utkastNokkel,
//        finnDuplikat(navn) → Promise<artist|null>, retur: { tekst } | null,
//        onUtkastTom }
export function lagArtistSkjema(beholder, cfg) {
  const modus = cfg.modus || "ny";
  const laerer = LAERERMODUS.includes(modus);
  musikkLaerer = laerer;
  const paakrevd = paakrevdeFor(modus);
  beholder.innerHTML = markup(modus);
  beholder.classList.add("artist-skjema");
  const $ = (sel) => beholder.querySelector(sel);
  const felt = (k) => beholder.querySelector(`[data-felt="${k}"]`);
  const rader = (k) => beholder.querySelector(`[data-rader="${k}"]`);
  const stegEl = () => [...beholder.querySelectorAll(".steg")];
  const form = $("form");
  const tilstand = { aktivt: 0, besokt: new Set([0]), feilSteg: new Set(), travel: false, godkjentNavn: "", snapshot: "", sender: false };

  // --- Vokabular -------------------------------------------------------------
  function oppdaterVokabular() {
    fyllNedtrekk(felt("gender"), GENDERS, { tom: "Velg kjønn …" });
    fyllNedtrekk(felt("metaGenre"), GENEALOGY_META_GENRES, { tom: "Velg metasjanger …", ukjentTekst: "finnes ikke i treet" });
    fyllNedtrekk(felt("instrument"), INSTRUMENTS, { tom: laerer ? "Ingen / ukjent" : "Velg instrument …" });
    if (felt("instrument2")) fyllNedtrekk(felt("instrument2"), INSTRUMENTS, { tom: "Ingen" });
    fillGenrePicker(felt("mainGenre"), sorterteSjangre());
    // Lytteeksemplenes sjangervalg: bygges på nytt med det nye vokabularet,
    // men bare når ingen står og skriver i radene.
    const wrap = rader("musicExamples");
    if (!wrap.contains(document.activeElement)) buildRows(wrap, musicSpecSj(), collectRawRows(wrap, musicSpecSj()));
  }

  // --- Fylle og lese ---------------------------------------------------------
  function settNedtrekk(k, v) {
    const sel = felt(k);
    if (!sel) return;
    sel.dataset.onsket = v || "";
    sel.value = v || "";
    if ((v || "") !== sel.value) oppdaterVokabular();
    delete sel.dataset.onsket;
  }

  function fyll(a = {}) {
    for (const k of ["name", "geography", "description", "imageUrl", "imageCredit", "proposedBy", "recordLabel"]) {
      if (felt(k)) felt(k).value = a[k] || "";
    }
    for (const k of ["birthYear", "deathYear", "influenceStart", "influenceEnd"]) felt(k).value = a[k] ?? "";
    felt("subGenre").value = (a.subGenre || []).join(", ");
    for (const k of ["gender", "metaGenre", "instrument", "instrument2"]) settNedtrekk(k, a[k]);
    buildGenrePicker(felt("mainGenre"), a.mainGenre || []);
    buildRows(rader("musicExamples"), musicSpecSj(), normalizeRows(musicSpecSj(), a.musicExamples));
    buildRows(rader("kilder"), SOURCE_SPEC, normalizeRows(SOURCE_SPEC, a.kilder));
    if (felt("punkter")) fyllPunktfelt(felt("punkter"), a.punkter);
  }

  // Verdiene i samme form som før (lesKandidat i student.js, readField i
  // proposals.js), så diffen for endringsforslag ikke ser falske endringer.
  function les() {
    const v = {
      name: felt("name").value.trim(),
      birthYear: tall(felt("birthYear").value),
      deathYear: tall(felt("deathYear").value),
      gender: felt("gender").value,
      metaGenre: felt("metaGenre").value,
      instrument: felt("instrument").value,
      mainGenre: collectGenrePicker(felt("mainGenre")),
      subGenre: felt("subGenre").value.split(",").map((s) => s.trim()).filter(Boolean),
      influenceStart: tall(felt("influenceStart").value),
      influenceEnd: tall(felt("influenceEnd").value),
      geography: felt("geography").value.trim(),
      description: felt("description").value.trim(),
      musicExamples: collectRows(rader("musicExamples"), musicSpecSj()),
      kilder: collectRows(rader("kilder"), SOURCE_SPEC),
      imageUrl: felt("imageUrl").value.trim(),
      imageCredit: felt("imageCredit").value.trim(),
      proposedBy: felt("proposedBy").value.trim(),
    };
    if (felt("recordLabel")) v.recordLabel = felt("recordLabel").value.trim();
    if (felt("instrument2")) v.instrument2 = felt("instrument2").value === v.instrument ? "" : felt("instrument2").value;
    if (felt("punkter")) v.punkter = lesPunktfelt(felt("punkter"));
    return v;
  }

  function tom() {
    form.reset();
    fyll({});
    tilstand.besokt = new Set([0]);
    tilstand.feilSteg.clear();
    tilstand.godkjentNavn = "";
    $("[data-as-utkast]").hidden = true;
  }

  // --- Meldinger ------------------------------------------------------------
  function melding(tekst, type = "") {
    const el = $("[data-as-msg]");
    el.textContent = tekst || "";
    el.className = "form-msg" + (type ? " " + type : "");
  }

  // --- Sjekkene --------------------------------------------------------------
  // Alle feilene i skjemaet: [{ el, tekst, steg, mangler? }]. Manglende
  // obligatoriske felt merkes `mangler`, så meldingen kan liste dem samlet.
  function finnFeil() {
    const ut = [];
    const legg = (el, tekst, steg, mangler = false) => ut.push({ el, tekst, steg, mangler });
    const v = les();
    for (const k of paakrevd) {
      const tomt = k === "kilder" ? !v.kilder.length : !String(v[k] ?? "").trim();
      if (!tomt) continue;
      const el = k === "kilder" ? rader("kilder").querySelector(".source-text") || $('[data-legg-til="kilder"]') : felt(k);
      legg(el, FELTNAVN[k], FELTSTEG[k], true);
    }
    // Felt nettleseren selv underkjenner (årstall utenfor min/max, lenker),
    // når feltet ikke er tomt. Skjemaet har novalidate, så sjekken gjøres her.
    stegEl().forEach((s, i) => {
      for (const el of s.querySelectorAll("input, select, textarea")) {
        if (!el.checkValidity() && !el.validity.valueMissing) {
          const label = el.closest("label");
          const navn = (label ? label.firstChild?.textContent : el.getAttribute("aria-label")) || "Feltet";
          legg(el, `${navn.replace("*", "").trim()}: ${el.validationMessage}`, i);
        }
      }
    });
    if (!laerer) {
      for (const [k, g] of Object.entries(STUDENT_MAKS)) {
        const n = String(v[k] ?? "").length;
        if (n > g.maks) legg(felt(k), `${g.navn} kan være høyst ${g.maks} tegn (er ${n}).`, g.steg);
      }
      if (v.subGenre.length > STUDENT_MAKS_UNDERSJANGRE) legg(felt("subGenre"), `Høyst ${STUDENT_MAKS_UNDERSJANGRE} undersjangre (er ${v.subGenre.length}).`, 1);
    }
    if (v.birthYear && v.deathYear && v.deathYear < v.birthYear) legg(felt("deathYear"), "Dødsår kan ikke være før fødselsår.", 0);
    if (v.influenceStart && v.influenceEnd && v.influenceEnd < v.influenceStart) legg(felt("influenceEnd"), "«Innflytelse til»-året kan ikke være før «fra»-året.", 1);
    // Rader med innhold, men uten gyldig lenke eller tekst, ville blitt
    // droppet stille av collectRows.
    for (const r of rader("musicExamples").querySelectorAll(".me-row")) {
      const label = r.querySelector(".me-label").value.trim();
      const urlEl = r.querySelector(".me-url");
      if (!label && !urlEl.value.trim()) continue;
      if (!erHttpUrl(urlEl.value)) legg(urlEl, `Musikkeksempelet ${label ? `«${label}»` : "(uten tittel)"} mangler en gyldig lenke (må starte med https://).`, 3);
      const start = r.querySelector(".me-start");
      if (start && !start.validity.valid) legg(start, `Starttiden for ${label ? `«${label}»` : "musikkeksempelet"}: ${start.validationMessage}`, 3);
    }
    for (const r of rader("kilder").querySelectorAll(".source-row")) {
      const textEl = r.querySelector(".source-text");
      const urlEl = r.querySelector(".source-url");
      const text = textEl.value.trim(), url = urlEl.value.trim();
      if (!text && !url) continue;
      if (!text) legg(textEl, "En kilde har en lenke, men mangler tekst. Skriv inn kildehenvisningen.", 4);
      else if (url && !erHttpUrl(url)) legg(urlEl, `Kilden «${text}» har en ugyldig lenke (må starte med https://). Fjern eller rett lenken.`, 4);
    }
    return ut;
  }

  function visFeil(feil) {
    tilstand.feilSteg = new Set(feil.map((f) => f.steg));
    const forste = feil.slice().sort((a, b) => a.steg - b.steg)[0];
    const mangler = feil.filter((f) => f.mangler);
    const andre = feil.filter((f) => !f.mangler);
    const deler = [];
    if (mangler.length) {
      deler.push(`Fyll ut ${mangler.length === 1 ? "dette" : "disse"} før du ${laerer ? "lagrer" : "sender inn"}: ${mangler.map((f) => `${f.tekst} (steg ${f.steg + 1})`).join(", ")}.`);
    }
    if (andre.length) deler.push(andre[0].tekst);
    for (const f of feil) f.el?.setAttribute?.("aria-invalid", "true");
    if (forste.steg !== tilstand.aktivt) visSteg(forste.steg, { fokus: false });
    else tegnStegliste();
    melding(deler.join(" "), "error");
    if (forste.el?.focus) {
      forste.el.focus({ preventScroll: true });
      forste.el.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
  }

  // --- Stegene ---------------------------------------------------------------
  function visSteg(i, { fokus = true } = {}) {
    const alle = stegEl();
    tilstand.aktivt = i;
    tilstand.besokt.add(i);
    alle.forEach((s, n) => { s.hidden = n !== i; });
    tegnStegliste();
    const siste = i === alle.length - 1;
    $("[data-as-tilbake]").hidden = i === 0;
    $("[data-as-neste]").hidden = siste;
    $("[data-as-send]").hidden = !siste;
    if (siste) tegnOppsummering();
    if (!fokus) return;
    alle[i].querySelector(".steg-tittel")?.focus({ preventScroll: true });
    if (beholder.getBoundingClientRect().top < 0) beholder.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  // Alle stegene er knapper (fri hopping). Besøkte steg er merket, og steg
  // med feil fra siste innsendingsforsøk får et rødt nummer.
  function tegnStegliste() {
    const alle = stegEl();
    $("[data-as-stegliste]").innerHTML = alle.map((s, n) => {
      const navn = s.querySelector(".steg-tittel").textContent.trim();
      const aktiv = n === tilstand.aktivt;
      const klasse = "steg-knapp"
        + (aktiv ? "" : tilstand.besokt.has(n) ? " besokt" : "")
        + (tilstand.feilSteg.has(n) ? " feil" : "");
      return `<li${aktiv ? ' class="aktiv"' : ""}><button type="button" class="${klasse}" data-steg-knapp="${n}"`
        + ` aria-label="Steg ${n + 1} av ${alle.length}: ${escapeHtml(navn)}${tilstand.feilSteg.has(n) ? " (mangler noe)" : ""}"`
        + (aktiv ? ' aria-current="step"' : "")
        + `><span class="steg-nr" aria-hidden="true">${n + 1}</span><span class="steg-navn">${escapeHtml(navn)}</span></button></li>`;
    }).join("");
  }

  // Til et annet steg. Ingen sjekk av feltene (fri hopping); bare den myke
  // duplikatsjekken når man forlater første steg i et nytt skjema.
  async function gaTil(maal) {
    const antall = stegEl().length;
    if (tilstand.travel || maal === tilstand.aktivt || maal < 0 || maal >= antall) return;
    tilstand.travel = true;
    try {
      if (tilstand.aktivt === 0 && maal > 0 && !(await sjekkDuplikat())) return;
      if (!$("[data-as-msg]").classList.contains("ok")) melding("");
      visSteg(maal);
      lagreUtkastSnart();
    } finally {
      tilstand.travel = false;
    }
  }

  // Myk duplikatsjekk (som før): navnekollisjoner kan være legitime, så man
  // kan gå videre etter en bekreftelse. Svaret huskes for navnet.
  async function sjekkDuplikat() {
    if (!cfg.finnDuplikat) return true;
    const navn = felt("name").value.trim();
    if (!navn || navn.toLowerCase() === tilstand.godkjentNavn) return true;
    melding("Sjekker om artisten finnes fra før …");
    let dup = null;
    try {
      dup = await Promise.race([cfg.finnDuplikat(navn), new Promise((r) => setTimeout(() => r(null), 4000))]);
    } finally {
      melding("");
    }
    if (dup && !(await bekreft(`«${navn}» ser ut til å finnes fra før${dup.status === "pending" ? " (venter på godkjenning)" : ""}. Vil du fortsette likevel?`, { ja: "Fortsett likevel" }))) {
      return false;
    }
    tilstand.godkjentNavn = navn.toLowerCase();
    return true;
  }

  // Oversikten i siste steg: en linje per steg, med det som mangler.
  function tegnOppsummering() {
    const v = les();
    const valgt = (k) => {
      const s = felt(k);
      return s?.value ? (s.selectedOptions[0]?.textContent || s.value) : "";
    };
    const spenn = (fra, til, bareFra, bareTil) =>
      fra && til ? `${fra}–${til}` : fra ? `${bareFra} ${fra}` : til ? `${bareTil} ${til}` : "";
    const ledd = (...xs) => xs.filter(Boolean).join(" · ");
    const ord = v.description.split(/\s+/).filter(Boolean).length;
    const innflytelse = spenn(v.influenceStart, v.influenceEnd, "fra", "til");
    const tekster = [
      ledd(v.name, valgt("gender"), spenn(v.birthYear, v.deathYear, "født", "død"), v.geography),
      ledd(valgt("metaGenre"), valgt("instrument"), v.mainGenre.join(", "), innflytelse && `innflytelse ${innflytelse}`, v.recordLabel),
      ledd(ord ? `${ord} ord` : "", v.punkter?.length ? `${v.punkter.length} punkter` : ""),
      v.musicExamples.length ? `${v.musicExamples.length} ${v.musicExamples.length === 1 ? "lytteeksempel" : "lytteeksempler"}` : "",
    ];
    const mangler = (i) => [...paakrevd].filter((k) => FELTSTEG[k] === i
      && (k === "kilder" ? !v.kilder.length : !String(v[k] ?? "").trim())).map((k) => FELTNAVN[k]);
    $("[data-as-oppsummering]").innerHTML = tekster.map((t, i) => {
      const m = mangler(i);
      return `<div class="opps-rad">`
        + `<dt>${escapeHtml(STEGNAVN[i])}</dt>`
        + `<dd>${t ? escapeHtml(t) : '<span class="opps-tom">Ikke fylt ut</span>'}`
        + `${m.length ? ` <span class="opps-mangler">Mangler: ${escapeHtml(m.join(", "))}</span>` : ""}</dd>`
        + `<dd><button type="button" class="btn ghost small" data-til-steg="${i}">Endre</button></dd>`
        + `</div>`;
    }).join("");
  }

  // --- Utkast (bare nye artister) -------------------------------------------
  const utkast = { nokkel: cfg.utkastNokkel || null, timer: 0 };
  const lesUtkast = () => ({
    v: 2,
    verdier: { ...les(), studentComment: felt("studentComment").value },
    eksempler: collectRawRows(rader("musicExamples"), musicSpecSj()),
    kilder: collectRawRows(rader("kilder"), SOURCE_SPEC),
    steg: tilstand.aktivt,
    besokt: [...tilstand.besokt],
    godkjentNavn: tilstand.godkjentNavn,
    kode: cfg.retur?.kode || "",
  });
  const harInnhold = (u) => Object.entries(u.verdier).some(([, x]) => (Array.isArray(x) ? x.length : String(x ?? "").trim()))
    || u.eksempler.length || u.kilder.length;
  function lagreUtkast() {
    clearTimeout(utkast.timer);
    utkast.timer = 0;
    if (!utkast.nokkel) return;
    try {
      const u = lesUtkast();
      if (harInnhold(u)) localStorage.setItem(utkast.nokkel, JSON.stringify(u));
      else localStorage.removeItem(utkast.nokkel);
    } catch (e) { /* utkast: uten lagring virker skjemaet som før */ }
  }
  function lagreUtkastSnart() {
    if (!utkast.nokkel) return;
    clearTimeout(utkast.timer);
    utkast.timer = setTimeout(lagreUtkast, 400);
  }
  function hentUtkast() {
    if (!utkast.nokkel) return null;
    try {
      const u = JSON.parse(localStorage.getItem(utkast.nokkel) || "null");
      if (u && u.v === 1 && u.felt) return fraUtkastV1(u);
      return u && u.v === 2 && u.verdier ? u : null;
    } catch (e) { return null; }
  }
  function slettUtkast() {
    clearTimeout(utkast.timer);
    utkast.timer = 0;
    try { if (utkast.nokkel) localStorage.removeItem(utkast.nokkel); } catch (e) { /* se lagreUtkast */ }
  }
  function leggInnUtkast(u) {
    fyll(u.verdier);
    felt("studentComment").value = u.verdier.studentComment || "";
    buildRows(rader("musicExamples"), musicSpecSj(), u.eksempler || []);
    buildRows(rader("kilder"), SOURCE_SPEC, u.kilder || []);
    tilstand.godkjentNavn = typeof u.godkjentNavn === "string" ? u.godkjentNavn : "";
    tilstand.besokt = new Set(Array.isArray(u.besokt) ? u.besokt : [0]);
    visSteg(Math.min(Math.max(0, u.steg | 0), stegEl().length - 1), { fokus: false });
  }
  function visUtkastLinje(tekst, knapp) {
    $("[data-as-utkast-tekst]").textContent = tekst;
    $("[data-as-utkast-tom]").textContent = knapp;
    $("[data-as-utkast]").hidden = false;
  }

  // --- Koblingene ------------------------------------------------------------
  setupGenrePicker(felt("mainGenre"));
  setupFormatBars(beholder);
  buildRows(rader("musicExamples"), musicSpecSj());
  buildRows(rader("kilder"), SOURCE_SPEC);
  beholder.querySelectorAll("[data-legg-til]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.leggTil;
    addRow(rader(k), k === "kilder" ? SOURCE_SPEC : musicSpecSj(), {});
  }));
  $("[data-as-stegliste]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-steg-knapp]");
    if (b) gaTil(Number(b.dataset.stegKnapp));
  });
  $("[data-as-neste]").addEventListener("click", () => gaTil(tilstand.aktivt + 1));
  $("[data-as-tilbake]").addEventListener("click", () => gaTil(tilstand.aktivt - 1));
  $("[data-as-oppsummering]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-til-steg]");
    if (b) gaTil(Number(b.dataset.tilSteg));
  });
  // Enter i et tekstfelt går til neste steg, ikke rett til innsending.
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing || e.target.tagName !== "INPUT") return;
    e.preventDefault();
    if (tilstand.aktivt < stegEl().length - 1) gaTil(tilstand.aktivt + 1);
  });
  const endret = (e) => {
    e.target.removeAttribute?.("aria-invalid");
    lagreUtkastSnart();
  };
  form.addEventListener("input", endret);
  form.addEventListener("change", endret);
  form.addEventListener("click", (e) => { if (e.target.closest("button")) lagreUtkastSnart(); });
  $("[data-as-utkast-tom]").addEventListener("click", () => cfg.onUtkastTom?.(api));

  const sendKnapp = $("[data-as-send]");
  const sendTekst = cfg.sendTekst || (laerer ? "Lagre" : "Send inn");
  sendKnapp.textContent = sendTekst;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (tilstand.sender) return;
    if (tilstand.aktivt < stegEl().length - 1) return gaTil(tilstand.aktivt + 1);
    const feil = finnFeil();
    if (feil.length) return visFeil(feil);
    tilstand.feilSteg.clear();
    tegnStegliste();
    if (!(await sjekkDuplikat())) { visSteg(0); return; }
    melding("");
    tilstand.sender = true;
    sendKnapp.disabled = true;
    sendKnapp.textContent = laerer ? "Lagrer …" : "Sender …";
    // Firestore køer skrivingen uten å avvise når nettet er borte: si fra
    // når den drøyer, i stedet for å stå i «Sender …» uten forklaring.
    const treg = setTimeout(() => melding(TREG_SENDING_MELDING, "warn"), 8000);
    let ferdig = false;
    try {
      const svar = await cfg.onSend({ ...les(), studentComment: felt("studentComment").value.trim() }, api);
      ferdig = svar?.laas === true;
      if (svar?.tekst) melding(svar.tekst, svar.type || "ok");
      if (svar?.knapp) sendKnapp.textContent = svar.knapp;
    } catch (err) {
      melding((laerer ? "Feil: " : "Noe gikk galt: ") + (err?.message || err), "error");
    } finally {
      clearTimeout(treg);
      tilstand.sender = false;
      if (!ferdig) {
        sendKnapp.disabled = false;
        if (sendKnapp.textContent.endsWith("…")) sendKnapp.textContent = sendTekst;
      }
    }
  });

  // --- Oppstart --------------------------------------------------------------
  oppdaterVokabular();
  if (cfg.verdier) fyll(cfg.verdier);
  if (cfg.retur) {
    $("[data-as-retur]").hidden = false;
    $("[data-as-retur-tekst]").innerHTML = cfg.retur.html || escapeHtml(cfg.retur.tekst || "");
    $("[data-as-kommentarfelt]").hidden = !cfg.retur.kommentar;
  }
  // Et skjema med verdier fra før (redigering, retur, forslag) har alle
  // stegene fylt ut, og alle er merket som besøkt.
  if (cfg.verdier) tilstand.besokt = new Set(stegEl().map((_, i) => i));
  visSteg(0, { fokus: false });

  const api = {
    modus,
    fyll,
    les,
    tom,
    visSteg,
    melding,
    oppdaterVokabular,
    lagreUtkast,
    slettUtkast,
    hentUtkast,
    leggInnUtkast,
    visUtkastLinje,
    skjulUtkastLinje: () => { $("[data-as-utkast]").hidden = true; },
    settUtkastNokkel: (n) => { utkast.nokkel = n; },
    settSnapshot: () => { tilstand.snapshot = JSON.stringify(les()); },
    harEndringer: () => JSON.stringify(les()) !== tilstand.snapshot,
    // Skriveveiledningen (content/skriveveiledning) i steg 3. Ingen
    // reservetekst: mangler siden, står blokka skjult.
    visSkrivehjelp(body) {
      const boks = $("[data-as-skrivehjelp]");
      if (!body || !String(body).trim()) { boks.hidden = true; return; }
      $("[data-as-skrivehjelp-tekst]").innerHTML = renderRichText(body);
      boks.hidden = false;
    },
    sendKnapp,
  };
  api.settSnapshot();
  return api;
}

// ----------------------------------------------------------------------------
//  Vinduet (lærersiden, forsiden og slektstreet)
// ----------------------------------------------------------------------------

// Ett vindu for alle modusene, laget første gang det trengs, så sidene ikke
// trenger egen markup. Lukkes det med endringer som ikke er lagret, spør det
// først (_beforeClose dekker ✕, Escape, ← og klikk på bakgrunnen).
let vindu = null;
// Hver åpning får et nytt nummer. En lukketimer fra et lagret skjema lukker
// bare hvis det er det samme skjemaet som står åpent (audit v5.35 funn 21:
// ellers lukket timeren et NYTT skjema åpnet rett etter i samme vindu).
let vinduGen = 0;
function hentVindu() {
  if (vindu) return vindu;
  vindu = document.createElement("div");
  vindu.className = "modal-backdrop";
  vindu.id = "modal-artist-skjema";
  vindu.innerHTML = `<div class="modal modal-wide artist-skjema-vindu" role="dialog" aria-modal="true" aria-labelledby="as-vindu-tittel">
    <div class="modal-head">
      <h2 id="as-vindu-tittel"></h2>
      <button type="button" class="modal-close btn ghost small" aria-label="Lukk">✕</button>
    </div>
    <div data-as-vindu-kropp></div>
  </div>`;
  document.body.appendChild(vindu);
  setupModal(vindu);
  return vindu;
}

export function lukkArtistSkjema() {
  if (!vindu) return;
  vindu._skipBeforeClose = true;
  modalClose(vindu);
}

// cfg som lagArtistSkjema, pluss tittel. Gir skjemaets api.
export function apneArtistSkjema(cfg) {
  const m = hentVindu();
  const gen = ++vinduGen;
  m.querySelector("#as-vindu-tittel").textContent = cfg.tittel || "Artist";
  const api = lagArtistSkjema(m.querySelector("[data-as-vindu-kropp]"), cfg);
  // Lukker etter kvitteringen, uten å spørre (endringene er lagret), og bare
  // hvis dette skjemaet fortsatt er det som står i vinduet.
  api.lukkSnart = (ms = 900) => {
    api.settSnapshot();
    setTimeout(() => { if (gen === vinduGen) lukkArtistSkjema(); }, ms);
  };
  m._beforeClose = () => {
    if (!api.harEndringer()) return true;
    bekreft("Du har endringer som ikke er lagret. Lukke likevel?", { ja: "Lukk uten å lagre", farlig: true })
      .then((ok) => { if (ok) lukkArtistSkjema(); });
    return false;
  };
  modalOpen(m);
  return api;
}

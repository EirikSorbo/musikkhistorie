// ============================================================================
//  ENDRINGSFORSLAG (studentside)
// ----------------------------------------------------------------------------
//  Generisk redigerer som lar studenter foreslå endringer på artister, tech,
//  sjangere/undersjangere og tiår-beskrivelser. Bygger et skjema dynamisk fra
//  feltspesifikasjoner, beregner differansen mot dagens verdier, og lagrer
//  forslaget via addPendingEdit. Også: åpning for å foreslå et helt nytt
//  innovasjonskort via addTechProposal.
// ============================================================================

import { addPendingEdit, addTechProposal, resubmitTech, resubmitPendingEdit } from "../data/store.js";
import { diffFields } from "../ui/ui-edit.js";
import { modalOpen, modalClose } from "../ui/ui-modal.js";
import { TECH_CATEGORIES, TECH_TYPES } from "../ui/ui-tech.js";
import { INSTRUMENT_TIMELINE_GROUPS, DECADE_OPTIONS, SAMMENDRAG_MAKS } from "../felles/limits.js";
import { SOURCE_SPEC, musicSpecWithGenres, addRow, buildRows, collectRows, normalizeRows } from "../ui/row-editor.js";
import { GENEALOGY_MAIN_GENRES } from "../sjangre/genre-model.js";
import { apneArtistSkjema } from "../ui/artist-skjema.js";
import { setupGenrePicker, fillGenrePicker, buildGenrePicker, collectGenrePicker } from "../sjangre/genre-picker.js";
import { setupFormatBars } from "../ui/format-bar.js";
import { TREG_SENDING_MELDING, escapeHtml } from "../felles/util.js";
import { wireCharCount } from "../ui/ui-helpers.js";

// Sjangervokabularet kommer fra slektstreet i Firestore, altså ASYNKRONT.
// Derfor bygges det ved KALL, ikke ved import: en modulnivå-konstant ville
// frosset en tom liste for alltid (samme felle som student.js dokumenterer).
const sorterteSjangre = () => [...GENEALOGY_MAIN_GENRES].sort((a, b) => a.localeCompare(b, "no"));
const musicSpecSj = () => musicSpecWithGenres(sorterteSjangre());

// Artistene har sitt eget femstegs-skjema fra v6.96 (js/ui/artist-skjema.js,
// brukervalg 2026-10-13): det samme som «Foreslå en artist» og lærerens
// redigering. openProposalEditor sender dem dit (apneArtistForslag under);
// feltlistene her gjelder de andre korttypene.

const KILDE_FELT = { key: "kilder", label: "Kilder", type: "rows", spec: () => SOURCE_SPEC, addLabel: "+ Legg til kilde", full: true };

const FIELD_SPECS = {
  tech: [
    // Typen står ØVERST fordi den styrer resten av skjemaet: velger man
    // «Viktig hendelse», skjules kategori (som bare gjelder teknologi).
    { key: "type", label: "Hva slags kort er dette?", type: "radio",
      options: TECH_TYPES, full: true },
    { key: "name", label: "Navn", type: "text" },
    { key: "category", label: "Kategori", type: "select", options: [
      { value: "", label: "Velg…" },
      // Kategoriene fra samme kilde som fanene/filtrene (ui-tech.TECH_CATEGORIES).
      ...TECH_CATEGORIES.map((c) => ({ value: c, label: c })),
    ] },
    // Instrumentgruppen kortet hører til — styrer hvilken tidslinje det havner
    // på i Instrumenter-seksjonen. Tomt = kortet vises kun under Teknologi.
    { key: "instrument", label: "Instrument", type: "select", options: [
      { value: "", label: "Ingen / gjelder ikke ett instrument" },
      ...INSTRUMENT_TIMELINE_GROUPS.map((i) => ({ value: i, label: i })),
    ] },
    // Tiåret styrer hvilken tiårs-tidslinje kortet havner på. Var fritekst
    // t.o.m. v4.97; en skrivefeil («1955») ga et kort som falt ut av tidslinjen
    // uten at noe så feil ut.
    { key: "decade", label: "Tiår (for filtrering)", type: "select", options: [
      { value: "", label: "Velg tiår …" },
      ...DECADE_OPTIONS,
    ] },
    // FEIL T.O.M. v4.96: adoptedYear sto her med etiketten «Oppfunnet», og
    // inventedYear — feltet kortet FAKTISK viser som «Oppfunnet» — kunne ikke
    // foreslås i det hele tatt. En student som rettet oppfinnelsesåret skrev
    // altså til året kortet plasseres etter på teknologitidslinjen, og
    // lærerens diff-tabell kalte endringen «Oppfunnet». Etikettene her er nå
    // ordrett de samme som i lærerens editor (teacher.html).
    { key: "inventedYear", label: "Oppfunnet (år)", type: "number",
      hint: "Året teknologien ble oppfunnet eller patentert." },
    { key: "adoptedYear", label: "Tatt i bruk (år)", type: "number",
      hint: "Året det ble tatt i bruk i nevneverdig skala." },
    { key: "adoptedLabel", label: "Tatt i bruk (kort forklaring)", type: "text", max: 150 },
    { key: "description", label: "Beskrivelse", type: "textarea", full: true },
    KILDE_FELT,
    { key: "imageUrl", label: "Bilde-URL", type: "text", full: true },
    { key: "imageCredit", label: "Bildekreditering", type: "text", full: true, max: 150 },
  ],
  // `levels` avgrenser et felt til bestemte sjangernivåer. Epoke-feltene
  // gjelder KUN tre-sjangrene (main) — samme regel som lærerens editor, som
  // skjuler dem for undersjangre: en fri undersjanger har ingen epoke å måle,
  // og lærersiden lagrer dem heller ikke på det nivået.
  subgenre: [
    { key: "description", label: "Beskrivelse", type: "textarea", full: true },
    { key: "activeFrom", label: "Mest aktiv fra år", type: "number", levels: ["main"] },
    { key: "activeTo", label: "Mest aktiv til år (tom = fortsatt aktiv)", type: "number", levels: ["main"] },
    { key: "era", label: "Epoke med ord", type: "text", levels: ["main"], full: true, max: 60,
      hint: "Vises ordrett på sjangertidslinjen, og på sjangerkortet når årstallene over står tomme. Bruk den for nyansering av årstallene hvis nødvendig." },
    KILDE_FELT,
  ],
  // Kilder er PÅKREVD for studentforslag her (brukerkrav): sammendraget er
  // studentarbeid som skal kunne etterprøves, akkurat som instrumentkortene.
  // Læreren skriver i sin egen editor og møter ikke kravet.
  instrument: [
    { key: "body", label: "Sammendrag av instrumentets utvikling", type: "textarea", full: true, max: SAMMENDRAG_MAKS },
    { ...KILDE_FELT, label: "Kilder *" },
  ],
  "decade-society": [
    { key: "society", label: "Samfunnsutvikling", type: "textarea", full: true },
  ],
  "decade-tech": [
    { key: "tech", label: "Teknologiutvikling", type: "textarea", full: true },
  ],
};

// Feltene for en entityType (artistene har eget skjema, se over).
function fieldSpecsFor(entityType) {
  return FIELD_SPECS[entityType] || null;
}

const TITLES = {
  artist: "Foreslå endring på artist",
  tech: "Foreslå endring på innovasjonskort",
  subgenre: "Foreslå endring på sjangerbeskrivelse",
  instrument: "Foreslå endring på instrumentsammendrag",
  "decade-society": "Foreslå endring på samfunnsutvikling",
  "decade-tech": "Foreslå endring på teknologiutvikling",
  "new-tech": "Foreslå nytt innovasjonskort",
};

function inputForField(spec, value) {
  const v = value == null ? "" : value;
  const id = `prop-f-${spec.key}`;
  const fullClass = spec.full ? ' class="full"' : "";
  const labelHtml = `<label${fullClass}>${escapeHtml(spec.label)}`;
  // spec.hint: kort forklaringslinje under feltet (samme uttrykk som .hint
  // ellers i skjemaene). spec.max: maxlength, for felter som har et tak i
  // lærerens editor og i firestore.rules.
  const hint = spec.hint ? `<p class="hint">${escapeHtml(spec.hint)}</p>` : "";
  const maxAttr = spec.max ? ` maxlength="${spec.max}"` : "";
  if (spec.type === "textarea") {
    // data-format gir feltet formatlinja (fet/kursiv/lister) — se format-bar.js.
    // De lange tekstene får også mellomtittel-knappen.
    const langt = spec.key === "description" || spec.key === "body" || /More$/.test(spec.key);
    // maxlength settes her OG telleren kobles i fillRows — attributtet alene
    // stopper skrivingen uten å si hvorfor.
    return `${labelHtml}<textarea id="${id}" rows="4" data-format="${langt ? "full" : "kort"}"${maxAttr}>${escapeHtml(v)}</textarea>${hint}</label>`;
  }
  if (spec.type === "select") {
    // En lagret verdi utenfor vokabularet beholdes som eget valg (samme vern
    // som row-editor.js): et kort med et tiår skrevet inn før feltet ble et
    // nedtrekk skal ikke miste det stille ved neste forslag.
    const opts = (spec.options || []).some((o) => o.value === v) || v === ""
      ? spec.options
      : [...spec.options, { value: v, label: `${v} (utenfor lista)` }];
    const optsHtml = opts.map((o) =>
      `<option value="${escapeHtml(o.value)}"${o.value === v ? " selected" : ""}>${escapeHtml(o.label)}</option>`
    ).join("");
    return `${labelHtml}<select id="${id}">${optsHtml}</select>${hint}</label>`;
  }
  if (spec.type === "number") {
    return `${labelHtml}<input type="number" id="${id}" value="${escapeHtml(v)}" />${hint}</label>`;
  }
  if (spec.type === "csv") {
    const display = Array.isArray(v) ? v.join(", ") : (v || "");
    return `${labelHtml}<input type="text" id="${id}" value="${escapeHtml(display)}" /></label>`;
  }
  if (spec.type === "radio") {
    // Standard er første valg — et kort uten `type` ER en innovasjon.
    const valgt = spec.options.some((o) => o.value === v) ? v : spec.options[0].value;
    return `<div${fullClass}><span class="field-label">${escapeHtml(spec.label)}</span>` +
      `<div class="radio-row" id="${id}">` + spec.options.map((o) =>
        `<label class="radio-opt"><input type="radio" name="${id}" value="${escapeHtml(o.value)}"` +
        `${o.value === valgt ? " checked" : ""} /> ${escapeHtml(o.label)}</label>`
      ).join("") + `</div></div>`;
  }
  // «rows»: strukturerte rader (sentrale verk, musikkeksempler, kilder) med
  // NØYAKTIG de samme rad-editorene som hovedskjemaene bruker. Selve radene
  // bygges etter innsetting i DOM (fillRows) — en innerHTML-streng her ville
  // ikke fått med fjern-knappenes hendelser.
  if (spec.type === "rows") {
    return `<div${fullClass}><span class="field-label">${escapeHtml(spec.label)}</span>${hint}` +
      `<div id="${id}"></div>` +
      `<button type="button" class="btn ghost small" data-add-rows="${id}">${escapeHtml(spec.addLabel || "+ Legg til")}</button></div>`;
  }
  // «genres»: sjangervelgeren fra slektstreet (js/sjangre/genre-picker.js), samme som
  // i skjemaet for ny artist. Brikkene og vokabularet fylles i fillRows.
  if (spec.type === "genres") {
    return `<div class="full genre-picker" id="${id}">` +
      `<span class="field-label">${escapeHtml(spec.label)}</span>` +
      `<select class="gp-velg" aria-label="Legg til sjanger"></select>` +
      `<div class="gp-valgte"></div></div>`;
  }
  return `${labelHtml}<input type="text" id="${id}" value="${escapeHtml(v)}"${maxAttr} />${hint}</label>`;
}

function readField(spec) {
  const el = document.getElementById(`prop-f-${spec.key}`);
  if (!el) return undefined;
  if (spec.type === "number") {
    const n = el.value === "" ? null : parseInt(el.value, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (spec.type === "csv") {
    return el.value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (spec.type === "rows") {
    return collectRows(el, spec.spec());
  }
  if (spec.type === "genres") {
    return collectGenrePicker(el);
  }
  if (spec.type === "radio") {
    return el.querySelector("input:checked")?.value || spec.options[0].value;
  }
  return el.value.trim();
}

// Kategori gjelder bare teknologi. Velger man «Viktig hendelse», skjules feltet
// og verdien tømmes — ellers ville et kort som byttet type dratt med seg
// «Opptak og avspilling» inn på en hendelse.
function wireTypeToggle() {
  const radios = document.querySelectorAll('#prop-f-type input[type="radio"]');
  const katFelt = document.getElementById("prop-f-category")?.closest("label");
  if (!radios.length || !katFelt) return;
  const oppdater = () => {
    const hendelse = document.querySelector('#prop-f-type input:checked')?.value === "hendelse";
    katFelt.hidden = hendelse;
    if (hendelse) document.getElementById("prop-f-category").value = "";
  };
  radios.forEach((r) => r.addEventListener("change", oppdater));
  oppdater();
}

// Rad-editorene og sjangervelgeren må bygges ETTER at skjemaet står i DOM:
// begge kobler hendelser per element, og det overlever ikke en innerHTML-streng.
function fillRows(specs, values) {
  for (const s of specs) {
    const wrap = document.getElementById(`prop-f-${s.key}`);
    if (!wrap) continue;
    if (s.type === "textarea" && s.max) {
      wireCharCount(wrap, s.max);
    } else if (s.type === "rows") {
      // Samme normalisering som diffen bruker, så radene og sammenligningen
      // alltid ser identiske verdier.
      buildRows(wrap, s.spec(), normalizeRows(s.spec(), values?.[s.key]));
    } else if (s.type === "genres") {
      setupGenrePicker(wrap);
      fillGenrePicker(wrap, sorterteSjangre());
      buildGenrePicker(wrap, Array.isArray(values?.[s.key]) ? values[s.key] : []);
    }
  }
  document.querySelectorAll("#prop-form [data-add-rows]").forEach((btn) => {
    const s = specs.find((x) => `prop-f-${x.key}` === btn.dataset.addRows);
    if (!s) return;
    btn.onclick = () => addRow(document.getElementById(btn.dataset.addRows), s.spec(), {});
  });
}

// Timeren som lukker modalen etter «Forslag sendt ✓». Modul-lokal og alltid
// avbrutt ved ny åpning: rakk studenten å sende ett forslag og åpne et nytt
// innen 1,6 sekunder, lukket den gamle timeren det NYE skjemaet midt i
// utfyllingen.
let lukkeTimer = null;
function lukkEtterKvittering(modal) {
  clearTimeout(lukkeTimer);
  lukkeTimer = setTimeout(() => modalClose(modal), 1600);
}
function avbrytLukking() { clearTimeout(lukkeTimer); lukkeTimer = null; }

// Åpningsteller (v5.34, audit-funn 16): fortsettelsen etter en TREG innsending
// («fullføres av seg selv») må vite om studenten i mellomtiden har lukket
// skjemaet og åpnet et nytt. Er telleren endret når skrivingen omsider er
// ferdig, får den gamle fortsettelsen ikke røre delt UI (#prop-msg, knappen),
// og slett ikke lukke det NYE skjemaet med falsk kvittering. Selve skrivingen
// fullføres uansett, og retur-merket (meldReturSendt) settes fortsatt: det
// gjelder data, ikke skjermbildet.
let apneGen = 0;

// Firestore-SDK-en køer en skriving og prøver på nytt i det uendelige når
// nettet er borte — løftet avvises ALDRI. Knappen sto derfor i «Sender …» til
// siden ble lastet på nytt, og studenten sendte inn på nytt «for sikkerhets
// skyld». Vi avbryter ikke skrivingen (den fullføres av seg selv), men sier
// fra når den tar uvanlig lang tid.
const SEND_VARSEL_MS = 8000;
function medTidsvarsel(promise, nårTreg) {
  const timer = setTimeout(nårTreg, SEND_VARSEL_MS);
  return Promise.resolve(promise).finally(() => clearTimeout(timer));
}

// http/https-sjekk (samme regel som safeUrl bruker ved lagring).
const erHttpUrl = (u) => /^https?:\/\//i.test((u || "").trim());

// Navnet på den som foreslår er PÅKREVD (brukervalg 2026-09-02): et forslag
// læreren ikke vet opphavet til, kan hen ikke gå i dialog om. Returnerer
// fornavnet, eller tom streng etter å ha vist feilen og flyttet fokus dit.
// Delt av begge flytene, så kravet ikke kan gjelde bare den ene.
function lesForslagsstiller() {
  const el = document.getElementById("prop-by");
  const navn = el.value.trim();
  if (navn) return navn;
  const msg = document.getElementById("prop-msg");
  msg.textContent = "Skriv fornavnet ditt nederst, så læreren vet hvem forslaget kommer fra.";
  msg.className = "form-msg error";
  el.focus();
  return "";
}

// En halvutfylt rad droppes stille av collectRows (den filtrerer på keepKey, og
// tallfelter/URL-er som ikke holder mål forsvinner). Studenten skal få vite det
// framfor å tro at raden ble sendt inn. Samme regler som artistskjemaet
// (finnFeil i js/ui/artist-skjema.js).
function validateRows(specs) {
  for (const spec of specs) {
    if (spec.type !== "rows") continue;
    const wrap = document.getElementById(`prop-f-${spec.key}`);
    if (!wrap) continue;
    const rowSpec = spec.spec();
    for (const rad of wrap.querySelectorAll("." + rowSpec.rowClass)) {
      const les = (cls) => rad.querySelector("." + cls)?.value.trim() || "";
      if (rowSpec === SOURCE_SPEC) {
        const tekst = les("source-text"), url = les("source-url");
        if (!tekst && !url) continue;
        if (!tekst) return "En kilde har en lenke, men mangler tekst. Skriv inn kildehenvisningen.";
        if (url && !erHttpUrl(url)) return `Kilden «${tekst}» har en ugyldig lenke (må starte med https://). Fjern eller rett lenken.`;
      } else if (rowSpec.rowClass === "me-row") {
        const tittel = les("me-label"), url = les("me-url");
        if (!tittel && !url) continue;
        if (!erHttpUrl(url)) {
          return `Musikkeksempelet ${tittel ? `«${tittel}»` : "(uten tittel)"} mangler en gyldig lenke (må starte med https://).`;
        }
        // Starttidsfeltet (v5.88) merker seg selv ugyldig, se kobleStarttid.
        const start = rad.querySelector(".me-start");
        if (start && !start.validity.valid) {
          return `Starttiden for ${tittel ? `«${tittel}»` : "musikkeksempelet"}: ${start.validationMessage}`;
        }
      }
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
//  Returflyt (v5.13): lever en returnert innsending på nytt
// ----------------------------------------------------------------------------

// Banner mellom tittel og skjema: lærerens tilbakemelding + valgfri kommentar
// tilbake. Modalen deles med vanlige forslag, så banneret fjernes eksplisitt
// ved åpninger uten retur.
function visReturBanner(retur) {
  const form = document.getElementById("prop-form");
  let b = document.getElementById("prop-retur-banner");
  if (!retur) { b?.remove(); return; }
  if (!b) {
    b = document.createElement("div");
    b.id = "prop-retur-banner";
    b.className = "retur-info";
    form.parentNode.insertBefore(b, form);
  }
  b.innerHTML = `
    <span><strong>Tilbakemelding fra læreren:</strong> ${escapeHtml(retur.teacherFeedback || "")}</span>
    <label style="display:block;margin-top:6px">Kommentar til læreren (valgfritt)
      <textarea id="prop-retur-comment" rows="2" maxlength="1000" style="width:100%" placeholder="F.eks. hva du har endret"></textarea>
    </label>`;
}

function lesReturKommentar() {
  return document.getElementById("prop-retur-comment")?.value.trim() || "";
}

// Forsiden lytter og fjerner innsendingen fra retur-panelet når den er levert.
function meldReturSendt(id) {
  document.dispatchEvent(new CustomEvent("pensum:retur-sendt", { detail: { id } }));
}

// Inngangen fra forsidens retur-panel: gjenåpne riktig editor for en
// returnert innsending, prefylt med studentens eget forslag. Artist-returer
// rutes IKKE hit — de har eget skjema (student.html?retur=<id>).
export function openReturInnsending(retur, currentValues) {
  // Skjemaet forhåndsvelges med KORTETS type, ikke rutingtypen «tech».
  if (retur.type === "tech") return openNewTechProposal({ ...retur, type: retur.kortType }, retur);
  if (retur.type === "edit") {
    return openProposalEditor({
      entityType: retur.entityType,
      entityId: retur.entityId,
      entityName: retur.entityName,
      level: retur.level,
      currentValues: currentValues || {},
      retur,
    });
  }
}

// Hoved-API: åpne redigereren for en eksisterende entitet.
// config = { entityType, entityId, entityName, currentValues, retur? }
export function openProposalEditor(config) {
  if (config.entityType === "artist") return apneArtistForslag(config);
  const modal = document.getElementById("modal-proposal");
  if (!modal) return;
  const alleSpecs = fieldSpecsFor(config.entityType);
  if (!alleSpecs) {
    console.warn("Ingen feltspesifikasjon for", config.entityType);
    return;
  }
  // Felter merket med `levels` vises kun på de nivåene. Filtreres HER, ikke i
  // visningen: da følger både innlesing (readField) og diffen samme liste, og
  // et skjult felt kan ikke sende med en verdi studenten aldri så.
  const niva = config.level || "main";
  const specs = alleSpecs.filter((s) => !s.levels || s.levels.includes(niva));

  const retur = config.retur || null;
  document.getElementById("prop-title").textContent = retur
    ? `Lever på nytt: ${config.entityName || config.entityId || ""}`
    : (config.entityName
      ? `${TITLES[config.entityType] || "Foreslå endring"}: ${config.entityName}`
      : (TITLES[config.entityType] || "Foreslå endring"));
  document.getElementById("prop-msg").textContent = "";
  document.getElementById("prop-by").value = retur?.proposedBy || "";

  avbrytLukking();
  const gen = ++apneGen;
  visReturBanner(retur);
  // Ved retur redigerer studenten VIDERE på sitt eget forslag: skjemaet fylles
  // med forslaget lagt oppå dagens verdier. Diffen regnes fortsatt mot dagens
  // verdier (uendret under), så det som sendes er hele det gjeldende avviket.
  const grunnlag = retur
    ? { ...(config.currentValues || {}), ...(retur.proposedFields || {}) }
    : (config.currentValues || {});
  const form = document.getElementById("prop-form");
  form.innerHTML = specs.map((s) => inputForField(s, grunnlag?.[s.key])).join("");
  fillRows(specs, grunnlag);
  setupFormatBars(form);
  wireTypeToggle();

  const submit = document.getElementById("prop-submit");
  submit.disabled = false;
  submit.textContent = retur ? "Send inn på nytt" : "Send forslag";
  submit.classList.remove("sent");
  submit.classList.add("primary");
  submit.onclick = async () => {
    const proposed = {};
    for (const s of specs) {
      const v = readField(s);
      if (v !== undefined) proposed[s.key] = v;
    }
    // Kilder-felter: normaliser DAGENS verdi til samme form som collectRows
    // leverer ({ text, url }, tomme rader borte) før diffen. Ellers ga en
    // urørt kilde uten url-felt — eller et kort helt uten kilder (undefined
    // mot []) — en falsk «endring» som lot tomme forslag slippe gjennom og
    // kunne viske ut kilder ved godkjenning.
    const current = { ...(config.currentValues || {}) };
    for (const s of specs) {
      if (s.type === "rows") current[s.key] = normalizeRows(s.spec(), current[s.key]);
    }
    const msg = document.getElementById("prop-msg");
    // Rader med innhold men uten gyldig lenke/tekst ville blitt droppet stille
    // av collectRows. Samme sjekk som skjemaet for ny artist gjør.
    const radFeil = validateRows(specs);
    if (radFeil) {
      msg.textContent = radFeil;
      msg.className = "form-msg error";
      return;
    }
    // maxlength stopper tasting og liming, men ikke tekst som alt lå der da
    // taket kom. Da skal innsendingen si tydelig ifra.
    const forLangt = specs.find((s) => s.max && s.type === "textarea" && (proposed[s.key] || "").length > s.max);
    if (forLangt) {
      msg.textContent = `${forLangt.label} kan være maks ${forLangt.max} tegn (er ${proposed[forLangt.key].length}).`;
      msg.className = "form-msg error";
      return;
    }
    // Instrumentsammendraget SKAL ha kilder (brukerkrav): teksten er
    // studentarbeid som skal kunne etterprøves.
    if (config.entityType === "instrument" && !(proposed.kilder || []).length) {
      msg.textContent = "Legg til minst én kilde til sammendraget.";
      msg.className = "form-msg error";
      return;
    }
    const diff = diffFields(current, proposed);
    if (!Object.keys(diff).length) {
      msg.textContent = retur
        ? "Forslaget er nå helt likt det som alt står i appen, så det er ingenting å sende inn."
        : "Du har ikke endret noe ennå.";
      msg.className = "form-msg error";
      return;
    }
    const forslagsstiller = lesForslagsstiller();
    if (!forslagsstiller) return;
    submit.disabled = true;
    submit.textContent = "Sender …";
    try {
      const skriv = retur
        ? resubmitPendingEdit(retur.id, diff, forslagsstiller, retur.returKode, lesReturKommentar())
        : addPendingEdit({
            entityType: config.entityType,
            entityId: config.entityId,
            entityName: config.entityName,
            proposedFields: diff,
            proposedBy: forslagsstiller,
            level: config.level,
          });
      await medTidsvarsel(skriv, () => {
        if (gen !== apneGen) return;
        msg.textContent = TREG_SENDING_MELDING;
        msg.className = "form-msg warn";
      });
      if (retur) meldReturSendt(retur.id);
      if (gen !== apneGen) return;
      msg.textContent = retur ? "Sendt inn på nytt. Læreren ser den i køen sin." : "Takk! Forslaget er sendt til lærer.";
      msg.className = "form-msg ok";
      submit.textContent = retur ? "Sendt inn på nytt ✓" : "Forslag sendt ✓";
      submit.classList.remove("primary");
      submit.classList.add("sent");
      lukkEtterKvittering(modal);
    } catch (e) {
      if (gen !== apneGen) return;
      msg.textContent = "Kunne ikke sende forslag: " + (e?.message || e);
      msg.className = "form-msg error";
      submit.disabled = false;
      submit.textContent = retur ? "Send inn på nytt" : "Send forslag";
    }
  };

  modalOpen(modal);
}

// «Foreslå endring» på en artist (v6.96): det felles femstegs-skjemaet i
// forslagsmodus. Diffen mot dagens verdier blir endringsforslaget, som før.
// Ved retur redigerer studenten videre på sitt eget forslag: skjemaet fylles
// med forslaget lagt oppå dagens verdier, og diffen regnes fortsatt mot dagens
// verdier, så det som sendes er hele det gjeldende avviket.
function apneArtistForslag(config) {
  const retur = config.retur || null;
  const naa = config.currentValues || {};
  const grunnlag = retur ? { ...naa, ...(retur.proposedFields || {}) } : naa;
  const gen = ++apneGen;
  apneArtistSkjema({
    modus: "forslag",
    tittel: retur
      ? `Lever på nytt: ${config.entityName || config.entityId || ""}`
      : `${TITLES.artist}: ${config.entityName || ""}`,
    // «Ditt navn» er den som foreslår nå, ikke den som la inn artisten.
    verdier: { ...grunnlag, proposedBy: retur?.proposedBy || "" },
    retur: retur ? {
      html: `<strong>Tilbakemelding fra læreren:</strong> ${escapeHtml(retur.teacherFeedback || "")}`,
      kommentar: true,
    } : null,
    sendTekst: retur ? "Send inn på nytt" : "Send forslag",
    onSend: async (v, api) => {
      const { proposedBy, studentComment, ...foreslatt } = v;
      // Radfeltene normaliseres til formen skjemaet leverer, så en urørt
      // kilde eller et urørt lytteeksempel ikke ser endret ut.
      const current = {
        ...naa,
        musicExamples: normalizeRows(musicSpecSj(), naa.musicExamples),
        kilder: normalizeRows(SOURCE_SPEC, naa.kilder),
      };
      const diff = diffFields(current, foreslatt);
      if (!Object.keys(diff).length) {
        return {
          tekst: retur
            ? "Forslaget er nå helt likt det som alt står i appen, så det er ingenting å sende inn."
            : "Du har ikke endret noe ennå.",
          type: "error",
        };
      }
      await (retur
        ? resubmitPendingEdit(retur.id, diff, proposedBy, retur.returKode, studentComment)
        : addPendingEdit({
            entityType: "artist",
            entityId: config.entityId,
            entityName: config.entityName,
            proposedFields: diff,
            proposedBy,
          }));
      if (retur) meldReturSendt(retur.id);
      if (gen === apneGen) api.lukkSnart(1600);
      return {
        tekst: retur ? "Sendt inn på nytt. Læreren ser den i køen sin." : "Takk! Forslaget er sendt til lærer.",
        knapp: retur ? "Sendt inn på nytt ✓" : "Forslag sendt ✓",
        laas: true,
      };
    },
  });
}

// Forslag om et helt nytt innovasjonskort. Alle felter er blanke, med mindre
// `preset` fyller noen på forhånd.
//
// Instrumenter-seksjonen sender preset = { instrument, category } fra knappen
// «Foreslå nytt instrumentkort» under hver tidslinje, så studenten slipper å
// vite hvilken gruppe og kategori kortet skal ha — og kortet havner garantert
// på riktig tidslinje. Da er KILDER obligatorisk (brukerkrav): et instrumentkort
// er studentarbeid som skal kunne etterprøves.
export function openNewTechProposal(preset = null, retur = null) {
  const modal = document.getElementById("modal-proposal");
  if (!modal) return;
  const specs = FIELD_SPECS.tech;
  const forInstrument = !!preset?.instrument;

  document.getElementById("prop-title").textContent = retur
    ? `Lever på nytt: ${retur.name || "(uten navn)"}`
    : (forInstrument
      ? `Foreslå nytt instrumentkort: ${preset.instrument}`
      : TITLES["new-tech"]);
  document.getElementById("prop-msg").textContent = "";
  document.getElementById("prop-by").value = retur?.proposedBy || "";

  avbrytLukking();
  const gen = ++apneGen;
  visReturBanner(retur);
  const form = document.getElementById("prop-form");
  form.innerHTML = specs
    .map((s) => inputForField(
      forInstrument && s.key === "kilder" ? { ...s, label: s.label + " *" } : s,
      preset?.[s.key] ?? ""
    ))
    .join("");
  fillRows(specs, preset || {});
  setupFormatBars(form);
  wireTypeToggle();

  const submit = document.getElementById("prop-submit");
  submit.disabled = false;
  submit.textContent = retur ? "Send inn på nytt" : "Send forslag";
  submit.classList.remove("sent");
  submit.classList.add("primary");
  submit.onclick = async () => {
    const data = {};
    for (const s of specs) {
      const v = readField(s);
      // Retur: også TØMTE felter skrives (studenten kan ha fjernet noe læreren
      // ba dem fjerne) — en utelatt nøkkel ville latt den gamle verdien stå.
      // Ny innsending: tomme felter utelates som før.
      if (retur) { if (v !== undefined) data[s.key] = v; }
      else if (v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) data[s.key] = v;
    }
    const msg = document.getElementById("prop-msg");
    // Samme radvalidering som endringsflyten: en kilderad med lenke uten tekst,
    // eller en ugyldig URL, droppes ellers STILLE av collectRows, og studenten
    // tror den ble sendt inn.
    const radFeil = validateRows(specs);
    if (radFeil) {
      msg.textContent = radFeil;
      msg.className = "form-msg error";
      return;
    }
    if (!data.name) {
      msg.textContent = "Navn må fylles ut.";
      msg.className = "form-msg error";
      return;
    }
    if (forInstrument && !(data.kilder || []).length) {
      msg.textContent = "Minst én kilde må fylles ut.";
      msg.className = "form-msg error";
      return;
    }
    const forslagsstiller = lesForslagsstiller();
    if (!forslagsstiller) return;
    submit.disabled = true;
    submit.textContent = "Sender …";
    try {
      const skriv = retur
        ? resubmitTech(retur.id, { ...data, proposedBy: forslagsstiller }, retur.returKode, lesReturKommentar())
        : addTechProposal({ ...data, proposedBy: forslagsstiller });
      await medTidsvarsel(skriv, () => {
        if (gen !== apneGen) return;
        msg.textContent = TREG_SENDING_MELDING;
        msg.className = "form-msg warn";
      });
      if (retur) meldReturSendt(retur.id);
      if (gen !== apneGen) return;
      msg.textContent = retur ? "Sendt inn på nytt. Læreren ser den i køen sin." : "Takk! Forslaget er sendt til lærer.";
      msg.className = "form-msg ok";
      submit.textContent = retur ? "Sendt inn på nytt ✓" : "Forslag sendt ✓";
      submit.classList.remove("primary");
      submit.classList.add("sent");
      lukkEtterKvittering(modal);
    } catch (e) {
      if (gen !== apneGen) return;
      msg.textContent = "Kunne ikke sende forslag: " + (e?.message || e);
      msg.className = "form-msg error";
      submit.disabled = false;
      submit.textContent = retur ? "Send inn på nytt" : "Send forslag";
    }
  };

  modalOpen(modal);
}

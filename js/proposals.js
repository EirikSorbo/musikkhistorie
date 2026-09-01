// ============================================================================
//  ENDRINGSFORSLAG (studentside)
// ----------------------------------------------------------------------------
//  Generisk redigerer som lar studenter foreslå endringer på artister, tech,
//  sjangere/undersjangere og tiår-beskrivelser. Bygger et skjema dynamisk fra
//  feltspesifikasjoner, beregner differansen mot dagens verdier, og lagrer
//  forslaget via addPendingEdit. Også: åpning for å foreslå et helt nytt
//  innovasjonskort via addTechProposal.
// ============================================================================

import { addPendingEdit, addTechProposal } from "./store.js?v=5.01";
import { diffFields, escapeHtml, modalOpen, modalClose, TECH_CATEGORIES, TECH_TYPES } from "./ui.js?v=5.01";
import { ARTIST_FIELDS } from "./artist-schema.js?v=5.01";
import { GENDERS, INSTRUMENTS, INSTRUMENT_TIMELINE_GROUPS, DECADE_OPTIONS, SAMMENDRAG_MAKS } from "./limits.js?v=5.01";
import { WORK_SPEC, SOURCE_SPEC, musicSpecWithGenres, addRow, buildRows, collectRows, normalizeRows } from "./row-editor.js?v=5.01";
import { GENEALOGY_META_GENRES, GENEALOGY_MAIN_GENRES } from "./genre-model.js?v=5.01";
import { setupGenrePicker, fillGenrePicker, buildGenrePicker, collectGenrePicker } from "./genre-picker.js?v=5.01";
import { setupFormatBars } from "./format-bar.js?v=5.01";
import { wireCharCount } from "./ui-helpers.js?v=5.01";

// Sjangervokabularet kommer fra slektstreet i Firestore, altså ASYNKRONT.
// Derfor bygges det ved KALL, ikke ved import: en modulnivå-konstant ville
// frosset en tom liste for alltid (samme felle som student.js dokumenterer).
const sorterteSjangre = () => [...GENEALOGY_MAIN_GENRES].sort((a, b) => a.localeCompare(b, "no"));
const musicSpecSj = () => musicSpecWithGenres(sorterteSjangre());
const valgListe = (verdier, tom) => [{ value: "", label: tom }, ...verdier.map((v) => ({ value: v, label: v }))];

// Artistfeltene utledes fra det delte skjemaet (artist-schema.js), og skal ha
// NØYAKTIG de samme inngangene som «Foreslå en artist» (student.html).
// T.o.m. v4.99 falt «complex»-feltene (sentrale verk, musikkeksempler, kilder)
// ut her: en student kunne foreslå en HELT ny artist med lytteeksempler, men
// ikke føye ett til på en artist som alt lå inne. Nå har de samme rad-editorer
// begge steder. Funksjon, ikke konstant: sjangre og metasjangre kommer fra
// treet i Firestore.
function artistSpecs() {
  return ARTIST_FIELDS.map((f) => {
    if (f.type === "gender") {
      return { ...f, type: "select", options: [{ value: "", label: "Velg…" }, ...GENDERS] };
    }
    // Kontrollerte vokabularer, som i skjemaet for ny artist. Et fritekstfelt
    // her lot studenten foreslå en verdi som ikke finnes noe sted i appen.
    // En lagret verdi utenfor lista beholdes av select-koden under, så gammel
    // data aldri mistes stille.
    if (f.key === "metaGenre") {
      return { ...f, type: "select", options: valgListe(GENEALOGY_META_GENRES, "Velg metasjanger …") };
    }
    if (f.key === "instrument") {
      return { ...f, type: "select", options: valgListe(INSTRUMENTS, "Velg instrument …") };
    }
    if (f.key === "mainGenre") {
      return { ...f, type: "genres", label: "Sjangre (fra slektstreet)", full: true };
    }
    if (f.key === "keyWorks") {
      return { ...f, type: "rows", spec: () => WORK_SPEC, addLabel: "+ Legg til verk", full: true };
    }
    if (f.key === "musicExamples") {
      return { ...f, type: "rows", spec: musicSpecSj, addLabel: "+ Legg til musikkeksempel", full: true };
    }
    if (f.key === "kilder") {
      return { ...f, type: "rows", spec: () => SOURCE_SPEC, addLabel: "+ Legg til kilde", full: true };
    }
    if (f.type === "csv") {
      return { ...f, label: `${f.label} (kommaseparert)` };
    }
    return { ...f };
  });
}

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
    { key: "adoptedLabel", label: "Tatt i bruk (kort forklaring)", type: "text" },
    { key: "description", label: "Beskrivelse", type: "textarea", full: true },
    KILDE_FELT,
    { key: "imageUrl", label: "Bilde-URL", type: "text", full: true },
    { key: "imageCredit", label: "Bildekreditering", type: "text", full: true },
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

// Feltene for en entityType. Artist bygges ved kall (asynkront vokabular).
function fieldSpecsFor(entityType) {
  return entityType === "artist" ? artistSpecs() : (FIELD_SPECS[entityType] || null);
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
  // «genres»: sjangervelgeren fra slektstreet (js/genre-picker.js), samme som
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

// http/https-sjekk (samme regel som safeUrl bruker ved lagring).
const erHttpUrl = (u) => /^https?:\/\//i.test((u || "").trim());

// En halvutfylt rad droppes stille av collectRows (den filtrerer på keepKey, og
// tallfelter/URL-er som ikke holder mål forsvinner). Studenten skal få vite det
// framfor å tro at raden ble sendt inn. Speiler validateExampleRows/
// validateSourceRows i student.js.
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
      } else if (rowSpec === WORK_SPEC) {
        const tittel = les("work-title"), url = les("work-url");
        if (!tittel && url) return "Et verk har en lenke, men mangler tittel. Skriv inn tittelen.";
        if (tittel && url && !erHttpUrl(url)) return `Verket «${tittel}» har en ugyldig lenke (må starte med https://).`;
      }
    }
  }
  return null;
}

// Hoved-API: åpne redigereren for en eksisterende entitet.
// config = { entityType, entityId, entityName, currentValues }
export function openProposalEditor(config) {
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

  document.getElementById("prop-title").textContent =
    config.entityName
      ? `${TITLES[config.entityType] || "Foreslå endring"}: ${config.entityName}`
      : (TITLES[config.entityType] || "Foreslå endring");
  document.getElementById("prop-msg").textContent = "";
  document.getElementById("prop-by").value = "";

  const form = document.getElementById("prop-form");
  form.innerHTML = specs.map((s) => inputForField(s, config.currentValues?.[s.key])).join("");
  fillRows(specs, config.currentValues || {});
  setupFormatBars(form);
  wireTypeToggle();

  const submit = document.getElementById("prop-submit");
  submit.disabled = false;
  submit.textContent = "Send forslag";
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
      msg.textContent = "Du har ikke endret noe ennå.";
      msg.className = "form-msg error";
      return;
    }
    submit.disabled = true;
    submit.textContent = "Sender …";
    try {
      await addPendingEdit({
        entityType: config.entityType,
        entityId: config.entityId,
        entityName: config.entityName,
        proposedFields: diff,
        proposedBy: document.getElementById("prop-by").value.trim() || "Anonym",
        level: config.level,
      });
      msg.textContent = "Takk! Forslaget er sendt til lærer.";
      msg.className = "form-msg ok";
      submit.textContent = "Forslag sendt ✓";
      submit.classList.remove("primary");
      submit.classList.add("sent");
      setTimeout(() => modalClose(modal), 1600);
    } catch (e) {
      msg.textContent = "Kunne ikke sende forslag: " + (e?.message || e);
      msg.className = "form-msg error";
      submit.disabled = false;
      submit.textContent = "Send forslag";
    }
  };

  modalOpen(modal);
}

// Forslag om et helt nytt innovasjonskort. Alle felter er blanke, med mindre
// `preset` fyller noen på forhånd.
//
// Instrumenter-seksjonen sender preset = { instrument, category } fra knappen
// «Foreslå nytt instrumentkort» under hver tidslinje, så studenten slipper å
// vite hvilken gruppe og kategori kortet skal ha — og kortet havner garantert
// på riktig tidslinje. Da er KILDER obligatorisk (brukerkrav): et instrumentkort
// er studentarbeid som skal kunne etterprøves.
export function openNewTechProposal(preset = null) {
  const modal = document.getElementById("modal-proposal");
  if (!modal) return;
  const specs = FIELD_SPECS.tech;
  const forInstrument = !!preset?.instrument;

  document.getElementById("prop-title").textContent = forInstrument
    ? `Foreslå nytt instrumentkort: ${preset.instrument}`
    : TITLES["new-tech"];
  document.getElementById("prop-msg").textContent = "";
  document.getElementById("prop-by").value = "";

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
  submit.textContent = "Send forslag";
  submit.classList.remove("sent");
  submit.classList.add("primary");
  submit.onclick = async () => {
    const data = {};
    for (const s of specs) {
      const v = readField(s);
      if (v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) data[s.key] = v;
    }
    const msg = document.getElementById("prop-msg");
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
    submit.disabled = true;
    submit.textContent = "Sender …";
    try {
      await addTechProposal({
        ...data,
        proposedBy: document.getElementById("prop-by").value.trim() || "Anonym",
      });
      msg.textContent = "Takk! Forslaget er sendt til lærer.";
      msg.className = "form-msg ok";
      submit.textContent = "Forslag sendt ✓";
      submit.classList.remove("primary");
      submit.classList.add("sent");
      setTimeout(() => modalClose(modal), 1600);
    } catch (e) {
      msg.textContent = "Kunne ikke sende forslag: " + (e?.message || e);
      msg.className = "form-msg error";
      submit.disabled = false;
      submit.textContent = "Send forslag";
    }
  };

  modalOpen(modal);
}

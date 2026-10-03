// ============================================================================
//  RAD-EDITOR — gjenbrukbare add/collect for verk, musikkeksempler og kilder
// ----------------------------------------------------------------------------
//  Samler tre tidligere identiske kopier (student-skjema, lærer-artistredigering
//  og tiårs-/sjangerbeskrivelser) til én spec-drevet implementasjon. Escaping er
//  innebygd, så prefylte verdier alltid er trygge (studentvarianten manglet det).
//  DOM-byggingen (addRow/buildRows) kjører kun i nettleser; rowInnerHtml er ren
//  og enhetstestbar. collectRows leser DOM.
// ============================================================================

import { escapeHtml } from "./util.js?v=6.19";
// Kategori-vokabularet er en fast konstant uten data-avhengigheter (til
// forskjell fra sjangerlista, som må sendes inn), så det kan importeres rett
// hit uten at row-editor blir avhengig av app-tilstand.
import { KILDE_KATEGORIER } from "./kilder.js?v=6.19";
// Starttiden (v5.88) bor i lenka; hjelperne er rene og deles med spilleren.
import { ytMaal, parseTid, medStarttid, starttidTekst } from "./presentasjon-modell.js?v=6.19";

// Feltspesifikasjon: { key (objektnøkkel), cls (input-klasse), type, ph,
// label (aria-label for skjermlesere), title?,
// always? (ta med i output selv når tom — ellers kun hvis utfylt),
// breakAfter? (tving linjeskift etter feltet i den wrappende flex-raden),
// ui? (bare et hjelpefelt i skjemaet: lagres aldri som egen nøkkel),
// verdi? (values → feltets startverdi, for ui-felt som vises fra et annet felt) }.
// removeLabel = aria-label på ✕-fjern-knappen. kobleRad? (row → void) kobler
// feltene i en ny rad til hverandre, se addRow.
export const WORK_SPEC = {
  rowClass: "work-row", removeClass: "remove-work", keepKey: "title",
  removeLabel: "Fjern verk",
  fields: [
    { key: "title", cls: "work-title", type: "text", ph: "Tittel (f.eks. «Cross Road Blues»)", label: "Tittel", always: true },
    { key: "year",  cls: "work-year",  type: "number", ph: "Årstall", label: "Årstall" },
    { key: "url",   cls: "work-url",   type: "url", ph: "https://… (valgfritt)", label: "Lenke (https)" },
  ],
};

export const MUSIC_SPEC = {
  rowClass: "me-row", removeClass: "remove-me", keepKey: "url",
  removeLabel: "Fjern musikkeksempel",
  fields: [
    // Sjangeren står ØVERST og på egen linje (v4.95): den gjelder HELE raden,
    // og bakerst i rekka ble den lett oversett — et lytteeksempel uten sjanger
    // faller ut av spillelistene. breakAfter tvinger linjeskift, se rowInnerHtml.
    { key: "genre", cls: "me-genre", type: "select", ph: "Sjanger …", label: "Sjanger (for spillelister)", title: "Hvilken tre-sjanger dette lytteeksempelet hører til. Styrer hvilken spilleliste det vises i, viktig for artister med flere sjangre.", options: [], breakAfter: true },
    { key: "label", cls: "me-label", type: "text", ph: "Tittel (f.eks. «Hellhound on My Trail»)", label: "Tittel", always: true },
    { key: "year",  cls: "me-year",  type: "number", ph: "Årstall", label: "Årstall" },
    { key: "url",   cls: "me-url",   type: "url", ph: "https://youtube.com/…", label: "Lenke (https)", always: true },
    // Starttiden (v5.88, brukerønske 2026-09-29) lagres ikke for seg: den
    // skrives inn i lenka som t=, der spilleren, visningen og heftet alltid
    // har lest den. Feltet og lenka speiler hverandre, se kobleStarttid.
    { key: "start", cls: "me-start", type: "text", ph: "Start m:ss", label: "Starttid", title: "Hvor avspillingen starter, som 1:30 eller 90 (sekunder). Skrives inn i YouTube-lenka (t=…). Limer du inn en lenke med tid, hentes tiden derfra.", ui: true, verdi: (v) => starttidTekst(v.url) },
    { key: "performanceYear", cls: "me-perf-year", type: "number", ph: "Framf.år", label: "Framføringsår", title: "Året for framføring/konsert (kun hvis annet enn utgivelsesår)" },
    { key: "note", cls: "me-note", type: "text", ph: "Hør etter … (valgfritt lytteanvisning)", label: "Hør etter", title: "Kort lytteanvisning: hva skal man legge merke til i akkurat denne innspillingen?" },
  ],
  kobleRad: (row) => kobleStarttid(row),
};

// Starttidsfeltet og lenka i én lytteeksempel-rad (v5.88). Lenka er det som
// lagres; feltet er en snarvei inn i den, og det sist redigerte feltet vinner:
//  - skriver du en tid, settes t= i lenka med en gang (tomt felt fjerner den);
//  - limer du inn en lenke med egen tid, vises den i feltet;
//  - bytter du til en lenke UTEN tid, tømmes feltet, for en tid fra en annen
//    opplasting treffer sjelden. Unntaket er en tid skrevet før det fantes en
//    lenke i raden: den legges inn i lenka når den kommer.
// En tid som ikke kan leses, eller en tid på en lenke som ikke er YouTube,
// merkes ugyldig (setCustomValidity), så skjemaet ikke sendes med en tid som
// stille forsvinner.
export function kobleStarttid(row) {
  const tid = row.querySelector(".me-start");
  const lenke = row.querySelector(".me-url");
  if (!tid || !lenke) return;
  let venter = false;   // tid skrevet før raden hadde en lenke
  const merk = (melding) => tid.setCustomValidity(melding || "");

  tid.addEventListener("input", () => {
    const tekst = tid.value.trim();
    const url = lenke.value.trim();
    const sek = parseTid(tekst);
    if (tekst && sek == null) { merk("Skriv tiden som 1:30 eller 90 (sekunder)."); return; }
    if (!url) { venter = !!sek; merk(""); return; }
    if (!ytMaal(url)) { merk(sek ? "Starttid virker bare med YouTube-lenker." : ""); return; }
    venter = false;
    merk("");
    lenke.value = medStarttid(url, sek);
  });

  // Mens lenka skrives eller limes inn: vis tiden den har med seg.
  lenke.addEventListener("input", () => {
    const egen = ytMaal(lenke.value.trim())?.start;
    if (egen) { tid.value = starttidTekst(lenke.value.trim()); venter = false; merk(""); }
  });

  // Når lenka er ferdig redigert: speil den, eller legg inn en ventende tid.
  lenke.addEventListener("change", () => {
    const url = lenke.value.trim();
    const maal = ytMaal(url);
    if (maal?.start) return;   // tatt av input-lytteren
    const sek = parseTid(tid.value.trim());
    if (!url) { venter = !!sek; merk(""); return; }   // tom lenke: tiden venter
    if (venter && sek && maal) lenke.value = medStarttid(url, sek);
    else tid.value = "";
    venter = false;
    merk("");
  });
}

// MUSIC_SPEC med sjangervalgene fylt inn i genre-selecten. Holder row-editor
// avhengighetsfri: kalleren sender inn gyldige tre-sjangre (typisk
// GENEALOGY_MAIN_GENRES fra genealogy.js).
export function musicSpecWithGenres(genres) {
  return {
    ...MUSIC_SPEC,
    fields: MUSIC_SPEC.fields.map((f) =>
      f.key === "genre" ? { ...f, options: [...(genres || [])] } : f
    ),
  };
}

export const SOURCE_SPEC = {
  rowClass: "source-row", removeClass: "remove-source", keepKey: "text",
  removeLabel: "Fjern kilde",
  fields: [
    { key: "text", cls: "source-text", type: "text", ph: "Kilde, f.eks. «Store norske leksikon.»", label: "Kildetekst", always: true },
    // Forfatter og årstall står for seg, ikke inne i kildeteksten: da kan de
    // vises likt overalt, og teksten kan holdes til navnet på publikasjonen
    // (samme form som artistkortene bruker).
    { key: "forfatter", cls: "source-forfatter", type: "text", ph: "Forfatter (valgfritt)", label: "Forfatter", always: true },
    { key: "year", cls: "source-year", type: "number", ph: "År", label: "Årstall", title: "Publiseringsår for kilden" },
    { key: "url",  cls: "source-url",  type: "url", ph: "https://… (valgfritt)", label: "Lenke (https)", always: true },
    // Kategorien styrer hvor kilden havner i Referanser-kortet. Lagret felt,
    // ikke gjettet: uten valg havner kilden under «Ukategorisert» der.
    { key: "kategori", cls: "source-kat", type: "select", ph: "Kategori …", label: "Kategori", title: "Hva slags kilde dette er. Styrer grupperingen i Referanser-kortet.", options: KILDE_KATEGORIER, always: true },
  ],
};

// Normaliserer en LAGRET liste til NØYAKTIG formen collectRows leverer for
// samme spec: `always`-felter alltid til stede (tomme som ""), tallfelter kun
// når de er gyldige, øvrige kun når de er utfylt, og rader uten keepKey borte.
//
// Dette er selve vernet mot FALSKE DIFFER i forslagseditoren. Uten det ville en
// urørt rad sett endret ut fordi den lagrede formen mangler et felt editoren
// alltid skriver ({ text } mot { text, url: "" }), og et kort helt uten liste
// ga en falsk «kilder: []»-endring i hvert eneste forslag. Med lytteeksempler
// og sentrale verk i editoren (v5.00) gjelder nøyaktig det samme der.
//
// En rad lagret som en ren STRENG (gamle kilder var det) leses som keepKey-en.
export function normalizeRows(spec, list) {
  if (!Array.isArray(list)) return [];
  return list.map((rå) => {
    const kilde = typeof rå === "string" ? { [spec.keepKey]: rå }
      : (rå && typeof rå === "object" ? rå : {});
    const ut = {};
    for (const f of spec.fields) {
      if (f.ui) continue;
      if (f.type === "number") {
        const n = parseInt(kilde[f.key], 10);
        if (Number.isFinite(n)) ut[f.key] = n;
        continue;
      }
      const v = String(kilde[f.key] ?? "").trim();
      if (f.always) ut[f.key] = v;
      else if (v) ut[f.key] = v;
    }
    return ut;
  }).filter((o) => o[spec.keepKey]);
}

// Kilde-lista spesifikt. Beholdt som eget navn fordi den er kalt fra flere
// moduler; implementasjonen er den generelle over.
export function normalizeSources(v) {
  return normalizeRows(SOURCE_SPEC, v);
}

function inputHtml(f, values) {
  const v = f.verdi ? f.verdi(values) : (values[f.key] == null ? "" : values[f.key]);
  if (f.type === "select") {
    // Eksisterende verdi som ikke står i options beholdes som eget valg,
    // så en re-lagring aldri mister den stille.
    const opts = Array.isArray(f.options) ? [...f.options] : [];
    const vs = String(v);
    if (vs && !opts.includes(vs)) opts.push(vs);
    let html = `<select class="${f.cls}"`;
    if (f.label) html += ` aria-label="${escapeHtml(f.label)}"`;
    if (f.title) html += ` title="${escapeHtml(f.title)}"`;
    html += `><option value="">${escapeHtml(f.ph || "")}</option>`;
    html += opts.map((o) =>
      `<option value="${escapeHtml(o)}"${o === vs ? " selected" : ""}>${escapeHtml(o)}</option>`).join("");
    return html + "</select>";
  }
  const type = f.type === "number" ? "number" : (f.type === "url" ? "url" : "text");
  let html = `<input type="${type}" class="${f.cls}" placeholder="${escapeHtml(f.ph || "")}" value="${escapeHtml(String(v))}"`;
  if (f.label) html += ` aria-label="${escapeHtml(f.label)}"`;
  if (f.type === "number") html += ` min="1800" max="2030"`;
  if (f.title) html += ` title="${escapeHtml(f.title)}"`;
  return html + ">";
}

// Ren HTML for én rads innhold (inputs + fjern-knapp). Ingen DOM — testbar.
export function rowInnerHtml(spec, values = {}) {
  // Tomt element med full bredde = linjeskift i en flex-rad med wrap. Eneste
  // måten å styre linjedeling per felt uten å gjøre raden om til grid.
  return spec.fields
    .map((f) => inputHtml(f, values) + (f.breakAfter ? `<span class="row-break" aria-hidden="true"></span>` : ""))
    .join("") +
    `<button type="button" class="btn ghost small ${spec.removeClass}" aria-label="${escapeHtml(spec.removeLabel || "Fjern rad")}">✕</button>`;
}

// Legg til én rad i `wrapEl` og koble fjern-knappen.
export function addRow(wrapEl, spec, values = {}) {
  const row = document.createElement("div");
  row.className = spec.rowClass;
  row.innerHTML = rowInnerHtml(spec, values);
  row.querySelector("." + spec.removeClass).addEventListener("click", () => row.remove());
  spec.kobleRad?.(row);
  wrapEl.appendChild(row);
  return row;
}

// Tøm `wrapEl` og bygg én rad per verdi (alltid minst én tom rad).
export function buildRows(wrapEl, spec, valuesList) {
  wrapEl.innerHTML = "";
  const list = (Array.isArray(valuesList) && valuesList.length) ? valuesList : [{}];
  list.forEach((v) => addRow(wrapEl, spec, v));
}

// Les radene tilbake til objekter. Number-felter tas kun med når gyldige;
// `always`-felter tas alltid med (selv tomme); resten kun når utfylt. Rader der
// keepKey er tom, droppes.
export function collectRows(wrapEl, spec) {
  return [...wrapEl.querySelectorAll("." + spec.rowClass)].map((r) => {
    const out = {};
    for (const f of spec.fields) {
      if (f.ui) continue;
      const v = r.querySelector("." + f.cls).value.trim();
      if (f.type === "number") {
        const n = parseInt(v, 10);
        if (Number.isFinite(n)) out[f.key] = n;
      } else if (f.always) {
        out[f.key] = v;
      } else if (v) {
        out[f.key] = v;
      }
    }
    return out;
  }).filter((o) => o[spec.keepKey]);
}

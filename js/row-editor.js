// ============================================================================
//  RAD-EDITOR — gjenbrukbare add/collect for verk, musikkeksempler og kilder
// ----------------------------------------------------------------------------
//  Samler tre tidligere identiske kopier (student-skjema, lærer-artistredigering
//  og tiårs-/sjangerbeskrivelser) til én spec-drevet implementasjon. Escaping er
//  innebygd, så prefylte verdier alltid er trygge (studentvarianten manglet det).
//  DOM-byggingen (addRow/buildRows) kjører kun i nettleser; rowInnerHtml er ren
//  og enhetstestbar. collectRows leser DOM.
// ============================================================================

import { escapeHtml } from "./util.js?v=3.20";

// Feltspesifikasjon: { key (objektnøkkel), cls (input-klasse), type, ph,
// label (aria-label for skjermlesere), title?,
// always? (ta med i output selv når tom — ellers kun hvis utfylt) }.
// removeLabel = aria-label på ✕-fjern-knappen.
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
    { key: "label", cls: "me-label", type: "text", ph: "Tittel (f.eks. «Hellhound on My Trail»)", label: "Tittel", always: true },
    { key: "year",  cls: "me-year",  type: "number", ph: "Årstall", label: "Årstall" },
    { key: "url",   cls: "me-url",   type: "url", ph: "https://youtube.com/…", label: "Lenke (https)", always: true },
    { key: "performanceYear", cls: "me-perf-year", type: "number", ph: "Framf.år", label: "Framføringsår", title: "Året for framføring/konsert (kun hvis annet enn utgivelsesår)" },
    { key: "note", cls: "me-note", type: "text", ph: "Hør etter … (valgfritt lytteanvisning)", label: "Hør etter", title: "Kort lytteanvisning: hva skal man legge merke til i akkurat denne innspillingen?" },
  ],
};

export const SOURCE_SPEC = {
  rowClass: "source-row", removeClass: "remove-source", keepKey: "text",
  removeLabel: "Fjern kilde",
  fields: [
    { key: "text", cls: "source-text", type: "text", ph: "F.eks. «Ward, Brian. Just My Soul Responding. 1998.»", label: "Kildetekst", always: true },
    { key: "url",  cls: "source-url",  type: "url", ph: "https://… (valgfritt)", label: "Lenke (https)", always: true },
  ],
};

function inputHtml(f, values) {
  const v = values[f.key] == null ? "" : values[f.key];
  const type = f.type === "number" ? "number" : (f.type === "url" ? "url" : "text");
  let html = `<input type="${type}" class="${f.cls}" placeholder="${escapeHtml(f.ph || "")}" value="${escapeHtml(String(v))}"`;
  if (f.label) html += ` aria-label="${escapeHtml(f.label)}"`;
  if (f.type === "number") html += ` min="1800" max="2030"`;
  if (f.title) html += ` title="${escapeHtml(f.title)}"`;
  return html + ">";
}

// Ren HTML for én rads innhold (inputs + fjern-knapp). Ingen DOM — testbar.
export function rowInnerHtml(spec, values = {}) {
  return spec.fields.map((f) => inputHtml(f, values)).join("") +
    `<button type="button" class="btn ghost small ${spec.removeClass}" aria-label="${escapeHtml(spec.removeLabel || "Fjern rad")}">✕</button>`;
}

// Legg til én rad i `wrapEl` og koble fjern-knappen.
export function addRow(wrapEl, spec, values = {}) {
  const row = document.createElement("div");
  row.className = spec.rowClass;
  row.innerHTML = rowInnerHtml(spec, values);
  row.querySelector("." + spec.removeClass).addEventListener("click", () => row.remove());
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

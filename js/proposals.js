// ============================================================================
//  ENDRINGSFORSLAG (studentside)
// ----------------------------------------------------------------------------
//  Generisk redigerer som lar studenter foreslå endringer på artister, tech,
//  sjangere/undersjangere og tiår-beskrivelser. Bygger et skjema dynamisk fra
//  feltspesifikasjoner, beregner differansen mot dagens verdier, og lagrer
//  forslaget via addPendingEdit. Også: åpning for å foreslå et helt nytt
//  innovasjonskort via addTechProposal.
// ============================================================================

import { addPendingEdit, addTechProposal } from "./store.js?v=4.17";
import { diffFields, escapeHtml, modalOpen, modalClose, TECH_CATEGORIES, TECH_TYPES } from "./ui.js?v=4.17";
import { ARTIST_FIELDS } from "./artist-schema.js?v=4.17";
import { GENDERS, INSTRUMENT_TIMELINE_GROUPS } from "./limits.js?v=4.17";
import { SOURCE_SPEC, addRow, buildRows, collectRows } from "./row-editor.js?v=4.17";

// Artistfeltene utledes fra det delte skjemaet (artist-schema.js).
// «complex»-felter (verk/musikkeksempler/kilder) har egne rad-editorer i
// hovedskjemaene og kan ikke foreslås her.
const ARTIST_PROPOSAL_SPECS = ARTIST_FIELDS
  .filter((f) => f.type !== "complex")
  .map((f) => {
    if (f.type === "gender") {
      return { ...f, type: "select", options: [{ value: "", label: "Velg…" }, ...GENDERS] };
    }
    if (f.type === "csv") {
      return { ...f, label: `${f.label} (kommaseparert)` };
    }
    return { ...f };
  });

const FIELD_SPECS = {
  artist: ARTIST_PROPOSAL_SPECS,
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
    { key: "decade", label: "Tiår (f.eks. 1950)", type: "text" },
    { key: "adoptedYear", label: "Innført år", type: "number" },
    { key: "adoptedLabel", label: "Årstall forklaring", type: "text" },
    { key: "description", label: "Beskrivelse", type: "textarea", full: true },
    { key: "kilder", label: "Kilder", type: "sources", full: true },
    { key: "imageUrl", label: "Bilde-URL", type: "text", full: true },
    { key: "imageCredit", label: "Bildekreditering", type: "text", full: true },
  ],
  subgenre: [
    { key: "description", label: "Beskrivelse", type: "textarea", full: true },
    { key: "activeFrom", label: "Mest aktiv fra år", type: "number" },
    { key: "activeTo", label: "Mest aktiv til år (tom = fortsatt aktiv)", type: "number" },
    { key: "kilder", label: "Kilder", type: "sources", full: true },
  ],
  instrument: [
    { key: "body", label: "Sammendrag av instrumentets utvikling", type: "textarea", full: true },
  ],
  "decade-society": [
    { key: "society", label: "Samfunnsutvikling", type: "textarea", full: true },
    { key: "societyMore", label: "Les mer (lengre tekst)", type: "textarea", full: true },
  ],
  "decade-tech": [
    { key: "tech", label: "Teknologiutvikling", type: "textarea", full: true },
    { key: "techMore", label: "Les mer (lengre tekst)", type: "textarea", full: true },
  ],
};

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
  if (spec.type === "textarea") {
    return `${labelHtml}<textarea id="${id}" rows="4">${escapeHtml(v)}</textarea></label>`;
  }
  if (spec.type === "select") {
    const opts = spec.options.map((o) =>
      `<option value="${escapeHtml(o.value)}"${o.value === v ? " selected" : ""}>${escapeHtml(o.label)}</option>`
    ).join("");
    return `${labelHtml}<select id="${id}">${opts}</select></label>`;
  }
  if (spec.type === "number") {
    return `${labelHtml}<input type="number" id="${id}" value="${escapeHtml(v)}" /></label>`;
  }
  if (spec.type === "csv") {
    const display = Array.isArray(v) ? v.join(", ") : (v || "");
    return `${labelHtml}<input type="text" id="${id}" value="${escapeHtml(display)}" /></label>`;
  }
  // «sources»: strukturerte kilder ({ text, url }) med samme rad-editor som
  // artistskjemaet, så en kilde kan bære lenke. Radene bygges etter innsetting
  // i DOM (fillSourceRows) — innerHTML her ville ikke fått med hendelsene.
  if (spec.type === "radio") {
    // Standard er første valg — et kort uten `type` ER en innovasjon.
    const valgt = spec.options.some((o) => o.value === v) ? v : spec.options[0].value;
    return `<div${fullClass}><span class="field-label">${escapeHtml(spec.label)}</span>` +
      `<div class="radio-row" id="${id}">` + spec.options.map((o) =>
        `<label class="radio-opt"><input type="radio" name="${id}" value="${escapeHtml(o.value)}"` +
        `${o.value === valgt ? " checked" : ""} /> ${escapeHtml(o.label)}</label>`
      ).join("") + `</div></div>`;
  }
  if (spec.type === "sources") {
    return `<div${fullClass}><span class="field-label">${escapeHtml(spec.label)}</span>` +
      `<div id="${id}"></div>` +
      `<button type="button" class="btn ghost small" data-add-src="${id}">+ Legg til kilde</button></div>`;
  }
  return `${labelHtml}<input type="text" id="${id}" value="${escapeHtml(v)}" /></label>`;
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
  if (spec.type === "sources") {
    return collectRows(el, SOURCE_SPEC).filter((k) => k.text);
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

// Kilde-radene må bygges ETTER at skjemaet står i DOM — rowInnerHtml kobler
// fjern-knappen per rad, og det overlever ikke en innerHTML-streng.
function fillSourceRows(specs, values) {
  for (const s of specs) {
    if (s.type !== "sources") continue;
    const wrap = document.getElementById(`prop-f-${s.key}`);
    if (!wrap) continue;
    const list = Array.isArray(values?.[s.key])
      // Eldre kort kan ha kilder som rene strenger — vis dem som kildetekst.
      ? values[s.key].map((k) => (typeof k === "string" ? { text: k } : k))
      : [];
    buildRows(wrap, SOURCE_SPEC, list);
  }
  document.querySelectorAll("#prop-form [data-add-src]").forEach((btn) => {
    btn.onclick = () => addRow(document.getElementById(btn.dataset.addSrc), SOURCE_SPEC, {});
  });
}

// Hoved-API: åpne redigereren for en eksisterende entitet.
// config = { entityType, entityId, entityName, currentValues }
export function openProposalEditor(config) {
  const modal = document.getElementById("modal-proposal");
  if (!modal) return;
  const specs = FIELD_SPECS[config.entityType];
  if (!specs) {
    console.warn("Ingen feltspesifikasjon for", config.entityType);
    return;
  }

  document.getElementById("prop-title").textContent =
    `${TITLES[config.entityType] || "Foreslå endring"} — ${config.entityName || ""}`;
  document.getElementById("prop-msg").textContent = "";
  document.getElementById("prop-by").value = "";

  const form = document.getElementById("prop-form");
  form.innerHTML = specs.map((s) => inputForField(s, config.currentValues?.[s.key])).join("");
  fillSourceRows(specs, config.currentValues || {});
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
    const diff = diffFields(config.currentValues || {}, proposed);
    const msg = document.getElementById("prop-msg");
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
      msg.className = "form-msg success";
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
    ? `Foreslå nytt instrumentkort — ${preset.instrument}`
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
  fillSourceRows(specs, preset || {});
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
      msg.className = "form-msg success";
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

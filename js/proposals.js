// ============================================================================
//  ENDRINGSFORSLAG (studentside)
// ----------------------------------------------------------------------------
//  Generisk redigerer som lar studenter foreslå endringer på artister, tech,
//  sjangere/undersjangere og tiår-beskrivelser. Bygger et skjema dynamisk fra
//  feltspesifikasjoner, beregner differansen mot dagens verdier, og lagrer
//  forslaget via addPendingEdit. Også: åpning for å foreslå et helt nytt
//  innovasjonskort via addTechProposal.
// ============================================================================

import { addPendingEdit, addTechProposal } from "./store.js?v=2.95";
import { diffFields, escapeHtml, modalOpen, modalClose } from "./ui.js?v=2.95";
import { ARTIST_FIELDS } from "./artist-schema.js?v=2.95";
import { GENDERS } from "./limits.js?v=2.95";

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
    { key: "name", label: "Navn", type: "text" },
    { key: "category", label: "Kategori", type: "select", options: [
      { value: "", label: "Velg…" },
      { value: "Opptak og avspilling", label: "Opptak og avspilling" },
      { value: "Kringkasting og spredning", label: "Kringkasting og spredning" },
      { value: "Instrumenter og lydutstyr", label: "Instrumenter og lydutstyr" },
    ] },
    { key: "decade", label: "Tiår (f.eks. 1950)", type: "text" },
    { key: "adoptedYear", label: "Innført år", type: "number" },
    { key: "adoptedLabel", label: "Tidsangivelse", type: "text" },
    { key: "description", label: "Beskrivelse", type: "textarea", full: true },
    { key: "imageUrl", label: "Bilde-URL", type: "text", full: true },
    { key: "imageCredit", label: "Bildekreditering", type: "text", full: true },
  ],
  subgenre: [
    { key: "description", label: "Beskrivelse", type: "textarea", full: true },
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
  return el.value.trim();
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

// Forslag om et helt nytt innovasjonskort. Bruker tom currentValues og lar
// alle felter være blanke.
export function openNewTechProposal() {
  const modal = document.getElementById("modal-proposal");
  if (!modal) return;
  const specs = FIELD_SPECS.tech;

  document.getElementById("prop-title").textContent = TITLES["new-tech"];
  document.getElementById("prop-msg").textContent = "";
  document.getElementById("prop-by").value = "";

  const form = document.getElementById("prop-form");
  form.innerHTML = specs.map((s) => inputForField(s, "")).join("");

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

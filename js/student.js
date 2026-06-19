// ============================================================================
//  STUDENTSIDE — foreslå artist, legg til info, se liste, stem
// ============================================================================

import {
  subscribeArtists,
  subscribeConfig,
  addArtist,
  getClientId,
} from "./store.js";
import { checkWarnings, GENDERS, DEFAULT_CONFIG } from "./limits.js";
import { fillSelect } from "./ui.js?v=166";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";

const state = {
  artists: [],
  config: null,
};

// ----------------------------------------------------------------------------
//  Render
// ----------------------------------------------------------------------------

function refreshControls() {
  const { config } = state;
  fillSelect($("#in-genre"), config.genres, { placeholder: "Velg sjanger …" });
  fillSelect($("#in-instrument"), config.instruments || [], { placeholder: "Velg instrument …" });
  fillSelect($("#in-gender"), GENDERS, { placeholder: "Velg kjønn …" });
}

// ----------------------------------------------------------------------------
//  Skjema
// ----------------------------------------------------------------------------

function setupForm() {
  const form = $("#add-form");
  const msg = $("#form-msg");

  $("#add-work").addEventListener("click", () => addWorkRow());
  $("#add-link").addEventListener("click", () => addLinkRow());
  $("#add-source").addEventListener("click", () => addSourceRow());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "form-msg";

    const candidate = {
      name: $("#in-name").value.trim(),
      birthYear: parseInt($("#in-birthyear").value, 10) || null,
      deathYear: parseInt($("#in-deathyear").value, 10) || null,
      gender: $("#in-gender").value,
      genre: $("#in-genre").value,
      instrument: $("#in-instrument").value,
      subgenres: $("#in-subgenres").value.split(",").map(s => s.trim()).filter(Boolean),
      influenceStart: parseInt($("#in-start").value, 10) || null,
      influenceEnd: parseInt($("#in-end").value, 10) || null,
      description: $("#in-desc").value.trim(),
      keyWorks: collectWorks(),
      geography: $("#in-geo").value.trim(),
      imageUrl: $("#in-image-url").value.trim(),
      imageCredit: $("#in-image-credit").value.trim(),
      proposedBy: $("#in-by").value.trim() || "Anonym",
      links: collectLinks(),
      kilder: collectSources(),
    };

    if (!candidate.name || !candidate.genre || !candidate.influenceStart || !candidate.gender) {
      return showMsg(msg, "Fyll inn navn, kjønn, sjanger og startår for innflytelse.", "error");
    }

    if (!CONFIGURED) {
      return showMsg(
        msg,
        "Firebase er ikke satt opp ennå (se README.md). Skjemaet validerer, men lagrer ikke ennå.",
        "error"
      );
    }

    const { warnings } = checkWarnings(state.artists, state.config, candidate);

    try {
      await addArtist(candidate);
      form.reset();
      resetWorkRows();
      resetLinkRows();
      resetSourceRows();
      const base = `«${candidate.name}» er lagt til i pensumforslagene ✓`;
      if (warnings.length) {
        showMsg(msg, `${base} NB: ${warnings.join(" ")}`, "warn");
      } else {
        showMsg(msg, base, "ok");
      }
    } catch (err) {
      showMsg(msg, "Noe gikk galt: " + err.message, "error");
    }
  });
}

function addLinkRow(label = "", url = "") {
  const wrap = $("#link-rows");
  const row = document.createElement("div");
  row.className = "link-row";
  row.innerHTML = `
    <input type="text" class="link-label" placeholder="Tittel (f.eks. «Hellhound on My Trail»)" value="${label}">
    <input type="url" class="link-url" placeholder="https://youtube.com/…" value="${url}">
    <button type="button" class="btn ghost small remove-link">✕</button>
  `;
  row.querySelector(".remove-link").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}
function resetLinkRows() {
  $("#link-rows").innerHTML = "";
  addLinkRow();
}
function collectLinks() {
  return [...document.querySelectorAll(".link-row")]
    .map((r) => ({
      label: r.querySelector(".link-label").value.trim(),
      url: r.querySelector(".link-url").value.trim(),
    }))
    .filter((l) => l.url);
}

function addWorkRow(title = "", year = "", url = "") {
  const wrap = $("#work-rows");
  const row = document.createElement("div");
  row.className = "work-row";
  row.innerHTML = `
    <input type="text" class="work-title" placeholder="Tittel (f.eks. «Cross Road Blues»)" value="${title}">
    <input type="number" class="work-year" placeholder="Årstall" min="1800" max="2030" value="${year}">
    <input type="url" class="work-url" placeholder="https://… (valgfritt)" value="${url}">
    <button type="button" class="btn ghost small remove-work">✕</button>
  `;
  row.querySelector(".remove-work").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}
function resetWorkRows() {
  $("#work-rows").innerHTML = "";
  addWorkRow();
}
function collectWorks() {
  return [...document.querySelectorAll("#work-rows .work-row")]
    .map((r) => {
      const title = r.querySelector(".work-title").value.trim();
      const yearStr = r.querySelector(".work-year").value.trim();
      const url = r.querySelector(".work-url").value.trim();
      const out = { title };
      const yr = parseInt(yearStr, 10);
      if (Number.isFinite(yr)) out.year = yr;
      if (url) out.url = url;
      return out;
    })
    .filter((w) => w.title);
}

function addSourceRow(text = "", url = "") {
  const wrap = $("#source-rows");
  const row = document.createElement("div");
  row.className = "source-row";
  row.innerHTML = `
    <input type="text" class="source-text" placeholder="F.eks. «Ward, Brian. Just My Soul Responding. 1998.»" value="${text}">
    <input type="url" class="source-url" placeholder="https://… (valgfritt)" value="${url}">
    <button type="button" class="btn ghost small remove-source">✕</button>
  `;
  row.querySelector(".remove-source").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}
function resetSourceRows() {
  $("#source-rows").innerHTML = "";
}
function collectSources() {
  return [...document.querySelectorAll("#source-rows .source-row")]
    .map((r) => ({
      text: r.querySelector(".source-text").value.trim(),
      url: r.querySelector(".source-url").value.trim(),
    }))
    .filter((k) => k.text);
}

// ----------------------------------------------------------------------------
//  Hjelpere + oppstart
// ----------------------------------------------------------------------------

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = "form-msg " + type;
}

function init() {
  setupForm();
  resetWorkRows();
  resetLinkRows();
  resetSourceRows();

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshControls();
    showSetupBanner("Du kan likevel se hvordan skjemaet ser ut.");
    return;
  }

  subscribeConfig((config) => {
    state.config = config;
    refreshControls();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
  });
}

init();

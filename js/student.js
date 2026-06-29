// ============================================================================
//  STUDENTSIDE — foreslå artist, legg til info, se liste, stem
// ============================================================================

import {
  subscribeArtists,
  subscribeConfig,
  addArtist,
  getClientId,
} from "./store.js?v=2.65";
import { checkWarnings, GENDERS, DEFAULT_CONFIG } from "./limits.js?v=2.65";
import { fillSelect } from "./ui.js?v=2.65";
import { CONFIGURED, $, showSetupBanner } from "./shared.js?v=2.65";

const state = {
  artists: [],
  config: null,
};

// ----------------------------------------------------------------------------
//  Render
// ----------------------------------------------------------------------------

function refreshControls() {
  const { config } = state;
  fillSelect($("#in-metaGenre"), config.metaGenres, { placeholder: "Velg metasjanger …" });
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
  $("#add-me").addEventListener("click", () => addMusicExampleRow());
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
      metaGenre: $("#in-metaGenre").value,
      instrument: $("#in-instrument").value,
      mainGenre: $("#in-mainGenre").value.split(",").map(s => s.trim()).filter(Boolean),
      subGenre: $("#in-subGenre").value.split(",").map(s => s.trim()).filter(Boolean),
      influenceStart: parseInt($("#in-start").value, 10) || null,
      influenceEnd: parseInt($("#in-end").value, 10) || null,
      description: $("#in-desc").value.trim(),
      keyWorks: collectWorks(),
      geography: $("#in-geo").value.trim(),
      imageUrl: $("#in-image-url").value.trim(),
      imageCredit: $("#in-image-credit").value.trim(),
      proposedBy: $("#in-by").value.trim() || "Anonym",
      musicExamples: collectMusicExamples(),
      kilder: collectSources(),
    };

    if (!candidate.name || !candidate.metaGenre || !candidate.influenceStart || !candidate.gender || !candidate.instrument) {
      return showMsg(msg, "Fyll inn navn, kjønn, sjanger, instrument og startår for innflytelse.", "error");
    }
    if (!candidate.kilder.length) {
      return showMsg(msg, "Legg til minst én kilde.", "error");
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
      resetMusicExampleRows();
      resetSourceRows();
      const base = `«${candidate.name}» er sendt inn og venter på godkjenning fra lærer`;
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

function addMusicExampleRow(label = "", url = "", year = "", perfYear = "") {
  const wrap = $("#me-rows");
  const row = document.createElement("div");
  row.className = "me-row";
  row.innerHTML = `
    <input type="text" class="me-label" placeholder="Tittel (f.eks. «Hellhound on My Trail»)" value="${label}">
    <input type="number" class="me-year" placeholder="Årstall" min="1800" max="2030" value="${year}">
    <input type="url" class="me-url" placeholder="https://youtube.com/…" value="${url}">
    <input type="number" class="me-perf-year" placeholder="Framf.år" min="1800" max="2030" value="${perfYear}" title="Året for framføring/konsert (kun hvis annet enn utgivelsesår)">
    <button type="button" class="btn ghost small remove-me">✕</button>
  `;
  row.querySelector(".remove-me").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}
function resetMusicExampleRows() {
  $("#me-rows").innerHTML = "";
  addMusicExampleRow();
}
function collectMusicExamples() {
  return [...document.querySelectorAll(".me-row")]
    .map((r) => {
      const label = r.querySelector(".me-label").value.trim();
      const url = r.querySelector(".me-url").value.trim();
      const yearStr = r.querySelector(".me-year").value.trim();
      const perfYearStr = r.querySelector(".me-perf-year").value.trim();
      const out = { label, url };
      const yr = parseInt(yearStr, 10);
      if (Number.isFinite(yr)) out.year = yr;
      const pyr = parseInt(perfYearStr, 10);
      if (Number.isFinite(pyr)) out.performanceYear = pyr;
      return out;
    })
    .filter((m) => m.url);
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
  resetMusicExampleRows();
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

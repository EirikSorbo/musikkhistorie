// ============================================================================
//  STUDENTSIDE — foreslå artist, legg til info, se liste, stem
// ============================================================================

import {
  subscribeArtists,
  subscribeConfig,
  addArtist,
  voteOut,
  undoVoteOut,
  getClientId,
} from "./store.js";
import { checkCanAdd, decadeFromYear, GENDERS, DEFAULT_CONFIG } from "./limits.js";
import { renderDashboard, renderLimits, renderArtists, fillSelect } from "./ui.js";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";

const state = {
  artists: [],
  config: null,
  filters: { genre: "", decade: "", search: "", showRemoved: false },
  isTeacher: false,
  clientId: getClientId(),
};

const handlers = {
  vote: (id) => voteOut(id, state.clientId, state.config.voteOutThreshold),
  undoVote: (id) => undoVoteOut(id, state.clientId),
};

// ----------------------------------------------------------------------------
//  Render
// ----------------------------------------------------------------------------

function renderAll() {
  if (!state.config) return;
  renderDashboard($("#dashboard"), state);
  renderLimits($("#limits"), state);
  renderList();
}
function renderList() {
  renderArtists($("#artist-list"), { ...state, handlers });
}

function refreshControls() {
  const { config } = state;
  fillSelect($("#f-genre"), config.genres, { placeholder: "Alle sjangre" });
  fillSelect(
    $("#f-decade"),
    config.decades.map((d) => ({ value: d, label: `${d}-tallet` })),
    { placeholder: "Alle tiår" }
  );
  fillSelect($("#in-genre"), config.genres, { placeholder: "Velg sjanger …" });
  fillSelect(
    $("#in-decade"),
    config.decades.map((d) => ({ value: d, label: `${d}-tallet` })),
    { placeholder: "Velg tiår …" }
  );
  fillSelect($("#in-gender"), GENDERS, { placeholder: "Velg kjønn …" });
}

// ----------------------------------------------------------------------------
//  Skjema
// ----------------------------------------------------------------------------

function setupForm() {
  const form = $("#add-form");
  const msg = $("#form-msg");

  $("#in-birthyear").addEventListener("change", (e) => {
    const year = parseInt(e.target.value, 10);
    const dec = decadeFromYear(year);
    if (dec && state.config.decades.includes(dec) && !$("#in-decade").value) {
      $("#in-decade").value = dec;
    }
  });

  $("#add-link").addEventListener("click", () => addLinkRow());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "form-msg";

    const candidate = {
      name: $("#in-name").value.trim(),
      birthYear: parseInt($("#in-birthyear").value, 10) || null,
      gender: $("#in-gender").value,
      genre: $("#in-genre").value,
      decade: parseInt($("#in-decade").value, 10),
      description: $("#in-desc").value.trim(),
      keyWorks: $("#in-works").value.trim(),
      geography: $("#in-geo").value.trim(),
      proposedBy: $("#in-by").value.trim() || "Anonym",
      links: collectLinks(),
    };

    if (!candidate.name || !candidate.genre || !candidate.decade || !candidate.gender) {
      return showMsg(msg, "Fyll inn navn, kjønn, sjanger og tiår.", "error");
    }

    const check = checkCanAdd(state.artists, state.config, candidate);
    if (!check.ok) return showMsg(msg, check.reasons.join(" "), "error");

    if (!CONFIGURED) {
      return showMsg(
        msg,
        "Firebase er ikke satt opp ennå (se README.md). Skjemaet validerer, men lagrer ikke ennå.",
        "error"
      );
    }

    try {
      await addArtist(candidate);
      form.reset();
      resetLinkRows();
      showMsg(msg, `«${candidate.name}» er lagt til i pensumforslagene ✓`, "ok");
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

// ----------------------------------------------------------------------------
//  Filtre
// ----------------------------------------------------------------------------

function setupFilters() {
  $("#f-genre").addEventListener("change", (e) => {
    state.filters.genre = e.target.value;
    renderList();
  });
  $("#f-decade").addEventListener("change", (e) => {
    state.filters.decade = e.target.value;
    renderList();
  });
  $("#f-search").addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    renderList();
  });
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
  setupFilters();
  resetLinkRows();

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshControls();
    renderAll();
    showSetupBanner("Du kan likevel se hvordan skjemaet og listen ser ut.");
    return;
  }

  subscribeConfig((config) => {
    state.config = config;
    refreshControls();
    renderAll();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    renderAll();
  });
}

init();

// ============================================================================
//  LÆRERSIDE — kodebeskyttet admin: veto, gjenopprett, slett, juster grenser
// ============================================================================

import {
  subscribeArtists,
  subscribeConfig,
  teacherRemove,
  teacherRestore,
  teacherDelete,
  updateConfig,
  getClientId,
  onAuthChange,
  signInWithGoogle,
  signOutTeacher,
} from "./store.js";
import { DEFAULT_CONFIG } from "./limits.js";
import { escapeHtml } from "./ui.js";
import { renderDashboard, renderLimits, renderArtists, fillSelect } from "./ui.js";
import { TEACHER_EMAILS } from "./firebase-config.js";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";

const state = {
  artists: [],
  config: null,
  filters: { genre: "", decade: "", instrument: "", search: "", showRemoved: true },
  isTeacher: true, // alt på denne siden er lærer
  clientId: getClientId(),
  started: false,
};

const handlers = {
  remove: (id) => teacherRemove(id),
  restore: (id) => teacherRestore(id),
  del: (id) => {
    if (confirm("Slette dette forslaget permanent?")) teacherDelete(id);
  },
};

// ----------------------------------------------------------------------------
//  Innlogging (Google / Firebase Auth)
// ----------------------------------------------------------------------------

let signedInNotTeacher = false;

function setupGate() {
  const msg = $("#gate-msg");
  const signinBtn = $("#google-signin");

  signinBtn.addEventListener("click", () => {
    // Hvis innlogget med feil konto: logg ut så man kan velge en annen
    if (signedInNotTeacher) {
      signOutTeacher();
      return;
    }
    signInWithGoogle().catch((e) => {
      if (e.code !== "auth/popup-closed-by-user") {
        msg.textContent = "Innlogging mislyktes: " + e.message;
      }
    });
  });

  $("#logout").addEventListener("click", () => signOutTeacher());

  // Reagerer på innlogging/utlogging (og husker innlogging mellom besøk)
  onAuthChange((user) => {
    if (user && TEACHER_EMAILS.includes(user.email)) {
      signedInNotTeacher = false;
      msg.textContent = "";
      document.body.classList.add("is-teacher");
      if (!state.started) startApp();
    } else if (user) {
      // Innlogget, men ikke en godkjent lærerkonto
      signedInNotTeacher = true;
      document.body.classList.remove("is-teacher");
      msg.textContent = `Kontoen ${user.email} har ikke lærertilgang.`;
      signinBtn.textContent = "Logg ut og prøv en annen konto";
    } else {
      signedInNotTeacher = false;
      document.body.classList.remove("is-teacher");
      msg.textContent = "";
      signinBtn.textContent = "Logg inn med Google";
    }
  });
}

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
  fillSelect($("#f-instrument"), config.instruments || [], { placeholder: "Alle instrumenter" });
}

// ----------------------------------------------------------------------------
//  Filtre + adminskjema
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
  $("#f-instrument").addEventListener("change", (e) => {
    state.filters.instrument = e.target.value;
    renderList();
  });
  $("#f-search").addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    renderList();
  });
  const showRemoved = $("#f-show-removed");
  showRemoved.checked = state.filters.showRemoved;
  showRemoved.addEventListener("change", (e) => {
    state.filters.showRemoved = e.target.checked;
    renderList();
  });
}

function setupAdmin() {
  // Bygg per-tiår/per-sjanger-feltene på nytt når listene eller standardene endres
  ["#cfg-decades", "#cfg-genres", "#cfg-instruments", "#cfg-decade", "#cfg-genre", "#cfg-instrument"].forEach((sel) =>
    $(sel).addEventListener("input", buildLimitInputs)
  );

  $("#admin-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const config = {
      maxTotal: int($("#cfg-total").value, state.config.maxTotal),
      maxPerDecade: int($("#cfg-decade").value, state.config.maxPerDecade),
      maxPerGenre: int($("#cfg-genre").value, state.config.maxPerGenre),
      maxPerInstrument: int($("#cfg-instrument").value, state.config.maxPerInstrument),
      voteOutThreshold: int($("#cfg-threshold").value, state.config.voteOutThreshold),
      genres: splitList($("#cfg-genres").value, state.config.genres),
      instruments: splitList($("#cfg-instruments").value, state.config.instruments || []),
      decades: splitList($("#cfg-decades").value, state.config.decades).map(Number),
      decadeLimits: collectLimitMap("#decade-limits", "data-decade"),
      genreLimits: collectLimitMap("#genre-limits", "data-genre"),
      instrumentLimits: collectLimitMap("#instrument-limits", "data-instrument"),
    };
    if (!CONFIGURED) {
      $("#admin-msg").textContent = "Firebase ikke koblet til – lagres ikke.";
      return;
    }
    await updateConfig(config);
    $("#admin-msg").textContent = "Grenser lagret ✓";
    setTimeout(() => ($("#admin-msg").textContent = ""), 2500);
  });
}

function fillAdminForm() {
  const c = state.config;
  $("#cfg-total").value = c.maxTotal;
  $("#cfg-decade").value = c.maxPerDecade;
  $("#cfg-genre").value = c.maxPerGenre;
  $("#cfg-instrument").value = c.maxPerInstrument;
  $("#cfg-threshold").value = c.voteOutThreshold;
  $("#cfg-genres").value = c.genres.join(", ");
  $("#cfg-instruments").value = (c.instruments || []).join(", ");
  $("#cfg-decades").value = c.decades.join(", ");
  buildLimitInputs();
}

// Bygger ett tallfelt per tiår og per sjanger. Tomt felt = standardverdien.
function buildLimitInputs() {
  const decades = splitList($("#cfg-decades").value, state.config.decades).map(Number);
  const genres = splitList($("#cfg-genres").value, state.config.genres);
  const instruments = splitList($("#cfg-instruments").value, state.config.instruments || []);
  const defDecade = int($("#cfg-decade").value, state.config.maxPerDecade);
  const defGenre = int($("#cfg-genre").value, state.config.maxPerGenre);
  const defInstrument = int($("#cfg-instrument").value, state.config.maxPerInstrument);

  renderLimitInputs(
    $("#decade-limits"),
    "data-decade",
    decades.map((d) => ({
      key: d,
      label: `${d}-tallet`,
      explicit: state.config.decadeLimits?.[d],
    })),
    defDecade
  );
  renderLimitInputs(
    $("#genre-limits"),
    "data-genre",
    genres.map((g) => ({
      key: g,
      label: g,
      explicit: state.config.genreLimits?.[g],
    })),
    defGenre
  );
  renderLimitInputs(
    $("#instrument-limits"),
    "data-instrument",
    instruments.map((i) => ({
      key: i,
      label: i,
      explicit: state.config.instrumentLimits?.[i],
    })),
    defInstrument
  );
}

function renderLimitInputs(container, attr, items, placeholder) {
  // Bevar verdier brukeren allerede har tastet inn ved ombygging
  const prev = {};
  container.querySelectorAll("input").forEach((inp) => {
    if (inp.value !== "") prev[inp.getAttribute(attr)] = inp.value;
  });

  container.innerHTML = items
    .map((it) => {
      const stored = Number.isFinite(it.explicit) ? it.explicit : "";
      const value = prev[it.key] ?? stored;
      return `
        <label class="limit-input">
          <span>${escapeHtml(it.label)}</span>
          <input type="number" min="1" ${attr}="${escapeHtml(it.key)}"
                 placeholder="${placeholder}" value="${value}">
        </label>`;
    })
    .join("");
}

// Samler tallfeltene til et kart { nøkkel: antall }. Tomme felt utelates.
function collectLimitMap(containerSel, attr) {
  const map = {};
  $(containerSel)
    .querySelectorAll(`input[${attr}]`)
    .forEach((inp) => {
      const key = inp.getAttribute(attr);
      const val = parseInt(inp.value, 10);
      if (Number.isFinite(val) && val >= 1) map[key] = val;
    });
  return map;
}

// ----------------------------------------------------------------------------
//  Hjelpere + oppstart
// ----------------------------------------------------------------------------

function int(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
function splitList(v, fallback) {
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : fallback;
}

// Starter datalytting først når læreren er logget inn
function startApp() {
  state.started = true;
  setupFilters();
  setupAdmin();

  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    refreshControls();
    fillAdminForm();
    renderAll();
    showSetupBanner();
    return;
  }

  subscribeConfig((config) => {
    state.config = config;
    refreshControls();
    fillAdminForm();
    renderAll();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    renderAll();
  });
}

setupGate();

// ============================================================================
//  FORSIDE — live oversikt + inngang til student-/lærerside
// ============================================================================

import { subscribeArtists, subscribeConfig } from "./store.js";
import { DEFAULT_CONFIG } from "./limits.js";
import { renderDashboard, renderLimits } from "./ui.js";
import { CONFIGURED, $, showSetupBanner } from "./shared.js";

const state = { artists: [], config: null };

function renderAll() {
  if (!state.config) return;
  renderDashboard($("#dashboard"), state);
  renderLimits($("#limits"), state);
}

function init() {
  if (!CONFIGURED) {
    state.config = { ...DEFAULT_CONFIG };
    renderAll();
    showSetupBanner();
    return;
  }
  subscribeConfig((config) => {
    state.config = config;
    renderAll();
  });
  subscribeArtists((artists) => {
    state.artists = artists;
    renderAll();
  });
}

init();

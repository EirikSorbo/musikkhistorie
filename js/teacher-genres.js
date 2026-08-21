// ============================================================================
//  LÆRER — SJANGERTRE-EDITOR
// ----------------------------------------------------------------------------
//  Her legger læreren inn, endrer og fjerner sjangre og metasjangre. Treet bor i
//  content/genealogy (fase 1), og layouten regnes ut (fase 2), så det finnes
//  ingen koordinater å pusle med: man sier hvilken metasjanger sjangeren hører
//  til, hvilket tiår den preget og hvem den vokste ut av, så plasserer kartet
//  den selv.
//
//  DET VIKTIGE SKILLET, og grunnen til at fila er bygget som den er:
//
//    TRYGGE endringer  — fullt navn, epoke, metasjanger, rad, foreldre, farge,
//                        og det å legge til en helt ny sjanger. Ingen andre
//                        peker på dem. De skrives rett.
//
//    IDENTITETSbytter  — å endre ETIKETTEN, eller å slette. Etiketten er
//                        dokument-ID i genreDescriptions og står som tagg på
//                        artister, i varmekartet, i avkryssinger og i åpne
//                        forslag. Slike endringer går ALLTID gjennom
//                        js/genre-migrate.js: den planlegger, læreren ser hva
//                        som skjer, og alt skrives i ÉN atomisk batch.
//
//  Node-ID-en kan ikke endres i det hele tatt. edgeDescriptions har «fra__til»
//  som dokument-ID, og et id-bytte ville gjort alle koblingsbeskrivelsene
//  foreldreløse.
// ============================================================================

import { $ } from "./shared.js?v=4.60";
import { escapeHtml } from "./util.js?v=4.60";
import { modalOpen, modalClose } from "./ui.js?v=4.60";
import { state, guardTeacherAction } from "./teacher-state.js?v=4.60";
import { GENEALOGY, META_GENRES, DECADE_ROWS, FAMILIES } from "./genre-model.js?v=4.60";
import { validateTree } from "./genre-validate.js?v=4.60";
import {
  planGenreRename, planMetaRename, planGenreDelete, planTreeUpdate,
  findReferences, planPasserIBatch,
} from "./genre-migrate.js?v=4.60";
import { runMigrationPlan, saveGenealogyTree } from "./store.js?v=4.60";

// Treet slik det ser ut nå. Leses fra det delte state-objektet, aldri fra en
// lokal kopi — læreren kan ha to faner åpne.
const tre = () => state.content?.genealogy || null;

// Sidens state-objekt i den formen genre-migrate forventer.
const migrasjonsState = () => ({
  tree: tre(),
  artists: state.artists || [],
  genreDescs: state.genreDescs || {},
  edgeDescs: state.edgeDescs || {},
  content: state.content || {},
  teacherChecks: state.teacherChecks || {},
  pendingEdits: state.pendingEdits || [],
});

// ----------------------------------------------------------------------------
//  Markup
// ----------------------------------------------------------------------------
export const GENRE_ADMIN_HTML = `
<div class="modal-backdrop" id="modal-genre-admin">
  <div class="modal modal-wide">
    <div class="modal-head">
      <h2>Sjangertreet</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <p class="muted" style="margin:0 0 12px">
      Legg inn, endre eller fjern sjangre. Plasseringen i kartet regnes ut av metasjanger,
      tiår og slektskap, så du trenger ikke tenke på koordinater.
    </p>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <button class="btn primary small" id="gen-ny-sjanger">Ny sjanger</button>
      <button class="btn ghost small" id="gen-ny-meta">Ny metasjanger</button>
    </div>
    <div id="gen-liste"></div>
  </div>
</div>

<div class="modal-backdrop" id="modal-genre-edit">
  <div class="modal">
    <div class="modal-head">
      <h2 id="gen-edit-title">Sjanger</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="gen-edit-body"></div>
    <p id="gen-edit-msg" class="form-msg"></p>
    <div class="modal-foot-right" style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn ghost small" id="gen-edit-slett">Slett</button>
      <button class="btn primary small" id="gen-edit-lagre">Lagre</button>
    </div>
  </div>
</div>

<div class="modal-backdrop" id="modal-genre-plan">
  <div class="modal">
    <div class="modal-head">
      <h2 id="gen-plan-title">Bekreft endringen</h2>
      <button class="modal-close btn ghost small">✕</button>
    </div>
    <div id="gen-plan-body"></div>
    <div class="modal-foot-right" style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn ghost small" id="gen-plan-avbryt">Avbryt</button>
      <button class="btn primary small" id="gen-plan-utfor">Utfør</button>
    </div>
  </div>
</div>`;

// ----------------------------------------------------------------------------
//  Lista
// ----------------------------------------------------------------------------
export function openGenreAdmin() {
  renderListe();
  modalOpen($("#modal-genre-admin"));
}

function renderListe() {
  const el = $("#gen-liste");
  if (!el) return;
  const t = tre();
  if (!t?.nodes?.length) {
    el.innerHTML = `<p class="gx-missing">Sjangertreet er ikke lastet inn. Importer Innholdspakka først.</p>`;
    return;
  }
  const metaer = [...(t.metaGenres || [])].sort((a, b) => (a.column ?? 0) - (b.column ?? 0));
  const uten = t.nodes.filter((n) => !n.g);

  let h = "";
  for (const m of metaer) {
    const egne = t.nodes.filter((n) => n.g === m.name).sort((a, b) => a.r - b.r);
    h += `<div class="gen-gruppe">
      <div class="gen-gruppe-head">
        <span class="gen-dot" style="background:${escapeHtml(m.color || FAMILIES[m.fam]?.stroke || "#999")}"></span>
        <strong>${escapeHtml(m.name)}</strong>
        <span class="muted">${egne.length} sjangre</span>
        <button class="btn ghost small gen-meta-rediger" data-meta="${escapeHtml(m.name)}">Rediger</button>
      </div>
      <div class="gen-rader">${egne.map(radHtml).join("") || `<p class="muted">Ingen sjangre ennå.</p>`}</div>
    </div>`;
  }
  if (uten.length) {
    h += `<div class="gen-gruppe">
      <div class="gen-gruppe-head"><span class="gen-dot" style="background:#9bada1"></span>
        <strong>Røtter</strong><span class="muted">${uten.length} noder, uten metasjanger</span></div>
      <div class="gen-rader">${uten.sort((a, b) => a.r - b.r).map(radHtml).join("")}</div>
    </div>`;
  }
  el.innerHTML = h;
}

function radHtml(n) {
  const tiar = DECADE_ROWS[Math.floor(n.r)] || `rad ${n.r}`;
  const antall = (state.artists || []).filter((a) =>
    (a.mainGenre || []).some((g) => String(g).toLowerCase() === String(n.l).toLowerCase())).length;
  return `<button class="gen-rad" data-node="${escapeHtml(n.id)}">
    <span class="gen-rad-navn">${escapeHtml(n.l)}</span>
    <span class="muted">${escapeHtml(tiar)}</span>
    <span class="muted">${antall} artist(er)</span>
  </button>`;
}

// ----------------------------------------------------------------------------
//  Skjemaet for én node
// ----------------------------------------------------------------------------
let redigerer = null;         // node-id, eller null for ny

function openNodeEditor(nodeId) {
  const t = tre();
  if (!t) return;
  redigerer = nodeId;
  const n = nodeId ? t.nodes.find((x) => x.id === nodeId) : null;
  $("#gen-edit-title").textContent = n ? n.l : "Ny sjanger";
  $("#gen-edit-msg").textContent = "";
  $("#gen-edit-slett").style.display = n ? "" : "none";

  const andre = t.nodes.filter((x) => x.id !== nodeId).sort((a, b) => a.r - b.r || a.l.localeCompare(b.l, "no"));
  const metaValg = (t.metaGenres || []).map((m) =>
    `<option value="${escapeHtml(m.name)}"${n?.g === m.name ? " selected" : ""}>${escapeHtml(m.name)}</option>`).join("");
  const radValg = DECADE_ROWS.map((etikett, i) =>
    `<option value="${i}"${Math.floor(n?.r ?? 6) === i ? " selected" : ""}>${escapeHtml(etikett)}</option>`).join("");
  const famValg = Object.entries(FAMILIES).map(([k, v]) =>
    `<option value="${escapeHtml(k)}"${n?.fam === k ? " selected" : ""}>${escapeHtml(v.label || k)}</option>`).join("");

  const kryss = (felt, valgte) => andre.map((x) => `
    <label class="gen-kryss"><input type="checkbox" data-${felt}="${escapeHtml(x.id)}"${(valgte || []).includes(x.id) ? " checked" : ""}>
      ${escapeHtml(x.l)}</label>`).join("");

  $("#gen-edit-body").innerHTML = `
    <div class="form-grid">
      <label>Etikett (kort navn i kartet)
        <input type="text" id="gen-l" value="${escapeHtml(n?.l || "")}" maxlength="60">
      </label>
      <label>Fullt navn
        <input type="text" id="gen-f" value="${escapeHtml(n?.f || "")}" maxlength="120">
      </label>
      <label>Metasjanger
        <select id="gen-g"><option value="">(rot — ingen metasjanger)</option>${metaValg}</select>
      </label>
      <label>Tiår
        <select id="gen-r">${radValg}</select>
      </label>
      <label>Epoke (fritekst)
        <input type="text" id="gen-era" value="${escapeHtml(n?.era || "")}" maxlength="60">
      </label>
      <label>Egen farge (unntak)
        <select id="gen-fam"><option value="">(arv fra metasjangeren)</option>${famValg}</select>
      </label>
    </div>
    ${n ? `<p class="muted" style="margin:10px 0 4px">ID: <code>${escapeHtml(n.id)}</code> — kan ikke endres, koblingsbeskrivelsene henger i den.</p>` : ""}
    <details style="margin-top:10px"${n ? "" : " open"}>
      <summary>Vokste ut av (foreldre)</summary>
      <div class="gen-kryss-liste">${kryss("p", n?.p)}</div>
    </details>
    <details style="margin-top:8px">
      <summary>Motreaksjon mot</summary>
      <div class="gen-kryss-liste">${kryss("rx", n?.rx)}</div>
    </details>`;
  modalOpen($("#modal-genre-edit"));
}

// Leser skjemaet og bygger den nye noden.
function lesSkjema() {
  const valgte = (felt) => [...document.querySelectorAll(`#gen-edit-body [data-${felt}]`)]
    .filter((i) => i.checked).map((i) => i.dataset[felt]);
  const l = $("#gen-l").value.trim();
  return {
    l,
    f: $("#gen-f").value.trim() || l,
    g: $("#gen-g").value || null,
    r: Number($("#gen-r").value),
    era: $("#gen-era").value.trim(),
    fam: $("#gen-fam").value || undefined,
    p: valgte("p"),
    rx: valgte("rx"),
  };
}

// Lager en id fra etiketten for NYE noder. Bare små bokstaver og tall, så den
// er trygg som del av en edgeDescriptions-nøkkel («fra__til»).
function lagId(l, finnes) {
  const rot = l.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "").slice(0, 24) || "sjanger";
  let id = rot, i = 2;
  while (finnes.has(id)) id = rot + i++;
  return id;
}

async function lagre() {
  const t = tre();
  const msg = $("#gen-edit-msg");
  const felt = lesSkjema();
  if (!felt.l) { msg.textContent = "Etiketten kan ikke være tom."; return; }

  const gammel = redigerer ? t.nodes.find((n) => n.id === redigerer) : null;
  const navnEndret = gammel && gammel.l !== felt.l;

  // 1) Bygg det nye treet med ALT unntatt etiketten (den går via migreringen).
  const nyNode = gammel
    ? { ...gammel, ...felt, l: gammel.l }
    : { id: lagId(felt.l, new Set(t.nodes.map((n) => n.id))), ...felt };
  if (!nyNode.fam) delete nyNode.fam;
  if (!nyNode.era) delete nyNode.era;
  if (!nyNode.rx?.length) delete nyNode.rx;

  const nyttTre = {
    ...t,
    nodes: gammel
      ? t.nodes.map((n) => (n.id === gammel.id ? nyNode : n))
      : [...t.nodes, nyNode],
  };

  const problemer = validateTree(nyttTre).filter((p) => p.nivå === "feil");
  if (problemer.length) {
    msg.textContent = problemer[0].melding;
    return;
  }

  await guardTeacherAction(saveGenealogyTree(nyttTre));

  // 2) Etiketten sist, som en egen migrering — den flytter identiteter.
  if (navnEndret) {
    const s = migrasjonsState();
    s.tree = nyttTre;
    const plan = planGenreRename(s, gammel.l, felt.l);
    modalClose($("#modal-genre-edit"));
    visPlan(`Endre navn: «${gammel.l}» → «${felt.l}»`, plan);
    return;
  }

  modalClose($("#modal-genre-edit"));
  renderListe();
}

async function slett() {
  const t = tre();
  const n = t.nodes.find((x) => x.id === redigerer);
  if (!n) return;
  const plan = planGenreDelete(migrasjonsState(), n.l);
  modalClose($("#modal-genre-edit"));
  visPlan(`Slette «${n.l}»`, plan);
}

// ----------------------------------------------------------------------------
//  Plan-visningen — læreren ser konsekvensen FØR noe skrives
// ----------------------------------------------------------------------------
let ventendePlan = null;

function visPlan(tittel, plan) {
  ventendePlan = plan;
  $("#gen-plan-title").textContent = tittel;
  const body = $("#gen-plan-body");
  const utfor = $("#gen-plan-utfor");

  if (plan.feil?.length) {
    body.innerHTML = `<p class="gx-missing">Kan ikke gjennomføres:</p><ul>${
      plan.feil.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`;
    utfor.style.display = "none";
  } else if (plan.blokkeringer?.length) {
    body.innerHTML = `<p class="gx-missing">Dette må ryddes først:</p>` +
      plan.blokkeringer.map((b) => `
        <div class="gen-blokk">
          <p><strong>${escapeHtml(b.hva)}</strong></p>
          <p class="muted">${escapeHtml(b.losning)}</p>
          ${b.detaljer?.length ? `<p class="muted">${escapeHtml(b.detaljer.join(", "))}${b.detaljer.length >= 12 ? " …" : ""}</p>` : ""}
        </div>`).join("");
    utfor.style.display = "none";
  } else if (!planPasserIBatch(plan)) {
    body.innerHTML = `<p class="gx-missing">Endringen krever ${plan.ops.length} skrivinger, mer enn Firestore tar i én atomisk operasjon (500). Del den i mindre steg.</p>`;
    utfor.style.display = "none";
  } else {
    body.innerHTML = `
      <p>Dette skrives i én operasjon — enten alt, eller ingenting:</p>
      <ul>${plan.ops.map((o) => `<li>${escapeHtml(o.hva)}</li>`).join("")}</ul>
      ${plan.advarsler?.length ? `<p class="muted"><strong>Merk:</strong></p><ul class="muted">${
        plan.advarsler.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>` : ""}`;
    utfor.style.display = "";
  }
  modalOpen($("#modal-genre-plan"));
}

async function utforPlan() {
  if (!ventendePlan?.ops?.length) return;
  const knapp = $("#gen-plan-utfor");
  knapp.disabled = true;
  knapp.textContent = "Utfører …";
  await guardTeacherAction(runMigrationPlan(ventendePlan.ops));
  knapp.disabled = false;
  knapp.textContent = "Utfør";
  ventendePlan = null;
  modalClose($("#modal-genre-plan"));
  renderListe();
}

// ----------------------------------------------------------------------------
//  Metasjanger
// ----------------------------------------------------------------------------
function openMetaEditor(navn) {
  const t = tre();
  const m = (t.metaGenres || []).find((x) => x.name === navn);
  if (!m) return;
  const nytt = prompt(`Nytt navn på metasjangeren «${navn}»?\n\nAlle sjangrene i den, artistenes metaGenre-tagg, beskrivelsen og sjangerhistorien følger med.`, navn);
  if (nytt == null || nytt.trim() === navn) return;
  visPlan(`Endre metasjanger: «${navn}» → «${nytt.trim()}»`, planMetaRename(migrasjonsState(), navn, nytt.trim()));
}

async function nyMeta() {
  const t = tre();
  const navn = prompt("Navn på den nye metasjangeren?");
  if (!navn?.trim()) return;
  const rent = navn.trim();
  if ((t.metaGenres || []).some((m) => m.name.toLowerCase() === rent.toLowerCase())) {
    alert("Den metasjangeren finnes allerede.");
    return;
  }
  const nyttTre = {
    ...t,
    metaGenres: [...(t.metaGenres || []), {
      name: rent,
      order: (t.metaGenres || []).length,
      column: (t.metaGenres || []).length,
      fam: "gray",
    }],
  };
  await guardTeacherAction(saveGenealogyTree(nyttTre));
  renderListe();
}

// ----------------------------------------------------------------------------
//  Oppkobling (kalles én gang ved oppstart)
// ----------------------------------------------------------------------------
export function setupGenreAdmin() {
  $("#gen-ny-sjanger")?.addEventListener("click", () => openNodeEditor(null));
  $("#gen-ny-meta")?.addEventListener("click", nyMeta);
  $("#gen-edit-lagre")?.addEventListener("click", () => lagre());
  $("#gen-edit-slett")?.addEventListener("click", () => slett());
  $("#gen-plan-utfor")?.addEventListener("click", utforPlan);
  $("#gen-plan-avbryt")?.addEventListener("click", () => { ventendePlan = null; modalClose($("#modal-genre-plan")); });

  // Delegert: lista bygges på nytt ved hver endring.
  $("#gen-liste")?.addEventListener("click", (e) => {
    const rad = e.target.closest("[data-node]");
    if (rad) { openNodeEditor(rad.dataset.node); return; }
    const meta = e.target.closest("[data-meta]");
    if (meta) openMetaEditor(meta.dataset.meta);
  });
}

// Kalles når treet endres utenfra (snapshot), så en åpen liste er fersk.
export function refreshGenreAdmin() {
  if ($("#modal-genre-admin")?.classList.contains("open")) renderListe();
}

// Eksponert for oversikten: hvor mange peker på denne sjangeren?
export { findReferences };

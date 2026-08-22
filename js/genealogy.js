// ============================================================================
//  SJANGER- OG KOBLINGSKORTENE
// ----------------------------------------------------------------------------
//  Popupene som viser én sjanger (#modal-sjanger) og én kobling mellom to
//  sjangre. Delt av ALLE innganger: node- og båndklikk i slektstreet,
//  sjanger-chips på artistkortene, lærerens oversikt. Én kilde, så kortet ser
//  likt ut uansett hvor det åpnes fra.
//
//  Fila tegnet tidligere også selve kartet («Carta» i musicmap-stil, med
//  håndsatte koordinater). Det er pensjonert i v4.55: treet tegnes nå av
//  js/genealogy-bundled.js med utregnet layout, fordi håndsatte koordinater
//  ikke kunne overleve at treet ble redigerbart for lærere.
// ============================================================================

import { wireAllLinks } from "./linkify.js?v=4.69";
import { renderRichText } from "./rich-text.js?v=4.69";
import { escapeHtml, buildKilderList } from "./util.js?v=4.69";
import { resolveDesc, resolveDescAny, missingDesc } from "./genre-descriptions.js?v=4.69";
import { modalOpen } from "./ui-modal.js?v=4.69";
import { renderGenreEditBtn } from "./ui-helpers.js?v=4.69";
import { wireProposeFoot } from "./ui-edit.js?v=4.69";
import { heatRow, heatStripHtml, heatAxisHtml, getHeatData } from "./heat-strip.js?v=4.69";
import { GENEALOGY, edgeKey, nodeColor } from "./genre-model.js?v=4.69";

// Main-beskrivelsen for en tre-sjanger. ÉN kilde, delt av visningen
// (showSjangerInfo under) og lærerens editor (teacher-content.js
// openSingleSubgenreModal) — de MÅ lese samme dokument.
//
// Oppslaget prøver både nodens label (l) og fulle navn (f), fordi 18 av 48
// noder har l≠f og eldre tekster kan ligge under fullnavnet. Skrivingen bruker
// derimot ALLTID labelen — den er doc-ID-en i genreDescriptions. Leste de to
// ulikt, ville editoren åpnet tom over en tekst som vises i popupen, og lagring
// ville lagd et duplikat under labelen.
// Epoke-linja øverst på sjangerkortet. Sannheten er de STRUKTURERTE årstallene
// (activeFrom/activeTo), som læreren kan rette og appen kan måle mot varmekartet.
// Fritekst-epoken er fallback for sjangre som ennå ikke har årstall.
//
// BEGGE kommer nå fra genreDescriptions (v4.64). Fram til da lå fritekst-epoken
// på treets node, og det gjorde at kortet og tidslinjen kunne vise ULIK epoke
// for samme sjanger: kortet leste årstallene, tidslinjen leste nodens era.
// Tomt sluttår betyr «fortsatt aktiv», ikke «ukjent»: en sjanger som lever i
// dag skal lese «1990–i dag», ikke stå med en åpen strek.
export function eraText(resolved) {
  const from = resolved?.activeFrom, to = resolved?.activeTo;
  if (Number.isInteger(from)) return `${from}–${Number.isInteger(to) ? to : "i dag"}`;
  return resolved?.era || "";
}

// Kuraterte lytteforslag for sjangeren. Sto som `t` på treets noder fram til
// v4.64 uten at noe leste dem — rundt 100 forfattede eksempler var usynlige.
// De er FRI TEKST («Cross Road Blues – Robert Johnson (1937)»), ikke lenker til
// artistkort: artistenes musicExamples er en annen ting, knyttet til kortet og
// til spillelistene.
function lyttHtml(lytt) {
  if (!lytt?.length) return "";
  return `<div class="gx-lytt">
    <p class="gx-lytt-head">Hør etter</p>
    <ul>${lytt.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
  </div>`;
}

export function resolveMainDesc(genreDescs, genreId) {
  const n = GENEALOGY.find((x) => x.l === genreId || x.f === genreId);
  return n
    ? resolveDescAny(genreDescs, [n.l, n.f], "main")
    : resolveDesc(genreDescs, genreId, "main");
}

// Varmelinja øverst på sjangerkortet: samme glidende stripe som i varmekartet,
// med tiårene over — så man ser sjangerens tyngdepunkt gjennom historien før man
// leser et eneste ord. Fargen følger ARVEREGELEN (nodeColor): metasjangeren
// eier fargen, noden bærer bare fam som unntak. Å lese n.fam rått ga grå
// stripe for 44 av 46 sjangre, mens varmekartet viste familiefargen.
//
// Vises kun for ekte tre-sjangre (n.g) og kun når nivåene faktisk er lastet:
// tre.html laster ikke innhold i det hele tatt, og da er en tom grå linje verre
// enn ingen linje. Er nivåene lastet, men sjangeren mangler rad, står stripa
// som «ingen data» med en forklarende linje under — samme sannhet som
// varmekartet forteller.
function heatStripBlock(n) {
  const heat = getHeatData();
  if (!n.g || !heat) return "";
  const vals = heatRow(heat, n.l);
  const color = nodeColor(n);
  const tom = vals.every((v) => v == null);
  return `<div class="gx-heat">${heatAxisHtml()}${heatStripHtml(color, vals)}` +
    (tom ? `<p class="gx-heat-missing">Ingen varmekart-nivåer for denne sjangeren ennå.</p>` : "") +
    `</div>`;
}

// Vis sjanger-beskrivelse i #modal-sjanger uten å laste hele kartet.
// opts: { root, genreDescs, onShowArtists }
// Kortet som står åpent nå (label + opts), så det kan tegnes på nytt når data
// lander etter at det ble åpnet. Sporet HER, ikke i sidene, fordi kortet åpnes
// fra flere innganger: sjanger-bobler, tre-noder og lærerens oversikt. Sporing i
// én av dem ville bare dekket den ene.
let openSjanger = null;

// Tegn det åpne sjangerkortet på nytt. Gjør ingenting hvis ingen står åpent, så
// den er trygg å kalle fra et hvilket som helst snapshot.
//
// `freshOpts` (valgfri) erstatter de lagrede opts før omtegningen. Uten den
// tegnes kortet med data-referansene fra ÅPNINGSØYEBLIKKET: subscribe-
// callbackene BYTTER referansene (state.genreDescs = descs), så de fangede
// opts så aldri en fersk beskrivelse — bare varmestripa ble ny (den leses fra
// modulnivå via getHeatData). Kallerne sender sjangerOpts(), som bygges fra
// gjeldende state ved hvert kall.
export function refreshSjangerInfo(freshOpts) {
  if (!openSjanger) return false;
  if (freshOpts) openSjanger.opts = freshOpts;
  const modal = (openSjanger.opts.root || document).querySelector("#modal-sjanger");
  if (!modal?.classList.contains("open")) return false;
  return showSjangerInfo(openSjanger.label, openSjanger.opts);
}

export function showSjangerInfo(label, opts = {}) {
  const { root = document, genreDescs = {}, artists = [], techItems = [], genres = [], onArtistClick, onTechClick, onMainGenreClick, onShowArtists, onShowPlaylist, onShowTimeline, onEdit, onPropose, hasPendingEdit } = opts;
  const map = Object.fromEntries(GENEALOGY.map((n) => [n.id, n]));
  const n = GENEALOGY.find((x) => x.l === label || x.f === label);
  if (!n) return false;
  const modal = root.querySelector("#modal-sjanger");
  const mTitle = root.querySelector("#sj-title");
  const mBody = root.querySelector("#sj-body");
  if (!modal || !mTitle || !mBody) return;

  const inf = n.p.map((p) => escapeHtml(map[p]?.f || p)).join(", ") || "—";
  const grewInto = GENEALOGY.filter((x) => x.p.includes(n.id)).map((x) => escapeHtml(x.f)).join(", ") || "—";
  const reactAgainst = (n.rx || []).map((p) => escapeHtml(map[p]?.f || p));
  const reactedBy = GENEALOGY.filter((x) => (x.rx || []).includes(n.id)).map((x) => escapeHtml(x.f));
  // Tre-noder er på «main»-nivå. Hent beskrivelse/kilder nivå-bevisst — kun
  // fra data (ingen fallback; mangler teksten, vises missingDesc under).
  // Delt resolver med lærerens editor, så de aldri leser ulike dokumenter.
  const resolved = resolveMainDesc(genreDescs, n.l);
  const descText = resolved.description;
  const kilderHtml = buildKilderList(resolved.kilder, "Kilder");

  const btnArea = [
    (n.g && onShowArtists) ? `<button type="button" class="btn ghost small gx-artists-btn">Artister</button>` : "",
    (n.g && onShowPlaylist) ? `<button type="button" class="btn ghost small gx-playlist-btn">Spilleliste</button>` : "",
    (n.g && onShowTimeline) ? `<button type="button" class="btn ghost small gx-timeline-btn">Tidslinje</button>` : "",
  ].filter(Boolean).join(" ");

  const lc = { artists, techItems, genres, onArtistClick, onTechClick, onMainGenreClick };
  openSjanger = { label, opts };
  mTitle.textContent = n.f;
  mBody.innerHTML = `
    ${heatStripBlock(n)}
    <p class="gx-era">${escapeHtml(eraText(resolved))}</p>
    <div class="gx-desc rt">${descText ? renderRichText(descText, lc) : `<span class="gx-missing">${missingDesc("main")}</span>`}</div>
    ${lyttHtml(resolved.lytt)}
    <p class="gx-rel"><strong>Vokste ut av:</strong> ${inf}</p>
    ${reactAgainst.length ? `<p class="gx-rel gx-react-rel"><strong>Motreaksjon mot:</strong> ${reactAgainst.join(", ")}</p>` : ""}
    <p class="gx-rel"><strong>Førte videre til:</strong> ${grewInto}</p>
    ${reactedBy.length ? `<p class="gx-rel gx-react-rel"><strong>Reaksjoner mot denne:</strong> ${reactedBy.join(", ")}</p>` : ""}
    ${kilderHtml}
    ${btnArea ? `<div style="margin-top:10px;display:flex;gap:8px">${btnArea}</div>` : ""}`;
  wireAllLinks(mBody, lc);
  const b = mBody.querySelector(".gx-artists-btn");
  if (b) b.addEventListener("click", () => onShowArtists({ label: n.l }));
  const bp = mBody.querySelector(".gx-playlist-btn");
  if (bp) bp.addEventListener("click", () => onShowPlaylist({ label: n.l, fullName: n.f, node: n }));
  const bt = mBody.querySelector(".gx-timeline-btn");
  if (bt) bt.addEventListener("click", () => onShowTimeline({ label: n.l }));
  // Rediger (lærer): n.l er doc-ID-en i genreDescriptions — samme ID som
  // «Foreslå endring» under bruker, så begge veier treffer samme dokument.
  renderGenreEditBtn(root, onEdit ? () => onEdit(n.l, "main") : null);
  // Foreslå endring (student). entityId = n.l — SAMME dokument-ID som lærer-
  // redigering bruker (tidligere n.f, som traff et annet dokument). Nivået
  // «main» følger med så godkjenning skriver til riktig nivåfelt.
  // currentValues må bære ALLE feltene forslagsskjemaet har (også kilder og
  // epoke-årstallene) — bare description ga tomme kilderader over eksisterende
  // kilder, en falsk «kilder: []»-diff i hvert forslag, og kildetap ved
  // godkjenning. Foten kobles av den DELTE wireProposeFoot (ui-edit.js) —
  // showGenreLevelInfo i ui.js bruker samme hjelper for samme modal, og en
  // lokal kopi her hadde alt begynt å leve sitt eget liv.
  wireProposeFoot(root, onPropose, hasPendingEdit, "subgenre", n.l, n.f, {
    description: descText || "",
    kilder: resolved.kilder || [],
    activeFrom: resolved.activeFrom ?? null,
    activeTo: resolved.activeTo ?? null,
  }, "main");
  modalOpen(modal);
  return true;
}

// Vis koblings-beskrivelse (en strek i treet) i #modal-sjanger. Tekstene bor i
// Firestore-samlingen edgeDescriptions (doc-ID = edgeKey(fra, til)) — ingen
// fallback i koden; mangler teksten, vises en tydelig mangler-melding (samme
// prinsipp som sjangerbeskrivelsene). opts: { root, edgeDescs, artists,
// techItems, genres, onArtistClick, onTechClick, onMainGenreClick, onEditEdge }
export function showEdgeInfo(fromId, toId, opts = {}) {
  const { root = document, edgeDescs = {}, genreDescs = {}, artists = [], techItems = [], genres = [], onArtistClick, onTechClick, onMainGenreClick, onEditEdge } = opts;
  const map = Object.fromEntries(GENEALOGY.map((n) => [n.id, n]));
  const a = map[fromId], b = map[toId];
  if (!a || !b) return false;
  const modal = root.querySelector("#modal-sjanger");
  const mTitle = root.querySelector("#sj-title");
  const mBody = root.querySelector("#sj-body");
  if (!modal || !mTitle || !mBody) return false;

  // Koblings-popupen overtar SAMME modal som sjangerkortet. Uten dette ble
  // `openSjanger` stående fra kortet som sto åpent før, og et content-snapshot
  // (refreshSjangerInfo) tegnet da sjangerkortet oppå den åpne koblingen.
  openSjanger = null;

  const react = (b.rx || []).includes(fromId);
  const doc = edgeDescs[edgeKey(fromId, toId)] || {};
  const descText = doc.description || "";
  const kilderHtml = buildKilderList(doc.kilder, "Kilder");

  // Sjanger-knappene åpner de to sjangrenes egne popuper (samme rute som
  // sjanger-tags), så koblingen alltid kan leses i sammenheng.
  const genreBtns = onMainGenreClick
    ? `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn ghost small gx-edge-from-btn">Om ${escapeHtml(a.l)}</button>
        <button type="button" class="btn ghost small gx-edge-to-btn">Om ${escapeHtml(b.l)}</button>
        ${onEditEdge ? `<button type="button" class="btn ghost small gx-edge-edit-btn">Rediger</button>` : ""}
      </div>`
    : "";

  const lc = { artists, techItems, genres, onArtistClick, onTechClick, onMainGenreClick };
  mTitle.textContent = `${a.f} → ${b.f}`;
  mBody.innerHTML = `
    <p class="gx-era">${react ? "Motreaksjon" : "Avstamning / påvirkning"} · ${escapeHtml(eraText(resolveMainDesc(genreDescs, a.l)))} → ${escapeHtml(eraText(resolveMainDesc(genreDescs, b.l)))}</p>
    <div class="gx-desc rt">${descText ? renderRichText(descText, lc) : `<span class="gx-missing">${missingDesc("kobling")}</span>`}</div>
    ${kilderHtml}
    ${genreBtns}`;
  wireAllLinks(mBody, lc);
  const bf = mBody.querySelector(".gx-edge-from-btn");
  if (bf) bf.addEventListener("click", () => onMainGenreClick(a.l));
  const bt2 = mBody.querySelector(".gx-edge-to-btn");
  if (bt2) bt2.addEventListener("click", () => onMainGenreClick(b.l));
  const be2 = mBody.querySelector(".gx-edge-edit-btn");
  if (be2) be2.addEventListener("click", () => onEditEdge(fromId, toId));

  // «Foreslå endring»-foten og Rediger-ikonet i hodet gjelder sjanger-
  // beskrivelser — nullstill begge her, så de ikke blir stående igjen fra en
  // tidligere sjanger-popup i samme modal og redigerer feil sjanger.
  // (Koblingen har sin egen Rediger-knapp i kroppen, .gx-edge-edit-btn.)
  const foot = root.querySelector("#sj-foot");
  if (foot) foot.style.display = "none";
  renderGenreEditBtn(root, null);

  modalOpen(modal);
  return true;
}

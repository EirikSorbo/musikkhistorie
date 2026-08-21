// ============================================================================
//  SLEKTSTRE — «Carta» i musicmap-stil
// ----------------------------------------------------------------------------
//  2D-kart: tid løper nedover, metasjanger bortover. Dra for å panorere,
//  scroll/knapper for å zoome, hover lyser opp påvirkningslinjene, klikk åpner
//  panel med beskrivelse + spilleliste.
//
//  Fila eier VISNINGEN. Selve treet (hvilke sjangre som finnes, hvem som stammer
//  fra hvem, familiefargene) kommer fra js/genre-model.js, som leser det fra
//  Firestore — herfra og ut er strukturen data, ikke kode.
// ============================================================================

import { wireAllLinks } from "./linkify.js?v=4.53";
import { renderRichText } from "./rich-text.js?v=4.53";
import { escapeHtml, buildKilderList } from "./util.js?v=4.53";
import { resolveDesc, resolveDescAny, missingDesc } from "./genre-descriptions.js?v=4.53";
import { modalOpen } from "./ui-modal.js?v=4.53";
import { renderGenreEditBtn } from "./ui-helpers.js?v=4.53";
import { heatRow, heatStripHtml, heatAxisHtml, getHeatData } from "./heat-strip.js?v=4.53";
import { attachCamera } from "./gx-camera.js?v=4.53";
import { GENEALOGY, FAMILIES, DECADE_ROWS, edgeKey } from "./genre-model.js?v=4.53";

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
// i Firestore (activeFrom/activeTo), som læreren kan rette og appen kan måle mot
// varmekartet. Nodens era-streng i koden er bare fallback for sjangre som ennå
// ikke er gjennomgått — den fases ut etter hvert som årstallene fylles inn.
// Tomt sluttår betyr «fortsatt aktiv», ikke «ukjent»: en sjanger som lever i
// dag skal lese «1990–i dag», ikke stå med en åpen strek.
export function eraText(n, resolved) {
  const from = resolved?.activeFrom, to = resolved?.activeTo;
  if (Number.isInteger(from)) return `${from}–${Number.isInteger(to) ? to : "i dag"}`;
  return n.era || "";
}

export function resolveMainDesc(genreDescs, genreId) {
  const n = GENEALOGY.find((x) => x.l === genreId || x.f === genreId);
  return n
    ? resolveDescAny(genreDescs, [n.l, n.f], "main")
    : resolveDesc(genreDescs, genreId, "main");
}

// Varmelinja øverst på sjangerkortet: samme glidende stripe som i varmekartet,
// med tiårene over — så man ser sjangerens tyngdepunkt gjennom historien før man
// leser et eneste ord. Fargen er nodens egen familiefarge fra treet.
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
  const color = FAMILIES[n.fam]?.stroke || FAMILIES.gray.stroke;
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
export function refreshSjangerInfo() {
  if (!openSjanger) return false;
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
    <p class="gx-era">${escapeHtml(eraText(n, resolved))}</p>
    <div class="gx-desc rt">${descText ? renderRichText(descText, lc) : `<span class="gx-missing">${missingDesc("main")}</span>`}</div>
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
  // godkjenning.
  const foot = root.querySelector("#sj-foot");
  const propBtn = root.querySelector("#sj-propose");
  if (foot && propBtn) {
    if (onPropose) {
      const locked = hasPendingEdit?.("subgenre", n.l);
      foot.style.display = "";
      propBtn.disabled = !!locked;
      propBtn.textContent = locked ? "Forslag venter på godkjenning" : "Foreslå endring";
      propBtn.onclick = () => onPropose({
        entityType: "subgenre",
        entityId: n.l,
        entityName: n.f,
        level: "main",
        currentValues: {
          description: descText || "",
          kilder: resolved.kilder || [],
          activeFrom: resolved.activeFrom ?? null,
          activeTo: resolved.activeTo ?? null,
        },
      });
    } else {
      foot.style.display = "none";
    }
  }
  modalOpen(modal);
  return true;
}

// Vis koblings-beskrivelse (en strek i treet) i #modal-sjanger. Tekstene bor i
// Firestore-samlingen edgeDescriptions (doc-ID = edgeKey(fra, til)) — ingen
// fallback i koden; mangler teksten, vises en tydelig mangler-melding (samme
// prinsipp som sjangerbeskrivelsene). opts: { root, edgeDescs, artists,
// techItems, genres, onArtistClick, onTechClick, onMainGenreClick, onEditEdge }
export function showEdgeInfo(fromId, toId, opts = {}) {
  const { root = document, edgeDescs = {}, artists = [], techItems = [], genres = [], onArtistClick, onTechClick, onMainGenreClick, onEditEdge } = opts;
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
    <p class="gx-era">${react ? "Motreaksjon" : "Avstamning / påvirkning"} · ${escapeHtml(a.era)} → ${escapeHtml(b.era)}</p>
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

const W = 1900, NW = 116, NH = 40, SVGNS = "http://www.w3.org/2000/svg";
const ROW_GAP = 95;   // avstand mellom radene; brukes til node-yOffset (brøkdel av en rad)
const ROW_TOP = 70;   // y for rad 0
// y for en rad. Var en fast tabell med tolv oppslag til v4.48; nå en formel, så
// en sjanger på en ny rad (2020-tallet) får en y i stedet for undefined.
const rowY = (r) => ROW_TOP + r * ROW_GAP;
const DEC = { 0: "Røtter", 1: "1900", 2: "1910-t", 3: "1920-t", 4: "1930-t", 5: "1940-t", 6: "1950-t", 7: "1960-t", 8: "1970-t", 9: "1980-t", 10: "1990-t", 11: "2000-t", 12: "2010-t" };
function el(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// ----------------------------------------------------------------------------
//  Bygger kartet i modal-rotelementet. Returnerer { fit } for å sentrere ved
//  hver åpning. opts: { root, genreDescs, onShowArtists }
// ----------------------------------------------------------------------------
export function renderGenealogy({ root = document, getOpts }) {
  const stage = root.querySelector("#gx-stage");
  const cam = root.querySelector("#gx-cam");

  const map = {}, kids = {};
  // yOffset (brøkdel av en rad, valgfritt): flytter noden opp eller ned INNENFOR
  // sitt eget tiårsbånd — brukt der en sjanger nedstammer fra en node i SAMME
  // tiår (blues↔work songs, modal↔cool, soul↔funk), så «forelder over barn»
  // bevares uten å bryte rad = tiår. Negativ verdi løfter noden mot toppen av
  // båndet (Soul), positiv senker den mot neste tiårslinje (Funk).
  GENEALOGY.forEach((n) => { n.y = rowY(n.r) + (n.yOffset || 0) * ROW_GAP; n.rx = n.rx || []; map[n.id] = n; kids[n.id] = []; });
  // Alle foreldre = avstamning (p) + motreaksjon (rx)
  const parentsOf = (n) => { const a = n.p.slice(); n.rx.forEach((id) => { if (!a.includes(id)) a.push(id); }); return a; };
  GENEALOGY.forEach((n) => parentsOf(n).forEach((p) => { if (kids[p]) kids[p].push(n.id); }));

  const anc = (id, s = {}) => { parentsOf(map[id]).forEach((p) => { if (!s[p]) { s[p] = 1; anc(p, s); } }); return s; };

  cam.innerHTML = "";

  // Familiebånd (v4.21): lys flate i familiefargen bak hver sjangerfamilie, så
  // samhørigheten leses før en eneste strek — samme grep som musicmap.info sine
  // «kontinenter». Flaten bygges av nodenes egne (polstrede) rektangler pluss
  // brede bånd langs koblingene INNAD i familien, samlet i én <g> med opacity
  // på GRUPPEN: da flater overlappende deler ut til én jevn tone i stedet for å
  // mørkne. Kun kanter der BEGGE endene hører til familien tas med — en
  // bounding-boks per familie ville annektert fremmede noder (Pop ligger midt i
  // Country-kolonnene, Reggae vegg i vegg med Klubbmusikk). Forbindelsesbåndene
  // tegnes som RETTE senter-til-senter-linjer, ikke kantenes bezier-buer:
  // samme-rad-buene bøyer 46 px NED under nodene, og et bredt bånd langs dem
  // ville sklidd inn i tiårsbåndet under (målt: Hymner→Spirituals over Blues).
  // Tegnes FØRST, så rutenett, kanter og noder ligger over.
  const FAMBG_PAD = 14, FAMBG_OPACITY = 0.06, FAMBG_STROKE = 74;
  for (const fam of new Set(GENEALOGY.map((n) => n.fam))) {
    const color = FAMILIES[fam]?.stroke || FAMILIES.gray?.stroke;
    const g = el("g", { class: "gx-famband", opacity: FAMBG_OPACITY });
    for (const n of GENEALOGY) {
      if (n.fam !== fam) continue;
      g.appendChild(el("rect", {
        x: n.cx - NW / 2 - FAMBG_PAD, y: n.y - NH / 2 - FAMBG_PAD,
        width: NW + 2 * FAMBG_PAD, height: NH + 2 * FAMBG_PAD,
        rx: 26, fill: color,
      }));
      for (const pid of parentsOf(n)) {
        const pa = map[pid];
        if (!pa || pa.fam !== fam) continue;
        g.appendChild(el("line", {
          x1: pa.cx, y1: pa.y, x2: n.cx, y2: n.y,
          stroke: color, "stroke-width": FAMBG_STROKE, "stroke-linecap": "round",
        }));
      }
    }
    cam.appendChild(g);
  }

  // Tiår-rutenett (tids-aksen). Radene kommer fra modellen (DECADE_ROWS), som
  // utleder dem av nodene — legger læreren inn en 2020-tallssjanger, vokser
  // aksen av seg selv i stedet for å stoppe på et hardkodet 2010-t.
  DECADE_ROWS.forEach((label, r) => {
    cam.appendChild(el("line", { x1: 0, y1: rowY(r) - 47, x2: W, y2: rowY(r) - 47, class: "gx-grid" }));
    const dl = el("text", { x: 14, y: rowY(r) - 40, class: "gx-decade" });
    dl.textContent = label;
    cam.appendChild(dl);
  });

  // Kanter — heltrukne = avstamning, stiplet = motreaksjon
  const edges = [], edgeHits = [];
  GENEALOGY.forEach((n) => parentsOf(n).forEach((pid) => {
    const pa = map[pid];
    const reaction = n.rx.includes(pid);
    let d;
    // Samme tiår OG samme kolonne (Soul → Funk, Cool → Modal): noden ligger rett
    // under forelderen, og en bue ville gått ned forbi barnet og kommet inn
    // nedenfra — som en stump som stikker ut under boksen. Da tegnes streken rett
    // ned, som mellom to tiår.
    if (pa.r === n.r && Math.abs(pa.cx - n.cx) > 4) {
      // Samme tiår, ulik kolonne: bue under begge nodene
      const y1 = pa.y + NH / 2, y2 = n.y + NH / 2, bow = 46;
      d = `M${pa.cx},${y1} C${pa.cx},${y1 + bow} ${n.cx},${y2 + bow} ${n.cx},${y2}`;
    } else {
      const x1 = pa.cx, y1 = pa.y + NH / 2, x2 = n.cx, y2 = n.y - NH / 2, ym = (y1 + y2) / 2;
      d = `M${x1},${y1} C${x1},${ym} ${x2},${ym} ${x2},${y2}`;
    }
    const path = el("path", { d, class: "gx-edge" + (reaction ? " gx-react" : "") });
    path.dataset.p = pid; path.dataset.c = n.id; path.dataset.fam = n.fam; path.dataset.react = reaction ? "1" : "";
    cam.appendChild(path); edges.push(path);
    // Usynlig, bred trykkbane oppå streken: en ~1,4 px linje er umulig å
    // treffe med finger (og fiklete med mus), så denne fanger klikk/hover for
    // koblingen. Nodene tegnes senere og ligger derfor alltid øverst.
    const hit = el("path", { d, class: "gx-edge-hit" });
    hit.dataset.p = pid; hit.dataset.c = n.id;
    cam.appendChild(hit); edgeHits.push(hit);
  }));

  // Noder
  const gnodes = {};
  GENEALOGY.forEach((n) => {
    const g = el("g", { class: "gx-node gx-f-" + n.fam });
    g.dataset.id = n.id;
    const rect = el("rect", { x: n.cx - NW / 2, y: n.y - NH / 2, width: NW, height: NH, rx: 8 });
    g.appendChild(rect);
    const tx = el("text", { x: n.cx, y: n.y, "text-anchor": "middle", "dominant-baseline": "central" });
    tx.textContent = n.l;
    g.appendChild(tx); cam.appendChild(g); gnodes[n.id] = g;
    // Noen etiketter er bredere enn NW («British invasion»); boksen utvides
    // til teksten så fokus-fyllet ved hover dekker hele navnet. Måling krever
    // synlig DOM — utenfor dokumentflyt blir bredden 0 og NW beholdes.
    const w = (tx.getComputedTextLength ? tx.getComputedTextLength() : 0) + 18;
    if (w > NW) {
      // KLEM mot nærmeste nabo i samme rad: den usynlige trefflata skal aldri
      // nå forbi midtpunktet mot naboen, ellers treffer klikk/hover ved kanten
      // feil node (målt overlapp på britinv/modal og chicagoblues/bebop).
      let nearestHalf = Infinity;
      for (const m of GENEALOGY) {
        if (m.r === n.r && m.id !== n.id) nearestHalf = Math.min(nearestHalf, Math.abs(m.cx - n.cx) / 2);
      }
      const half = Math.min(w / 2, Math.max(NW / 2, nearestHalf - 2));
      rect.setAttribute("x", n.cx - half);
      rect.setAttribute("width", half * 2);
    }
  });

  // Utheving (vises ved hover): hele anelinjen bakover + kun direkte barn
  // fremover. Full etterkommer-lukning lyste opp 60–90 % av kartet for de
  // tidlige sjangrene (blues, gospel …) og mistet all effekt; historien
  // videre nedover følges ledd for ledd, eller via popupens «Førte videre til».
  function light(id) {
    const ancSelf = anc(id); ancSelf[id] = 1;
    const line = Object.assign({}, ancSelf);
    kids[id].forEach((c) => { line[c] = 1; });
    GENEALOGY.forEach((n) => {
      gnodes[n.id].classList.toggle("gx-dim", !line[n.id]);
      gnodes[n.id].classList.toggle("gx-focus", n.id === id);
    });
    edges.forEach((e) => {
      // Kun streker som ligger på de opplyste banene: innad i anelinjen
      // (koblingens barn er ane eller sjangeren selv) eller ut til et direkte
      // barn. «Begge endepunkter lyser» holdt ikke — det tente snarveier
      // utenom sjangeren (f.eks. blues→R&B ved hover på gospel).
      const on = ancSelf[e.dataset.c] || e.dataset.p === id;
      e.classList.toggle("gx-hl", !!on);
      e.classList.toggle("gx-dim", !on);
      e.style.stroke = on ? (e.dataset.react ? "#d97706" : ((FAMILIES[e.dataset.fam]?.stroke || ""))) : "";
    });
  }
  // Utheving av ÉN kobling (hover på trykkbane): de to endepunkt-nodene +
  // selve streken lyser, alt annet dimmes.
  function lightEdge(pid, cid) {
    GENEALOGY.forEach((n) => {
      gnodes[n.id].classList.toggle("gx-dim", n.id !== pid && n.id !== cid);
      gnodes[n.id].classList.remove("gx-focus");
    });
    edges.forEach((e) => {
      const on = e.dataset.p === pid && e.dataset.c === cid;
      e.classList.toggle("gx-hl", on);
      e.classList.toggle("gx-dim", !on);
      e.style.stroke = on ? (e.dataset.react ? "#d97706" : ((FAMILIES[e.dataset.fam]?.stroke || ""))) : "";
    });
  }
  function clearLight() {
    GENEALOGY.forEach((n) => gnodes[n.id].classList.remove("gx-dim", "gx-focus"));
    edges.forEach((e) => { e.classList.remove("gx-hl", "gx-dim"); e.style.stroke = ""; });
  }

  // --- Touch: uten hover trykker man for å lyse opp. Første trykk på en node
  //     dimmer alt utenom slekta (nøyaktig som hover på Mac) og viser et lite
  //     kort nederst; andre trykk på samme node — eller «Detaljer»-knappen —
  //     åpner popupen. Kun på touch/pen; mus beholder hover + direkte klikk. ---
  let selectedId = null;
  const card = document.createElement("div");
  card.className = "gx-card";
  card.innerHTML =
    `<span class="gx-card-dot"></span>` +
    `<span class="gx-card-name"></span>` +
    `<button type="button" class="btn ghost small gx-card-btn">Detaljer</button>`;
  stage.appendChild(card);
  const cardDot = card.querySelector(".gx-card-dot");
  const cardName = card.querySelector(".gx-card-name");
  card.querySelector(".gx-card-btn").addEventListener("click", (ev) => {
    ev.stopPropagation();               // ellers ville stage-klikket nullstilt valget
    if (selectedId) openModal(selectedId);
  });
  function showCard(n) {
    cardName.textContent = n.l;
    cardDot.style.background = FAMILIES[n.fam]?.stroke || FAMILIES.gray?.stroke;
    card.classList.add("show");
  }
  function selectTouch(id) { selectedId = id; light(id); showCard(map[id]); }
  function clearTouchSel() { selectedId = null; card.classList.remove("show"); }

  function reset() { clearLight(); clearTouchSel(); }

  // Panorering, zoom og pinch bor i det delte kameraet (gx-camera.js), som
  // bundle-visningen bruker likt. `isMoved()` skiller et klikk fra slutten på
  // en dragning, `isTouch()` skiller to-trinns-trykk fra mus-hover.
  const camera = attachCamera({
    root, stage, cam, width: W,
    height: rowY(Math.max(DECADE_ROWS.length - 1, 0)) + NH,   // nederste tiårsrad + nodehøyde
    onBackgroundClick: reset,
  });

  // Klikk → popup med detaljer. Bruker den delte showSjangerInfo med sidens
  // FELLES sjangerOpts (getOpts), så node-klikk, tag-klikk og forsidens
  // sjangerbobler alltid viser nøyaktig samme kort — samme knapper, samme
  // varmestripe. Kartet bygger ikke lenger sin egen opts: det var slik
  // «Tidslinje»-knappen kunne finnes på forsidens kort og mangle i treets.
  function openModal(id) {
    showSjangerInfo(map[id].l, getOpts());
  }

  // Klikk på strek → koblings-popup (samme modal, delt showEdgeInfo).
  // Samme opts-objekt: edgeDescs ligger i sjangerOpts, så kartet slipper å
  // sette sammen sin egen kontekst.
  function openEdgeModal(pid, cid) {
    showEdgeInfo(pid, cid, getOpts());
  }

  GENEALOGY.forEach((n) => {
    const g = gnodes[n.id];
    // Hover-lyset skal ikke overstyre et aktivt touch-valg (mus-events kan bli
    // syntetisert etter et trykk på touch), derfor sjekk selectedId.
    g.addEventListener("mouseenter", () => { if (!selectedId) light(n.id); });
    g.addEventListener("mouseleave", () => { if (!selectedId) clearLight(); });
    g.addEventListener("click", (ev) => {
      if (camera.isMoved()) return;
      ev.stopPropagation();
      if (!camera.isTouch()) { openModal(n.id); return; }   // mus: som før
      if (selectedId === n.id) openModal(n.id);        // andre trykk → detaljer
      else selectTouch(n.id);                           // første trykk → lys opp
    });
  });

  // Trykkbanene: hover lyser opp koblingen (kun mus — touch-valget skal ikke
  // overstyres), klikk/tap åpner koblings-popupen direkte på begge plattformer
  // (popupen ER poenget med en strek, i motsetning til nodenes to-trinns-trykk).
  edgeHits.forEach((h) => {
    const pid = h.dataset.p, cid = h.dataset.c;
    h.addEventListener("mouseenter", () => { if (!selectedId) lightEdge(pid, cid); });
    h.addEventListener("mouseleave", () => { if (!selectedId) clearLight(); });
    h.addEventListener("click", (ev) => {
      if (camera.isMoved()) return;
      ev.stopPropagation();               // ikke la stage-klikket nullstille lyset
      openEdgeModal(pid, cid);
    });
  });

  // Popupens lukking (backdrop + ✕) kobles av sidens setupModal("modal-sjanger"),
  // ikke her. Escape håndteres på sidenivå (modalCloseTop), så vi registrerer
  // ingen egen Escape-lytter — ellers ville Escape lukket både denne popupen og
  // en stablet modal (f.eks. artistlista) samtidig.

  // Forklaring: kun strektypene (avstamning vs. motreaksjon). Fargene varsles
  // fortsatt i konsollen hvis en nodefamilie mangler strekfarge (brukt ved hover).
  new Set(GENEALOGY.map((n) => n.fam)).forEach((fam) => {
    if (!FAMILIES[fam]) console.warn(`Slektstre: fam «${fam}» mangler i FAMILIES (ingen strekfarge ved hover).`);
  });
  const legend = root.querySelector("#gx-legend");
  if (legend) {
    legend.innerHTML =
      `<div class="gx-leg"><span class="gx-sw-line gx-sw-solid"></span>avstamning / påvirkning</div>` +
      `<div class="gx-leg"><span class="gx-sw-line"></span>motreaksjon</div>` +
      `<div class="gx-leg gx-leg-hint">klikk på en strek for å lese om koblingen</div>`;
  }

  reset();
  return { fit: camera.fit, destroy: camera.destroy };
}

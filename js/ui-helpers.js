// ============================================================================
//  UI — LAVNIVÅ-HJELPERE
// ----------------------------------------------------------------------------
//  Rene, gjenbrukbare byggeklosser for rendering (HTML-snutter, formattering).
//  Avhenger kun av util + linkify + limits (GENDERS) — INGEN render-funksjoner,
//  så modulen kan importeres fritt uten import-sykler. Re-eksporteres fra ui.js.
// ============================================================================

import { escapeHtml, buildKilderList, safeUrl, wikimediaThumb } from "./util.js?v=3.52";
import { linkifyAll, wireAllLinks } from "./linkify.js?v=3.52";
import { GENDERS } from "./limits.js?v=3.52";

export { escapeHtml, buildKilderList, safeUrl };

// Bilde-fallback: når en skalert Wikimedia-thumbnail ikke lar seg hente
// (Wikimedia avviser enkelte ferske bredder), bytt <img> tilbake til
// original-URL-en i data-full. Én fangende lytter dekker alle bilder uansett
// render-sted; img-error bobler ikke, så capture-fasen er nødvendig.
// data-fellback sikrer nøyaktig ett bytte, så et brutt original aldri looper.
if (typeof document !== "undefined") {
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img?.tagName === "IMG" && img.dataset?.full && !img.dataset.fellback) {
      img.dataset.fellback = "1";
      img.src = img.dataset.full;
    }
  }, true);
}

// <img> som ber om en skalert Wikimedia-thumbnail når mulig, med data-full →
// original som reserve (error-lytteren over bytter tilbake om Wikimedia ikke
// leverer nettopp den bredden). Kutter dekodet bildeminne dramatisk på mobil.
export function imgTag(url, alt, width) {
  const thumb = wikimediaThumb(url, width);
  const src = thumb || url;
  const fallback = thumb ? ` data-full="${escapeHtml(url)}"` : "";
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async"${fallback} />`;
}

export const GENDER_LABEL = Object.fromEntries(GENDERS.map((g) => [g.value, g.label]));

export function linkDesc(text, lc) {
  if (!lc) return escapeHtml(text);
  return linkifyAll(text, lc);
}

export function wireLinks(el, lc) {
  if (!lc) return;
  wireAllLinks(el, lc);
}

export const kilderHtml = (kilder) => buildKilderList(kilder, "Kilder");

// Delte lærer-ikoner — ÉN kilde (artistkortene i ui.js importerer også disse),
// så alle redigerbare kort får identiske sjekk/rediger/slett-knapper.
const ico = (d, stroke = "currentColor") => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
export const ICONS = {
  check: ico("M20 6L9 17l-5-5"),
  edit: ico("M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7") + ico("M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5"),
  ban: ico("M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"),
  trash: ico("M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"),
  restore: ico("M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8") + ico("M21 3v5h-5"),
  approve: ico("M22 11.08V12a10 10 0 11-5.93-9.14") + ico("M22 4L12 14.01l-3-3"),
  reject: ico("M18 6L6 18M6 6l12 12"),
};

// Delt «Sjekket»-knapp — ÉN kilde til markup/klasser, så alle sjekk-flatene
// (artistdetalj, sjanger-popup, innovasjonskort, koblingskort, tiår) og
// teacherActionRow aldri driver fra hverandre. Ikon-knapp som på artistkortene:
// grønn «active»-tilstand = sjekket. checkBtnHtml lager markupen; setCheckBtn/
// toggleCheckBtn oppdaterer en eksisterende knapp optimistisk (modalene re-
// rendres ikke av snapshotet). `extra` er ekstra klasser (f.eks. «tcr-check»).
const CHECK_TITLE = (checked) => checked ? "Fjern avhuking" : "Merk som sjekket";
export function checkBtnHtml(checked, extra = "") {
  const cls = ("icon-btn " + extra).trim() + (checked ? " active" : "");
  return `<button type="button" class="${cls}" title="${CHECK_TITLE(checked)}" aria-label="${CHECK_TITLE(checked)}">${ICONS.check}</button>`;
}
export function setCheckBtn(btn, checked, extra = "") {
  btn.className = ("icon-btn " + extra).trim() + (checked ? " active" : "");
  btn.title = CHECK_TITLE(checked);
  btn.setAttribute("aria-label", CHECK_TITLE(checked));
  btn.innerHTML = ICONS.check;
}
export function toggleCheckBtn(btn, extra = "") {
  const now = !btn.classList.contains("active");
  setCheckBtn(btn, now, extra);
  return now;
}

// Delt lærer-knapperad for detaljvisninger (sjanger, historie, røtter,
// innovasjonskort, tiår osv.): Sjekk helt til venstre, Rediger + Slett til
// høyre — samme ikonknapper som artistkortene. Vises kun når lærer-callbacks
// finnes, så studentvisningen aldri får knappene. Slett tas kun med for hele
// enheter (innovasjonskort) — sjanger/historie/side har ingen enhet å slette.
export function teacherActionRow({ checked = false, edit = true, del = false } = {}) {
  const right = [
    edit ? `<button type="button" class="icon-btn tcr-edit" title="Rediger" aria-label="Rediger">${ICONS.edit}</button>` : "",
    del ? `<button type="button" class="icon-btn danger tcr-del" title="Slett" aria-label="Slett">${ICONS.trash}</button>` : "",
  ].filter(Boolean).join("");
  return `<div class="teacher-card-actions">
    ${checkBtnHtml(checked, "tcr-check")}
    <div class="spacer"></div>
    ${right}
  </div>`;
}

// Kobler radens tre knapper. Sjekk-knappen skifter utseende optimistisk (modalen
// re-rendres ikke av snapshotet), og onCheck(nyTilstand) skriver til Firestore.
export function wireTeacherRow(container, { onCheck, onEdit, onDelete } = {}) {
  const chk = container.querySelector(".tcr-check");
  if (chk && onCheck) chk.addEventListener("click", () => onCheck(toggleCheckBtn(chk, "tcr-check")));
  const edt = container.querySelector(".tcr-edit");
  if (edt && onEdit) edt.addEventListener("click", onEdit);
  const del = container.querySelector(".tcr-del");
  if (del && onDelete) del.addEventListener("click", onDelete);
}

// Bygger sjanger- og undersjanger-bobler (begge klikkbare filtre).
// Opsjoner: withInstrument tar med instrument-boblen, withSub kan slå av
// undersjanger-boblene, extraClass legges på alle boblene (f.eks. "tag-pl"
// i spillelista).
export function genreTags(a, { withInstrument = false, withSub = true, extraClass = "" } = {}) {
  const cls = extraClass ? ` ${extraClass}` : "";
  const sjanger = Array.isArray(a.mainGenre) ? a.mainGenre : [];
  const under = withSub && Array.isArray(a.subGenre) ? a.subGenre : [];
  return [
    ...sjanger.map((s) => `<button class="tag tag-sjanger${cls}" data-sjanger="${escapeHtml(s)}">${escapeHtml(s)}</button>`),
    ...under.map((s) => `<button class="tag tag-under${cls}" data-under="${escapeHtml(s)}">${escapeHtml(s)}</button>`),
    withInstrument && a.instrument ? `<button class="tag tag-instrument${cls}" data-instrument="${escapeHtml(a.instrument)}">${escapeHtml(a.instrument)}</button>` : "",
  ].filter(Boolean).join("");
}

// Podkast-episodekort — delt av student-popupen (explore.js) og lærer-admin
// (teacher-content.js), så markupen ikke driver fra hverandre. withDelete
// legger på slett-knappen (data-pod-delete); kalleren kobler lytteren.
export function podcastEpisodeHtml(ep, { withDelete = false } = {}) {
  const duration = ep.duration ? `<span class="podkast-duration">${escapeHtml(ep.duration)}</span>` : "";
  const desc = ep.description ? `<p class="podkast-desc">${escapeHtml(ep.description)}</p>` : "";
  const audio = safeUrl(ep.audioUrl);
  return `
    <article class="podkast-episode">
      <div class="podkast-header">
        <h3 class="podkast-title">${escapeHtml(ep.title || "Uten tittel")}</h3>
        ${duration}
      </div>
      ${desc}
      ${audio ? `<audio controls preload="none" src="${escapeHtml(audio)}"></audio>` : ""}
      ${withDelete ? `<div class="podkast-actions">
        <button class="icon-btn danger" data-pod-delete="${escapeHtml(ep.id)}" title="Slett" aria-label="Slett">${ICONS.trash}</button>
      </div>` : ""}
    </article>`;
}

export function yearLabel(w) {
  const y = w.year || null;
  if (y) return `(${y})`;
  return "";
}

export function musicExampleLabel(m) {
  const y = m.year || null;
  const p = m.performanceYear || null;
  if (y && p && p !== y) return ` (${y}, framføring ${p})`;
  if (y) return ` (${y})`;
  if (p) return ` (framføring ${p})`;
  return "";
}

// Delt musikkeksempel-lenkeliste (brukt av detalj-, spotlight- og artistkort).
// Hvert eksempel pakkes i .me-item slik at en valgfri «Hør etter:»-anvisning
// (m.note — kontekstualisert lytting) kan vises rett under lyttelenka. Uten
// note ser lenka ut som før (pill i .links-raden).
export function musicExamplesHtml(a) {
  return (a.musicExamples || [])
    .filter((m) => safeUrl(m.url))
    .map((m) => {
      const link = `<a href="${escapeHtml(safeUrl(m.url))}" target="_blank" rel="noopener">${escapeHtml(m.label || "Lytt")}${musicExampleLabel(m)}</a>`;
      const cue = m.note
        ? `<span class="listen-cue"><strong>Hør etter:</strong> ${escapeHtml(m.note)}</span>`
        : "";
      return `<span class="me-item">${link}${cue}</span>`;
    })
    .join("");
}

// Beslektede artister — utledet naboliste for «oppdag ny musikk». Rangerer
// andre synlige artister på musikalsk slektskap (delte under-/hovedsjangre,
// samme metasjanger som lett bonus) med nærhet i tid som tiebreaker. Krever
// minst én delt hoved- eller undersjanger, så lista aldri blir tilfeldig.
function relatedArtists(artist, all, { limit = 5 } = {}) {
  if (!artist || !Array.isArray(all)) return [];
  const sub = new Set(Array.isArray(artist.subGenre) ? artist.subGenre : []);
  const main = new Set(Array.isArray(artist.mainGenre) ? artist.mainGenre : []);
  const meta = artist.metaGenre || null;
  const start = artist.influenceStart || null;

  const scored = [];
  for (const b of all) {
    if (!b || b.id === artist.id) continue;
    if (b.status && b.status !== "active") continue;   // ikke ventende
    if ((b.priority || 0) === -1) continue;            // ikke skjulte
    const bSub = Array.isArray(b.subGenre) ? b.subGenre : [];
    const bMain = Array.isArray(b.mainGenre) ? b.mainGenre : [];
    const subShared = bSub.filter((s) => sub.has(s)).length;
    const mainShared = bMain.filter((s) => main.has(s)).length;
    let score = subShared * 5 + mainShared * 3;
    if (meta && b.metaGenre === meta) score += 1;      // svak metasjanger-fallback
    if (!score) continue;                              // må dele minst metasjanger
    const diff = start && b.influenceStart ? Math.abs(start - b.influenceStart) : null;
    if (diff != null) score += Math.max(0, 2 - diff / 15);  // nærhet i tid
    scored.push({ a: b, score, diff: diff == null ? Infinity : diff });
  }
  scored.sort((x, y) =>
    y.score - x.score ||
    x.diff - y.diff ||
    x.a.name.localeCompare(y.a.name, "no"));
  return scored.slice(0, limit).map((s) => s.a);
}

// Ferdig «Beslektede artister»-blokk (delt av detaljkort og spotlight-/dagens-
// kort). Tom streng når ingen slektninger finnes. Krever lc.artists (full liste).
export function relatedArtistsHtml(a, lc, { limit = 5 } = {}) {
  const related = relatedArtists(a, lc?.artists || [], { limit });
  if (!related.length) return "";
  return `<div class="related">
      <h4 class="related-head">Beslektede artister</h4>
      <div class="related-list">
        ${related.map((r) => {
          const g = (Array.isArray(r.mainGenre) && r.mainGenre[0]) ? r.mainGenre[0] : (r.metaGenre || "");
          return `<button type="button" class="related-chip" data-related-id="${escapeHtml(String(r.id))}">${escapeHtml(r.name)}${g ? `<span class="related-tag">${escapeHtml(g)}</span>` : ""}</button>`;
        }).join("")}
      </div>
    </div>`;
}

// Kobler klikk på beslektet-chips i `el` til lc.onArtistClick (bytter fokus).
export function wireRelated(el, lc) {
  el.querySelectorAll("[data-related-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = (lc?.artists || []).find((x) => String(x.id) === btn.dataset.relatedId);
      if (r) lc?.onArtistClick?.(r);
    });
  });
}

// Prioritets-ikoner/-etiketter, delt av spotlight- og artistkort.
export const PRIO_LABELS = { 3: "Viktigst", 2: "Viktig", 1: "Mindre viktig", "-1": "Skjult" };
const prioIco = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const PRIO_ICONS = {
  3: prioIco(`<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>`),
  2: prioIco(`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`),
  1: prioIco(`<path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>`),
  "-1": prioIco(`<path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>`),
};

export function keyWorksText(works) {
  if (!Array.isArray(works) || !works.length) return "";
  return works.map((w) => {
    const t = escapeHtml(w.title || "");
    const y = yearLabel(w);
    const ySuffix = y ? ` ${y}` : "";
    const url = safeUrl(w.url);
    return url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${t}</a>${ySuffix}`
      : `${t}${ySuffix}`;
  }).join(", ");
}

export function fmtCredit(raw) {
  if (!raw) return "";
  const text = raw.replace(/^Foto:\s*/i, "");
  return `<span class="image-credit">Foto: ${escapeHtml(text)}</span>`;
}

export function artistImage(a, big = false) {
  const url = safeUrl(a.imageUrl);
  if (!url) return "";
  // Detaljvisningen vises større enn kortene — be om en bredere thumbnail der.
  return `<figure class="artist-image ${big ? "big" : ""}">
    ${imgTag(url, a.name, big ? 800 : 400)}
    ${fmtCredit(a.imageCredit)}
  </figure>`;
}

function splitLines(text) {
  return text.split("\n").map(l => l.replace(/^[•\-–]\s*/, "").trim()).filter(Boolean);
}

export function formatInfoText(text) {
  if (!text) return "";
  const lines = splitLines(text);
  if (lines.length > 1) {
    return "<ul>" + lines.map(l => `<li>${escapeHtml(l)}</li>`).join("") + "</ul>";
  }
  return `<p>${escapeHtml(lines[0] || text.trim())}</p>`;
}

export function extractBullets(text) {
  return splitLines(text);
}

export function pct(n, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((n / max) * 100));
}

// Faktalinjer under tittel: levetid, innflytelse, kjønn (kun lærer), virkested.
// Vises som tekst (samme format som «Sentrale verk»), ikke som bobler.
export function factsLines(a, { showGender = false } = {}) {
  const rows = [];
  if (a.birthYear && a.deathYear) rows.push(["Levetid", `${a.birthYear}–${a.deathYear}`]);
  else if (a.birthYear) rows.push(["Levetid", `${a.birthYear}–`]);
  else if (a.deathYear) rows.push(["Levetid", `?–${a.deathYear}`]);
  if (a.influenceStart) {
    const p = (!a.influenceEnd || a.influenceEnd === a.influenceStart)
      ? `ca. ${a.influenceStart}`
      : `${a.influenceStart}–${a.influenceEnd}`;
    rows.push(["Innflytelse", p]);
  }
  if (a.recordLabel) rows.push(["Plateselskap", a.recordLabel]);
  if (showGender) rows.push(["Kjønn", GENDER_LABEL[a.gender] || "Ukjent"]);
  if (a.geography) rows.push(["Virkested", a.geography]);
  if (!rows.length) return "";
  return `<div class="facts">${rows.map(([l, v]) => `<p><strong>${l}:</strong> ${escapeHtml(v)}</p>`).join("")}</div>`;
}

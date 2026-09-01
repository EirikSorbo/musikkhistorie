// ============================================================================
//  UI — LAVNIVÅ-HJELPERE
// ----------------------------------------------------------------------------
//  Rene, gjenbrukbare byggeklosser for rendering (HTML-snutter, formattering).
//  Avhenger kun av util + linkify + rich-text + limits (GENDERS) + artist-strip
//  + ui-modal (avhengighetsfri) — INGEN render-funksjoner, så modulen kan
//  importeres fritt uten import-sykler. artistStripHtml re-eksporteres herfra,
//  så ui.js henter alle byggeklossene sine ett sted.
//  Re-eksporteres fra ui.js.
// ============================================================================

import { escapeHtml, buildKilderList, safeUrl, wikimediaThumb, dropboxDirectUrl } from "./util.js?v=5.05";
import { wireAllLinks } from "./linkify.js?v=5.05";
import { renderRichText, renderInline } from "./rich-text.js?v=5.05";
import { GENDERS } from "./limits.js?v=5.05";
import { askChoice, modalClose } from "./ui-modal.js?v=5.05";
export { artistStripHtml } from "./artist-strip.js?v=5.05";

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

// Beskrivelser (artist, sjanger, kobling, innovasjon) rendres som markdown-
// light gjennom den DELTE parseren, samme som historiene og innholdssidene.
// Uten link-kontekst blir teksten fortsatt escapet — linkifyAll escaper alt
// den slipper gjennom, også når den ikke finner noe å lenke.
//
// Utdata er blokk-html. Alle kallsteder MÅ legge den i en <div class="… rt">,
// ikke i en <p> (se toppen av rich-text.js).
export function linkDesc(text, lc) {
  return renderRichText(text, lc || {});
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

// Lærerens Rediger-ikon i sjanger-modalens hode (#sj-extra). Samme ikonknapp
// som artistkortene bruker — sjanger-/undersjanger-popupen hadde før en
// tekstknapp «Rediger» nederst i kroppen, som var den eneste flaten i appen
// der redigering ikke så ut som redigering.
//
// Beholderen tømmes ALLTID først: #modal-sjanger gjenbrukes av sjanger-,
// undersjanger- OG koblingsvisningen, så uten dette ville knappen fra forrige
// popup blitt stående og redigert feil sjanger. Uten onEdit (student,
// slektstresiden) blir hodet stående tomt.
export function renderGenreEditBtn(root, onEdit) {
  const extra = root.querySelector("#sj-extra");
  if (!extra) return;
  extra.innerHTML = onEdit
    ? `<button type="button" class="icon-btn sj-edit-btn" title="Rediger" aria-label="Rediger">${ICONS.edit}</button>`
    : "";
  const btn = extra.querySelector(".sj-edit-btn");
  if (btn) btn.addEventListener("click", onEdit);
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

// Podkast-episodekort — ett enkelt kort. Begge listene (podkastfanen i
// explore-instrument.js og lærer-admin i teacher-content.js) tegnes gjennom
// renderPodcastList under, så markupen ikke driver fra hverandre. `admin`
// legger rediger + slett HELT TIL HØYRE i tittelraden, over avspilleren;
// kalleren kobler lytterne (data-pod-edit / data-pod-delete).
function podcastEpisodeHtml(ep, { admin = false } = {}) {
  const duration = ep.duration ? `<span class="podkast-duration">(${escapeHtml(ep.duration)})</span>` : "";
  const desc = ep.description ? `<div class="podkast-desc rt">${renderRichText(ep.description)}</div>` : "";
  // Normaliseres HER, ikke bare når læreren lagrer, så episoder som allerede
  // ligger i Firestore med en gammel «dl=1»-lenke spiller av på iOS med én gang
  // — uten at noen må redigere dem på nytt.
  const audio = dropboxDirectUrl(ep.audioUrl);
  const id = escapeHtml(ep.id);
  return `
    <article class="podkast-episode" data-pod-id="${id}">
      <div class="podkast-header">
        <h3 class="podkast-title">${escapeHtml(ep.title || "Uten tittel")}</h3>
        ${duration}
        ${admin ? `<div class="podkast-actions">
          <button class="icon-btn" data-pod-edit="${id}" title="Rediger" aria-label="Rediger">${ICONS.edit}</button>
          <button class="icon-btn danger" data-pod-delete="${id}" title="Slett" aria-label="Slett">${ICONS.trash}</button>
        </div>` : ""}
      </div>
      ${desc}
      ${audio ? `<audio controls preload="none" src="${escapeHtml(audio)}"></audio>` : ""}
    </article>`;
}

// Tegner episodelista i `el`. To ting skjer utover en vanlig innerHTML:
//
//  1. Er lista uendret, røres DOM-en IKKE. Det er dette som gjør at en episode
//     som spiller fortsetter å spille når instrumenter-kortet lukkes og åpnes
//     igjen: et ferskt <audio>-element ville startet på null, og å sette det i
//     gang igjen fra kode er uansett blokkert av iOS' autoplay-sperre — play()
//     teller bare rett etter et brukertrykk.
//  2. Må lista likevel bygges på nytt (læreren redigerer mens noen lytter),
//     FLYTTES elementet som spiller over i det nye kortet framfor å erstattes.
//     Flyttingen skjer synkront i samme steg: en nettleser pauser et
//     medieelement som er tatt ut av dokumentet, men først ved neste stabile
//     tilstand — er det tilbake i DOM-en innen den tid, spiller lyden videre
//     uten et hakk.
export function renderPodcastList(el, episodes, { admin = false, empty = "" } = {}) {
  const sig = JSON.stringify([admin, episodes.map((ep) =>
    [ep.id, ep.title, ep.description, ep.duration, ep.audioUrl])]);
  if (el.dataset.podSig === sig) return false;

  // Bare spillere som faktisk er i gang bevares. En urørt spiller skal bygges
  // på nytt, ellers ville en rettet lenke aldri slått gjennom.
  const iGang = new Map();
  for (const a of el.querySelectorAll("audio")) {
    if (a.paused && !a.currentTime) continue;
    const id = a.closest(".podkast-episode")?.dataset.podId;
    if (id) iGang.set(id, a);
  }

  el.innerHTML = episodes.length
    ? episodes.map((ep) => podcastEpisodeHtml(ep, { admin })).join("")
    : empty;
  el.dataset.podSig = sig;

  for (const [id, gammel] of iGang) {
    const ny = el.querySelector(`.podkast-episode[data-pod-id="${CSS.escape(id)}"] audio`);
    // Kun når kilden er den samme — er lydlenken endret, SKAL den nye brukes,
    // selv om det koster avspillingen.
    if (ny && ny.getAttribute("src") === gammel.getAttribute("src")) ny.replaceWith(gammel);
  }
  return true;
}

// Tegnteller under et tekstfelt med tak. `max` = 0/null slår den AV igjen
// (feltet deles av flere tekster, og bare noen av dem har tak).
//
// Feltet stopper selv på maxlength, men uten en synlig teller merker man ikke
// at det har sluttet å ta imot: man skriver videre, og tegnene forsvinner
// stille. Telleren farges når man nærmer seg, og rødt når taket er nådd.
// `tellerEl` sendes inn når telleren IKKE kan settes rett etter feltet: i
// lærerens innholdseditor ligger #se-text i et to-kolonners grid, og et
// injisert element der ville blitt en tredje rute og dyttet forhåndsvisningen
// ned på neste rad.
export function wireCharCount(ta, max, tellerEl = null) {
  if (!ta) return;
  let teller = tellerEl
    || (ta.nextElementSibling?.classList?.contains("char-count") ? ta.nextElementSibling : null);
  if (!max) {
    ta.removeAttribute("maxlength");
    if (tellerEl) { tellerEl.textContent = ""; tellerEl.hidden = true; }
    else teller?.remove();
    return;
  }
  ta.maxLength = max;
  if (!teller) {
    teller = document.createElement("p");
    teller.className = "char-count";
    ta.insertAdjacentElement("afterend", teller);
  }
  teller.hidden = false;
  const tegn = () => {
    const n = ta.value.length;
    teller.textContent = `${n} / ${max} tegn`;
    teller.classList.toggle("naer-taket", n >= max * 0.9 && n < max);
    teller.classList.toggle("pa-taket", n >= max);
  };
  // Feltet kan være det samme elementet ved neste åpning (lærerens editor), så
  // lytteren kobles bare én gang — telleren tegnes uansett på nytt.
  if (!ta.dataset.charCountWired) {
    ta.dataset.charCountWired = "1";
    ta.addEventListener("input", tegn);
  }
  tegn();
}

// Episoden som spiller akkurat nå i `el`, eller null. Pauset OG ferdigspilt
// teller som «spiller ikke»: ingen av delene skal utløse et spørsmål.
export function playingEpisodeIn(el) {
  if (!el) return null;
  return [...el.querySelectorAll("audio")].find((a) => !a.paused && !a.ended) || null;
}

// «Stopp eller fortsett?» ved lukking av en podkastspiller. Kobles som
// _beforeClose på modalen (se ui-modal.js), så den dekker alle lukkeveiene:
// ✕, ←, «Lukk alle», Escape og klikk på bakgrunnen.
//
// Returnerer true når ingenting spiller (lukk som normalt). Spiller noe,
// returneres false og dialogen tar over: den lukker modalen selv når
// studenten har svart. Escape og bakgrunnsklikk i dialogen betyr «fortsett» —
// lukkingen var det brukeren ba om, og å la lyden gå er det ufarlige valget.
export function askBeforeClosingPlayer(listEl, modal) {
  const lyd = playingEpisodeIn(listEl);
  if (!lyd) return true;
  const tittel = lyd.closest(".podkast-episode")?.querySelector(".podkast-title")?.textContent?.trim();
  askChoice({
    title: "Episoden spiller fortsatt",
    text: tittel
      ? `«${tittel}» spiller nå. Vil du at den skal fortsette mens du bruker resten av appen?`
      : "Episoden spiller nå. Vil du at den skal fortsette mens du bruker resten av appen?",
    buttons: [
      { value: "stopp", label: "Stopp episoden", className: "ghost" },
      { value: "fortsett", label: "Fortsett å spille", className: "primary" },
    ],
    dismissValue: "fortsett",
  }).then((svar) => {
    if (svar === "stopp") lyd.pause();
    modal._skipBeforeClose = true;
    modalClose(modal);
  });
  return false;
}

// Kobler «stopp eller fortsett»-spørsmålet på en modal som inneholder en
// podkastliste. Idempotent, så den kan kalles ved hver åpning.
export function wirePlayerCloseGuard(modal, listId) {
  if (!modal || modal._podLukkKlar) return;
  modal._podLukkKlar = true;
  modal._beforeClose = () => askBeforeClosingPlayer(document.getElementById(listId), modal);
}

// Lyd som ikke lar seg spille av: de innebygde kontrollene sier bare «Feil»,
// uten å antyde hva man gjør med det. Vi legger en forklaring og en
// direktelenke under spilleren i stedet. error bobler ikke fra medieelementer,
// så lytteren må stå i capture-fasen — samme grep som bilde-fallbacken over.
if (typeof document !== "undefined") {
  document.addEventListener("error", (e) => {
    const a = e.target;
    if (!(a instanceof HTMLAudioElement)) return;
    const kort = a.closest(".podkast-episode");
    if (!kort || kort.querySelector(".podkast-feil")) return;
    const url = safeUrl(a.getAttribute("src"));
    const p = document.createElement("p");
    p.className = "podkast-feil";
    p.innerHTML = "Episoden kunne ikke spilles av her." +
      (url ? ` <a href="${escapeHtml(url)}" target="_blank" rel="noopener">Åpne lydfila i ny fane</a>` : "");
    a.insertAdjacentElement("afterend", p);
  }, true);
}

function yearLabel(w) {
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

// Delt musikkeksempel-liste (brukt av detalj-, spotlight- og artistkort).
// Samme inline-format som «Sentrale verk»: understreket lenke + årstall i
// parentes utenfor lenka, komma-separert. Callerne setter «Lytteeksempler:»
// i fet skrift foran (jf. keyWorksText / .works-avsnittet).
export function musicExamplesHtml(a) {
  const items = (a.musicExamples || []).filter((m) => safeUrl(m.url));
  if (!items.length) return "";
  return items.map((m) => {
    const label = escapeHtml(m.label || "Lytt");
    const url = escapeHtml(safeUrl(m.url));
    return `<a href="${url}" target="_blank" rel="noopener">${label}</a>${musicExampleLabel(m)}`;
  }).join(", ");
}

// Beslektede artister — utledet naboliste for «oppdag ny musikk». Rangerer
// andre synlige artister på musikalsk slektskap (delte sjangre/undersjangre,
// samme metasjanger som lett bonus) med nærhet i tid som tiebreaker. Krever
// minst én delt sjanger eller undersjanger, så lista aldri blir tilfeldig.
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
          return `<button type="button" class="related-chip" data-related-id="${escapeHtml(String(r.id))}">${escapeHtml(r.name)}</button>`;
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

// Tiårstekstene ble skrevet FØR appen kunne formatere: ett punkt per linje,
// uten noen markering, og formatInfoText gjorde hver linje til et kulepunkt.
// Elleve slike felter ligger fortsatt i Firestore (alle «teknologi»-feltene fra
// 1900 til 2000), og de skal fortsatt se ut som lister. Regelen er smal med
// vilje: flere linjer, ingen blank linje mellom dem, og ingen blokkmarkering i
// noen av dem. Setter læreren inn et «- », en tom linje eller en mellomtittel,
// tar den vanlige parseren over. Returnerer linjene, eller null.
function gammelLinjeliste(text) {
  if (/\n\s*\n/.test(text)) return null;
  const linjer = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (linjer.length < 2) return null;
  if (linjer.some((l) => /^(#{1,6}|[-•–]|\d+[.)])\s/.test(l))) return null;
  return linjer;
}

// Tiårenes samfunns- og teknologitekst (og «les mer»-modalen deres).
export function formatInfoText(text, lc) {
  if (!text) return "";
  const gammel = gammelLinjeliste(String(text));
  if (gammel) return `<ul>${gammel.map((l) => `<li>${renderInline(l, lc)}</li>`).join("")}</ul>`;
  return renderRichText(text, lc);
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
//
// Innflytelsesperioden som tidslinje (artistStripHtml) sto her i v4.84, men
// hører hjemme rett under sjanger-/instrumentboblene, altså like over
// beskrivelsen. Den kalles derfor fra hver av de tre kort-mallene i ui.js —
// samme tre som kaller denne.
export function factsLines(a, { showGender = false } = {}) {
  const rows = [];
  if (a.birthYear && a.deathYear) rows.push(["Levetid", `${a.birthYear}–${a.deathYear}`]);
  else if (a.birthYear) rows.push(["Levetid", `${a.birthYear}–`]);
  else if (a.deathYear) rows.push(["Levetid", `?–${a.deathYear}`]);
  // «ca.» gjelder HELE perioden, ikke bare enkeltåret: innflytelsesårene er
  // skjønnsmessige anslag, ikke datofestede fakta, og et bart «1955–1970» leses
  // som en presisjon feltet ikke har.
  if (a.influenceStart) {
    const p = (!a.influenceEnd || a.influenceEnd === a.influenceStart)
      ? `${a.influenceStart}`
      : `${a.influenceStart}–${a.influenceEnd}`;
    rows.push(["Innflytelse", `ca. ${p}`]);
  }
  if (a.recordLabel) rows.push(["Plateselskap", a.recordLabel]);
  if (showGender) rows.push(["Kjønn", GENDER_LABEL[a.gender] || "Ukjent"]);
  if (a.geography) rows.push(["Virkested", a.geography]);
  return factsHtml(rows);
}

// Delt renderer for «etikett: verdi»-linjene. Fet etikett, vanlig verdi —
// samme form på artistkort og innovasjonskort.
function factsHtml(rows) {
  const fylte = rows.filter(([, v]) => v != null && String(v).trim() !== "");
  if (!fylte.length) return "";
  // Tredje element gjør verdien klikkbar: { attr } settes som data-attributt med
  // verdien selv, og kalleren kobler lytteren (delegert i explore.js). Attributt-
  // navnet kommer fra koden, aldri fra data.
  return `<div class="facts">${fylte.map(([l, v, lenke]) => {
    const tekst = escapeHtml(String(v));
    const verdi = lenke
      ? `<button type="button" class="facts-link" ${lenke.attr}="${tekst}">${tekst}</button>`
      : tekst;
    return `<p><strong>${escapeHtml(l)}:</strong> ${verdi}</p>`;
  }).join("")}</div>`;
}

// Faktalinjer på innovasjonskortet. Erstattet fargede bobler (v3.81), så
// kortene leser likt som artistkortenes levetid/innflytelse. «Tatt i bruk»
// bærer adoptedLabel, som ofte er en hel setning og aldri fikk plass i en
// boble (het «Årstall» fram til v4.82).
export function techFactsLines(t) {
  return factsHtml([
    // Typen vises kun på hendelseskort — innovasjon er normalen og trenger
    // ingen etikett. Hendelser har til gjengjeld ingen kategori.
    ["Type", t?.type === "hendelse" ? "Viktig hendelse" : ""],
    // Kategori og instrument er klikkbare: de fører til henholdsvis
    // Teknologi-seksjonen filtrert på kategorien, og Instrumenter-seksjonen
    // på det instrumentet. (Boblene de erstattet var rene spans — dette er ny
    // funksjonalitet, ikke gjenoppretting.)
    ["Kategori", t.category, { attr: "data-tech-cat" }],
    ["Instrument", t.instrument, { attr: "data-tech-instr" }],
    ["Oppfunnet", t.inventedYear],
    ["Tatt i bruk", t.adoptedLabel],
  ]);
}

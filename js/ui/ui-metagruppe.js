// ============================================================================
//  METAGRUPPENE I UTFORSK-LISTENE
// ----------------------------------------------------------------------------
//  Gruppehodet med farget prikk, akkordeonen og lenken til metasjangerens
//  oversikt, delt av varmekartet, tidslinja, periodene, referansene og
//  Sjangre (før duplisert i varmekart og tidslinje). Én kilde, så akkordeonen
//  og fargevalgene aldri driver fra hverandre. (Lå i explore-context.js til og
//  med v6.28.)
// ============================================================================
import { escapeHtml } from "../felles/util.js";
import { MAIN_GENRE_INFO, FAMILIES, GENEALOGY_META_GENRES } from "../sjangre/genre-model.js";

// Representativ familiefarge for en gruppe = den hyppigste i gruppa.
export const groupColor = (labels) => {
  const tally = {};
  for (const l of labels) { const c = MAIN_GENRE_INFO[l]?.color; if (c) tally[c] = (tally[c] || 0) + 1; }
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || FAMILIES.gray?.stroke || "#9bada1";
};

// Gruppehode for meta-akkordeonen (varmekart + tidslinje): caret + farget prikk
// + metanavn + en fritekst-telling. `prefix` gir klassenavnene (vk/tid),
// `metaAttr` legger et evt. data-attributt på wrapperen (varmekartet bruker det
// til å huske hvilken gruppe som står åpen). Åpner .${prefix}-group + knappen —
// kalleren legger til .${prefix}-group-rows etterpå, som før.
// `dot: false` dropper den fargede prikken (Referanser-kortet: der bærer
// seksjonsoverskriften fargen, og en prikk per linje ble bare støy).
export function metaGroupHeadHtml({ prefix, meta, gColor, open, groupIdx, count, metaAttr = "", dot = true }) {
  let h = `<div class="${prefix}-group"${metaAttr}>`;
  h += `<button type="button" class="${prefix}-group-head" aria-expanded="${open}" style="width:100%;display:flex;align-items:center;gap:9px;margin:${groupIdx === 0 ? "6px" : "10px"} 0 6px;padding:4px 0 5px;border:0;border-bottom:2px solid ${gColor}40;background:none;cursor:pointer;text-align:left">`;
  h += `<span class="${prefix}-caret" style="flex:none;width:12px;font-size:0.7rem;color:var(--muted);transition:transform .15s;transform:rotate(${open ? 90 : 0}deg)">▶</span>`;
  if (dot) h += `<span style="width:12px;height:12px;border-radius:50%;background:${gColor};flex:none;box-shadow:0 0 0 3px ${gColor}22"></span>`;
  h += `<span style="font-size:0.84rem;font-weight:700;color:var(--text)">${escapeHtml(meta)}</span>`;
  h += `<span style="font-size:0.72rem;color:var(--muted)">${count}</span>`;
  h += `</button>`;
  return h;
}

// Lenken til metasjangerens oversikt (v6.05, strukturgjennomgangen S2), øverst
// i en åpen gruppe i tidslinja, varmekartet og periodene. Ikke i gruppehodet:
// det er selv en knapp, og en knapp kan ikke ligge i en knapp. Klikket fanges
// av den delegerte [data-meta-oversikt]-lytteren i explore.js. Metasjangre
// som ikke finnes i treet (f.eks. «Andre») får ingen lenke.
export function metaOversiktLenkeHtml(meta) {
  const knapp = metaOversiktKnappHtml(meta, { klasse: "meta-oversikt-lenke" });
  return knapp ? `<div class="meta-oversikt-rad">${knapp}</div>` : "";
}

// Selve lenkeknappen, delt med familiehodene i Sjangre (v6.23): samme regel
// for hvilke metasjangre som har en oversikt. `kort` gir bare «Oversikt ›»,
// der navnet står rett ved siden av (familiehodet i en smal spalte).
export function metaOversiktKnappHtml(meta, { kort = false, klasse = "meta-oversikt-lenke" } = {}) {
  if (!GENEALOGY_META_GENRES.includes(meta)) return "";
  return `<button type="button" class="${klasse}" data-meta-oversikt="${escapeHtml(meta)}">${kort ? "Oversikt" : `Oversikt over ${escapeHtml(meta)}`} <span aria-hidden="true">›</span></button>`;
}

// Delt akkordeon-klikklogikk: én gruppe åpen om gangen (klikk på åpen gruppe
// lukker den). `onToggle(wasOpen, group)` kalles før omtegningen — varmekartet
// bruker den til å huske åpen gruppe; tidslinjen dropper den.
export function wireMetaAccordion(body, prefix, onToggle) {
  body.querySelectorAll(`.${prefix}-group-head`).forEach((head) => {
    head.addEventListener("click", () => {
      const wasOpen = head.getAttribute("aria-expanded") === "true";
      if (onToggle) onToggle(wasOpen, head.closest(`.${prefix}-group`));
      body.querySelectorAll(`.${prefix}-group`).forEach((grp) => {
        const h = grp.querySelector(`.${prefix}-group-head`);
        const rows = grp.querySelector(`.${prefix}-group-rows`);
        const isThis = h === head && !wasOpen;
        h.setAttribute("aria-expanded", isThis ? "true" : "false");
        const caret = h.querySelector(`.${prefix}-caret`);
        if (caret) caret.style.transform = `rotate(${isThis ? 90 : 0}deg)`;
        if (rows) rows.style.display = isThis ? "block" : "none";
      });
    });
  });
}

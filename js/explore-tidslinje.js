// ============================================================================
//  TIDSLINJE: når var artistene aktive?
// ----------------------------------------------------------------------------
//  Flyttet ut av explore.js (v3.54). Den delte kjernen (opts, getState) og de
//  de-dupliserte hjelperne (groupColor, metaGroupHeadHtml, wireMetaAccordion)
//  kommer fra explore-context.js; sjangervokabularet fra genre-model.js.
// ============================================================================
import { escapeHtml, modalOpen } from "./ui.js?v=6.17";
import { isVisible } from "./limits.js?v=6.17";
import { META_GENRE_ORDER, META_GENRE_COLOR, MAIN_GENRE_INFO, FAMILIES, canonMainGenre } from "./genre-model.js?v=6.17";
import { resolveSpan, packLanes, timelineBounds } from "./timeline-lanes.js?v=6.17";
import { imgTag, safeUrl } from "./ui-helpers.js?v=6.17";
import { opts, getState, groupColor, metaGroupHeadHtml, wireMetaAccordion, metaOversiktLenkeHtml } from "./explore-context.js?v=6.17";

// ----------------------------------------------------------------------------
//  Artisttidslinje: når var artistene aktive? Pakket bane-tidslinje gruppert
//  etter artistens eget metasjangerfelt (S5, v6.05) og deretter per
//  tre-sjanger, i metasjanger-akkordeon (samme mønster og fargespråk som
//  varmekartet). Hver sjangerseksjon har i tillegg sin egen trekant og starter
//  lukket, så en åpen metagruppe først viser en ryddig sjangerliste med antall.
//  `focus` er valgfritt: { genre } åpner den metagruppen + seksjonen og
//  scroller dit; { artistId } åpner artistens gruppe/seksjoner og uthever
//  blokkene. Banepakkingen bor i timeline-lanes.js (enhetstestet).
// ----------------------------------------------------------------------------
// Hover-kortet på tidslinjens blokker: artistbildet (i sitt eget format — samme
// som sjangerhimmelen), navnet og aktiv-perioden. Ett kort om gangen, festet til
// <body> med position:fixed, så modalens scroll-boks ikke klipper det.
let tidTip = null;

export function hideTidTip() {
  tidTip?.remove();
  tidTip = null;
}

function showTidTip(bar, artist) {
  hideTidTip();
  if (!artist) return;
  const url = safeUrl(artist.imageUrl);
  const tip = document.createElement("div");
  tip.className = "tid-tip";
  tip.innerHTML =
    (url ? imgTag(url, artist.name || "", 250) : "") +
    `<div class="tid-tip-name">${escapeHtml(artist.name || "")}</div>` +
    `<div class="tid-tip-years">aktiv ${escapeHtml(bar.dataset.years || "")}</div>`;
  document.body.appendChild(tip);

  // Bildefeil: den globale fallbacken (ui-helpers) bytter først til originalen.
  // Feiler DEN også — eller finnes ingen fallback å bytte til — fjerner vi bildet
  // og lar kortet stå med navn og periode, i stedet for nettleserens
  // «bilde mangler»-ikon.
  // Over blokka og sentrert på den; ned under hvis det ikke er plass over, og
  // alltid innenfor vinduet i bredden.
  const place = () => {
    const b = bar.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const left = Math.max(8, Math.min(b.left + b.width / 2 - t.width / 2, window.innerWidth - t.width - 8));
    const top = b.top - t.height - 8 < 8 ? b.bottom + 8 : b.top - t.height - 8;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  };

  const im = tip.querySelector("img");
  im?.addEventListener("error", () => {
    if (im.dataset.tipRetried || !im.dataset.full) im.remove();
    else im.dataset.tipRetried = "1";
    place();   // kortet krympet uten bilde — reposisjoner
  });
  // Bildet er lazy: måles kortet før det lander, plasseres det på tekst-høyden
  // og vokser etterpå NED over blokka. Reposisjoner når bildet er inne.
  im?.addEventListener("load", place);

  place();
  tidTip = tip;
}


export function openTidslinje(focus = {}) {
  const modal = document.getElementById("modal-tidslinje");
  if (!modal) return;
  hideTidTip();
  const body = document.getElementById("tid-body");
  const s = getState();
  const nowYear = new Date().getFullYear();
  const active = s.artists.filter(isVisible);

  // Gruppene er artistenes EGET metasjangerfelt (v6.05, brukervalg 2026-10-03,
  // strukturgjennomgangen S5), ikke familien til sjangrene de er tagget med.
  // Da teller tidslinja det samme som metasjanger-oversikten og filtrene: før
  // sto Jazz med 96 artister her og 94 der. Inni gruppa får artisten én
  // seksjon per tre-sjanger hen er tagget med: metasjangerens egne sjangre
  // først, så sjangre fra andre familier (rock'n'roll-artistene står under
  // R&B, Country og Gospel), og til slutt de uten tre-sjanger. ALLE synlige
  // artister med startår er med; en metasjanger uten egne artister (Rock)
  // får ingen gruppe her, men står i alt som tegnes av treet.
  const UTEN = " uten";  // seksjonsnøkkel for artister uten tre-sjanger; kolliderer aldri med sjangernavn
  const groups = new Map();   // metasjanger → Map(seksjonsnøkkel → blokker)
  const sectionsPerArtist = new Map();
  for (const a of active) {
    const span = resolveSpan(a, nowYear);
    if (!span) continue;
    const meta = a.metaGenre || "Andre";
    const genres = [...new Set((a.mainGenre || [])
      .map((g) => canonMainGenre(g))
      .filter(Boolean))];
    // Bare metasjangerens egne sjangre (v6.11, brukervalg 2026-10-03): en
    // artist med sjangre fra andre familier står bare under sine egne, og en
    // artist med BARE fremmede sjangre tas ut av tidslinja. Artister uten
    // noen tre-sjanger samles i «Uten sjanger i treet».
    const egne = genres.filter((g) => MAIN_GENRE_INFO[g]?.meta === meta);
    const keys = egne.length ? egne : genres.length ? [] : [UTEN];
    if (!keys.length) continue;
    if (!groups.has(meta)) groups.set(meta, new Map());
    const secs = groups.get(meta);
    for (const key of keys) {
      if (!secs.has(key)) secs.set(key, []);
      secs.get(key).push({ id: a.id, name: a.name || "(uten navn)", span });
    }
    sectionsPerArtist.set(a.id, keys.length);
  }

  if (!groups.size) {
    body.innerHTML = `<p class="muted">Ingen artister med startår ennå.</p>`;
    modalOpen(modal);
    return;
  }

  // Metasjangrene i appens ene rekkefølge (META_GENRE_ORDER); ukjente bakerst.
  const metaOrder = [...META_GENRE_ORDER, ...[...groups.keys()].filter((m) => !META_GENRE_ORDER.includes(m))];
  const metaRang = (key) => {
    const i = META_GENRE_ORDER.indexOf(MAIN_GENRE_INFO[key]?.meta);
    return i < 0 ? 99 : i;
  };
  // Seksjonene i én gruppe: egne sjangre, så fremmede sjangre (i metasjanger-
  // rekkefølgen), så «uten sjanger i treet»; innenfor hver bolk etter første
  // startår.
  const ordneSeksjoner = (meta, secs) => {
    const earliest = (k) => Math.min(...secs.get(k).map((i) => i.span.start));
    const bolk = (k) => (k === UTEN ? 2 : MAIN_GENRE_INFO[k]?.meta === meta ? 0 : 1);
    return [...secs.keys()].sort((a, b) =>
      bolk(a) - bolk(b) || (bolk(a) === 1 ? metaRang(a) - metaRang(b) : 0)
      || earliest(a) - earliest(b) || a.localeCompare(b, "no"));
  };

  // Felles tidsakse over alt innhold, i hele tiår.
  const allSpans = [...groups.values()].flatMap((secs) => [...secs.values()].flat()).map((i) => i.span);
  const { y0, y1 } = timelineBounds(allSpans, nowYear);
  const pctOf = (y) => ((y - y0) / (y1 - y0)) * 100;
  const decades = [];
  for (let d = y0; d <= y1 - 10; d += 10) decades.push(d);

  const gridHtml = decades.map((d) =>
    `<div style="position:absolute;top:0;bottom:0;left:${pctOf(d).toFixed(2)}%;width:1px;background:var(--line)"></div>`).join("");
  const axisHtml = `<div style="position:relative;height:16px;margin-bottom:4px">` + decades.map((d) =>
    `<span style="position:absolute;left:${pctOf(d).toFixed(2)}%;font-size:0.68rem;color:var(--muted);transform:translateX(-3px)">${d}</span>`).join("") + `</div>`;

  // Fokus: hvilken metagruppe skal stå åpen? (standard: den første). En
  // sjanger åpner sin egen metasjanger når den har en seksjon der, ellers den
  // første gruppa som har den (Rock'n'roll har ingen Rock-gruppe å åpne).
  const focusGenre = focus.genre ? (canonMainGenre(focus.genre) || focus.genre) : null;
  let focusMeta = null;
  if (focusGenre) {
    const egen = MAIN_GENRE_INFO[focusGenre]?.meta;
    focusMeta = egen && groups.get(egen)?.has(focusGenre) ? egen
      : metaOrder.find((m) => groups.get(m)?.has(focusGenre)) || null;
  }
  if (!focusMeta && focus.artistId) {
    const a = active.find((x) => x.id === focus.artistId);
    if (a && groups.has(a.metaGenre || "Andre")) focusMeta = a.metaGenre || "Andre";
  }

  let html = `<div style="overflow-x:auto"><div style="min-width:720px">` + axisHtml;
  let groupIdx = 0;
  for (const meta of metaOrder) {
    const secs = groups.get(meta);
    if (!secs) continue;
    const keys = ordneSeksjoner(meta, secs);
    const gColor = META_GENRE_COLOR[meta] || groupColor(keys.filter((k) => k !== UTEN));
    const open = focusMeta ? meta === focusMeta : groupIdx === 0;
    const artistCount = new Set([...secs.values()].flat().map((i) => i.id)).size;

    html += metaGroupHeadHtml({
      prefix: "tid", meta, gColor, open, groupIdx,
      count: `${artistCount} artist${artistCount === 1 ? "" : "er"}`,
      metaAttr: ` data-tid-meta="${escapeHtml(meta)}"`,
    });
    groupIdx++;

    html += `<div class="tid-group-rows" style="display:${open ? "block" : "none"}">${metaOversiktLenkeHtml(meta)}`;
    for (const key of keys) {
      const isUten = key === UTEN;
      const label = isUten ? "Uten sjanger i treet" : key;
      const rowColor = isUten ? FAMILIES.gray?.stroke || "#9bada1" : (MAIN_GENRE_INFO[key]?.color || gColor);
      const secItems = secs.get(key);
      const lanes = packLanes(secItems);
      const secCount = new Set(secItems.map((i) => i.id)).size;
      // Seksjonene starter lukket; fokus åpner den relevante (sjanger-inngang
      // treffer én seksjon, artist-inngang alle seksjonene artisten står i).
      const secOpen = focusGenre ? key === focusGenre
        : focus.artistId ? secItems.some((i) => i.id === focus.artistId)
        : false;
      html += `<div class="tid-section" data-genre="${escapeHtml(isUten ? "" : key)}" style="margin:0 0 10px">`;
      html += `<button type="button" class="tid-sec-head" aria-expanded="${secOpen}" style="width:100%;display:flex;align-items:center;gap:7px;margin-bottom:4px;padding:1px 8px;border:0;border-left:3px solid ${rowColor};background:none;cursor:pointer;text-align:left">`;
      html += `<span class="tid-sec-caret" style="flex:none;width:12px;font-size:0.7rem;color:var(--muted);transition:transform .15s;transform:rotate(${secOpen ? 90 : 0}deg)">▶</span>`;
      html += `<span style="font-size:0.8rem;color:var(--text)">${escapeHtml(label)}</span>`;
      html += `<span style="font-size:0.72rem;color:var(--muted)">${secCount} artist${secCount === 1 ? "" : "er"}</span>`;
      html += `</button>`;
      html += `<div class="tid-sec-rows" style="display:${secOpen ? "block" : "none"}">`;
      html += `<div style="position:relative;height:${lanes.length * 25}px">${gridHtml}`;
      lanes.forEach((lane, li) => {
        for (const it of lane) {
          const left = pctOf(it.span.start);
          const width = Math.max(pctOf(it.visualEnd) - left, 1.2);
          const openEnd = it.span.open;
          const multi = (sectionsPerArtist.get(it.id) || 1) > 1;
          const yearsTxt = `${it.span.start}${openEnd ? " → pågår / sluttår ikke satt" : "–" + it.span.end}`;
          // aria-label i stedet for title: hover-kortet (bilde + navn + periode)
          // tegnes selv, og nettleserens egen title-boble ville lagt seg oppå.
          // Perioden bæres videre i data-years, så kortet slipper å regne den ut på nytt.
          html += `<button type="button" class="tid-bar" data-artist-id="${escapeHtml(it.id)}"` +
            ` data-years="${escapeHtml(yearsTxt)}" aria-label="${escapeHtml(it.name)} · aktiv ${escapeHtml(yearsTxt)}" ` +
            `style="position:absolute;top:${li * 25 + 1}px;left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;height:21px;` +
            `background:${rowColor}24;border:1px solid ${rowColor}66;${openEnd ? "border-right:none;border-radius:5px 0 0 5px;" : "border-radius:5px;"}` +
            `font-size:0.72rem;line-height:19px;padding:0 6px;color:var(--text);text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer">` +
            `${escapeHtml(it.name)}${multi ? " ◆" : ""}${openEnd ? `<span style="position:absolute;right:2px;opacity:.7">›</span>` : ""}</button>`;
        }
      });
      html += `</div></div></div>`;
    }
    html += `</div></div>`;
  }
  html += `</div></div>`;

  // Forklaring
  html += `<div style="display:flex;align-items:center;gap:16px;margin-top:14px;font-size:0.78rem;color:var(--muted);flex-wrap:wrap">`;
  html += `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:26px;height:12px;border-radius:4px;background:var(--line);border:1px solid var(--line-strong)"></span>kjent aktiv-periode</span>`;
  html += `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:26px;height:12px;border-radius:4px 0 0 4px;background:var(--line);border:1px solid var(--line-strong);border-right:none"></span>› pågår / sluttår ikke satt</span>`;
  html += `<span>◆ artist i flere sjangre</span>`;
  html += `</div>`;

  body.innerHTML = html;

  // Akkordeon (samme oppførsel som varmekartet: én gruppe åpen om gangen).
  wireMetaAccordion(body, "tid");

  // Sjangerseksjonene har egne trekanter: uavhengige brytere (flere kan stå
  // åpne samtidig), i motsetning til metanivåets én-om-gangen-akkordeon.
  body.querySelectorAll(".tid-sec-head").forEach((head) => {
    head.addEventListener("click", () => {
      const open = head.getAttribute("aria-expanded") !== "true";
      head.setAttribute("aria-expanded", open ? "true" : "false");
      const caret = head.querySelector(".tid-sec-caret");
      if (caret) caret.style.transform = `rotate(${open ? 90 : 0}deg)`;
      const rows = head.parentElement.querySelector(".tid-sec-rows");
      if (rows) rows.style.display = open ? "block" : "none";
    });
  });

  // Klikk på blokk → artistkortet (samme inngang som resten av appen).
  // Hold musen over en blokk → hover-kort med bilde, navn og aktiv-periode
  // (samme idé som prikkene i sjangerhimmelen). Berøring hopper over det —
  // der er klikket hele poenget.
  // DELEGERT på beholderen (normen for store lister her, jf. Referanser-
  // kortet): tre lyttere per blokk ganger ~320 artister var ~1000 lytter-
  // objekter bygget og kastet per åpning. pointerover/-out med closest()
  // erstatter pointerenter/-leave per element.
  if (!body.dataset.tidBarsWired) {
    body.dataset.tidBarsWired = "1";
    const finnArtist = (bar) => getState().artists.find((x) => x.id === bar.dataset.artistId);
    body.addEventListener("click", (e) => {
      const bar = e.target.closest(".tid-bar");
      if (!bar) return;
      hideTidTip();
      const a = finnArtist(bar);
      if (a && opts.onArtistClick) opts.onArtistClick(a);
    });
    body.addEventListener("pointerover", (e) => {
      const bar = e.target.closest(".tid-bar");
      if (!bar || e.pointerType === "touch") return;
      if (bar.contains(e.relatedTarget)) return;
      showTidTip(bar, finnArtist(bar));
    });
    body.addEventListener("pointerout", (e) => {
      const bar = e.target.closest(".tid-bar");
      if (!bar || bar.contains(e.relatedTarget)) return;
      hideTidTip();
    });
  }
  // Kortet er position:fixed (så det aldri klippes av modalens scroll-boks) —
  // derfor må det bort når innholdet ruller under det. Modalen er varig
  // (injiseres én gang), mens openTidslinje kalles ved hver åpning — uten
  // vaktflagget ville hver åpning stablet enda en scroll-lytter.
  const scrollBoks = modal.querySelector(".modal");
  if (scrollBoks && !scrollBoks.dataset.tidScrollWired) {
    scrollBoks.dataset.tidScrollWired = "1";
    scrollBoks.addEventListener("scroll", hideTidTip);
  }

  modalOpen(modal);

  // Fokus: scroll til seksjonen/blokkene etter at modalen er synlig.
  if (focusGenre || focus.artistId) {
    requestAnimationFrame(() => {
      let target = null;
      // Samme sjanger kan stå i flere grupper (S5): let i den som er åpnet.
      if (focusGenre) {
        const gruppe = [...body.querySelectorAll(".tid-group")].find((g) => g.dataset.tidMeta === focusMeta);
        target = (gruppe || body).querySelector(`.tid-section[data-genre="${CSS.escape(focusGenre)}"]`);
      }
      if (focus.artistId) {
        body.querySelectorAll(`.tid-bar[data-artist-id="${CSS.escape(focus.artistId)}"]`).forEach((b) => {
          b.style.outline = `2px solid var(--accent, #2563eb)`;
          if (!target) target = b;
        });
      }
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
}

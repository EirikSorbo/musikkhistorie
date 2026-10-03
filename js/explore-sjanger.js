// ============================================================================
//  SJANGER-LISTER & INFO
// ----------------------------------------------------------------------------
//  Sjangre-/undersjangre-vinduene og sjanger-info-modalen (lærer-oversikten).
//  Flyttet ut av explore.js (v3.55, runde 2). Delt kjerne fra explore-context.js.
// ============================================================================
import { escapeHtml, modalOpen, modalClose } from "./ui.js?v=6.09";
import { isVisible } from "./limits.js?v=6.09";
import { isMainGenre, canonMainGenre, GENEALOGY, META_GENRE_ORDER, META_GENRE_COLOR } from "./genre-model.js?v=6.09";
import { resolveDesc, resolveDescAny, missingDesc } from "./genre-descriptions.js?v=6.09";
import { familieNyanse } from "./genre-periods.js?v=6.09";
import { opts, getState, injectTeacherRow } from "./explore-context.js?v=6.09";

// Sjangre-vinduet (v6.05, brukervalg 2026-10-03, strukturgjennomgangen S6):
// sjangrene gruppert per metasjanger, i appens ene rekkefølge, og innenfor
// hver familie i tidsrekkefølge med en liten periodestolpe i nyanser av
// familiefargen (D6). Før sto 43 like grønne bobler i alfabetisk rekkefølge,
// og familiene og fargene, som bærer resten av appen, var borte akkurat der.
// Metasjangerens navn fører til oversikten over den (S2).
//
// Radene bærer data-sjanger, så den delegerte lytteren i explore.js åpner
// sjangerkortet (samme rute som sjangerboblene på kortene).
const AKSE_FRA = 1900;

function familierData() {
  const s = getState();
  const active = s.artists.filter(isVisible);
  const naa = new Date().getFullYear();
  // Sjangre med minst én artist (tre-taggene, kanonisert som før).
  const medArtister = new Set(active.flatMap((a) => (a.mainGenre || [])
    .filter(isMainGenre).map((x) => canonMainGenre(x) || x)));
  return META_GENRE_ORDER.map((meta) => {
    const noder = GENEALOGY.filter((n) => n.g === meta).map((n, treIdx) => {
      const r = resolveDescAny(s.genreDescs || {}, [n.l, n.f], "main");
      const fra = Number.isInteger(r.activeFrom) ? r.activeFrom : null;
      const til = Number.isInteger(r.activeTo) ? r.activeTo : null;
      return { n, fra, til, treIdx };
    }).sort((a, b) => (a.fra ?? 9999) - (b.fra ?? 9999) || (a.til ?? 9999) - (b.til ?? 9999) || a.n.r - b.n.r || a.treIdx - b.treIdx);
    return {
      meta, farge: META_GENRE_COLOR[meta] || "#9bada1", noder,
      artister: active.filter((a) => a.metaGenre === meta).length,
      medArtister, naa,
    };
  }).filter((f) => f.noder.length);
}

function stolpeHtml(x, farge, i, n, naa) {
  if (x.fra === null) return `<span class="sj-spor" aria-hidden="true"></span>`;
  const spenn = naa - AKSE_FRA;
  const fra = Math.max(x.fra, AKSE_FRA);
  const til = Math.min(x.til ?? naa, naa);
  const venstre = Math.max(0, (fra - AKSE_FRA) / spenn * 100);
  const bredde = Math.max(2, (til - fra) / spenn * 100);
  return `<span class="sj-spor" aria-hidden="true"><i style="left:${venstre.toFixed(1)}%;width:${Math.min(bredde, 100 - venstre).toFixed(1)}%;background:${familieNyanse(farge, i, n)}"></i></span>`;
}

export function openSubgenreList() {
  const modal = document.getElementById("modal-subgenre-list");
  if (!modal) return;
  const checked = (opts.getCheckedState ? opts.getCheckedState() : null)?.genres || [];
  const familier = familierData();
  const el = document.getElementById("sl-chips");
  el.innerHTML = familier.length
    ? `<div class="sj-familier">${familier.map((f) => `<section class="sj-familie" style="--fam:${escapeHtml(f.farge)}">
        <div class="sj-fam-hode">
          <span class="sj-fam-prikk" aria-hidden="true"></span>
          <h3 class="sj-fam-navn">${escapeHtml(f.meta)}</h3>
          <span class="sj-fam-tall">${f.noder.length} sjang${f.noder.length === 1 ? "er" : "re"} · ${f.artister} artist${f.artister === 1 ? "" : "er"}</span>
          <button type="button" class="sj-fam-lenke" data-meta-oversikt="${escapeHtml(f.meta)}">Oversikt <span aria-hidden="true">›</span></button>
        </div>
        ${f.noder.map((x, i) => {
          const tom = !f.medArtister.has(x.n.l);
          const aar = x.fra === null ? "" : `${x.fra}–${x.til ?? "i dag"}`;
          return `<button type="button" class="sj-rad${tom ? " is-empty" : ""}${checked.includes(x.n.l) ? " is-checked" : ""}" data-sjanger="${escapeHtml(x.n.l)}"${tom ? ' title="Ingen artister ennå"' : ""}>
            <span class="sj-rad-navn">${escapeHtml(x.n.f || x.n.l)}${aar ? `<span class="sj-rad-aar">${aar}</span>` : ""}</span>
            ${stolpeHtml(x, f.farge, i, f.noder.length, f.naa)}
          </button>`;
        }).join("")}
      </section>`).join("")}</div>`
    : `<p class="muted">Ingen sjangre registrert ennå.</p>`;
  // Antallet undersjangre på knappen (den ble bygd før dataene landet).
  const ub = document.getElementById("btn-undersjangere");
  if (ub) ub.textContent = `Undersjangre (${undersjangre().length})`;
  modalOpen(modal);
}

// Undersjangrene: de frie taggene fra artistene. Hver tagg hører til den
// metasjangeren flest av artistene som bærer den har, så de kan stå i samme
// familiekort og farger som sjangrene (v6.05, S6).
function undersjangre() {
  const active = getState().artists.filter(isVisible);
  const tellinger = new Map();
  for (const a of active) {
    const tagger = new Set([...(a.mainGenre || []).filter((x) => !isMainGenre(x)), ...(a.subGenre || [])]);
    for (const t of tagger) {
      if (!tellinger.has(t)) tellinger.set(t, new Map());
      const m = tellinger.get(t);
      m.set(a.metaGenre || "Andre", (m.get(a.metaGenre || "Andre") || 0) + 1);
    }
  }
  return [...tellinger].map(([navn, m]) => {
    const [meta] = [...m].sort((x, y) => y[1] - x[1] || META_GENRE_ORDER.indexOf(x[0]) - META_GENRE_ORDER.indexOf(y[0]))[0];
    return { navn, meta, antall: [...m.values()].reduce((s, v) => s + v, 0) };
  });
}

export function openUndersjangre() {
  const modal = document.getElementById("modal-undersjangre");
  if (!modal) return;
  const checked = (opts.getCheckedState ? opts.getCheckedState() : null)?.subgenres || [];
  const alle = undersjangre();
  const metas = [...META_GENRE_ORDER, ...new Set(alle.map((u) => u.meta).filter((m) => !META_GENRE_ORDER.includes(m)))];
  const ulEl = document.getElementById("ul-chips");
  const grupper = metas.map((meta) => ({ meta, farge: META_GENRE_COLOR[meta] || "#9bada1",
    tagger: alle.filter((u) => u.meta === meta).sort((a, b) => a.navn.localeCompare(b.navn, "no")) }))
    .filter((g) => g.tagger.length);
  ulEl.innerHTML = grupper.length
    ? `<div class="sj-familier">${grupper.map((g) => `<section class="sj-familie" style="--fam:${escapeHtml(g.farge)}">
        <div class="sj-fam-hode">
          <span class="sj-fam-prikk" aria-hidden="true"></span>
          <h3 class="sj-fam-navn">${escapeHtml(g.meta)}</h3>
          <span class="sj-fam-tall">${g.tagger.length}</span>
        </div>
        ${g.tagger.map((u) => `<button type="button" class="sj-rad${checked.includes(u.navn) ? " is-checked" : ""}" data-under="${escapeHtml(u.navn)}">
          <span class="sj-rad-navn">${escapeHtml(u.navn)}</span><span class="sj-rad-aar">${u.antall}</span>
        </button>`).join("")}
      </section>`).join("")}</div>`
    : `<p class="muted">Ingen undersjangre registrert ennå.</p>`;

  modalOpen(modal);
}

// Sjanger-info-modalen: brukes av lærer-oversikten (data-ov-subinfo-radene,
// via explore-API-et) — under-chips i student-visningen går i stedet gjennom
// den delte showSubsjangerInfo (modal-sjanger).
export function openSubgenreInfo(subgenreId) {
  const modal = document.getElementById("modal-subgenre-info");
  if (!modal) return;
  modal.dataset.vis = `undersjanger:${subgenreId}`;   // «Kopier lenke» (v5.22)
  const s = getState();
  const resolved = resolveDesc(s.genreDescs, subgenreId, "sub");
  document.getElementById("sgi-title").textContent = subgenreId;
  const sgiDesc = document.getElementById("sgi-desc");
  sgiDesc.textContent = resolved.description || missingDesc("sub");
  sgiDesc.className = resolved.description ? "" : "gx-missing";

  const artists = s.artists
    .filter(a => isVisible(a) && ((a.subGenre || []).includes(subgenreId) || (a.mainGenre || []).includes(subgenreId)))
    .sort((a, b) => a.name.localeCompare(b.name, "no"));

  const el = document.getElementById("sgi-artists");
  if (!artists.length) {
    el.innerHTML = "";
  } else {
    el.innerHTML = `
      <button class="btn ghost small sgi-toggle" style="margin-top:12px">Artister (${artists.length})</button>
      <div class="sgi-list" style="display:none;margin-top:10px">
        ${artists.map(a => `<div class="result-row sgi-artist-row" data-id="${escapeHtml(a.id)}" tabindex="0" role="button">
          <span class="result-name">${escapeHtml(a.name)}</span>
          <span class="result-meta">
            ${a.metaGenre ? `<span class="tag">${escapeHtml(a.metaGenre)}</span>` : ""}
            ${a.instrument ? `<span class="tag">${escapeHtml(a.instrument)}</span>` : ""}
          </span>
          <span class="result-arrow">›</span>
        </div>`).join("")}
      </div>`;
    el.querySelector(".sgi-toggle").addEventListener("click", (e) => {
      const list = el.querySelector(".sgi-list");
      const visible = list.style.display !== "none";
      list.style.display = visible ? "none" : "block";
      e.target.textContent = visible ? `Artister (${artists.length})` : "Skjul artister";
    });
    // Klikk OG tastatur (tabindex + Enter/mellomrom) — samme mønster som den
    // delte artistlista (openArtistListModal); radene her var mus-only.
    el.querySelectorAll(".sgi-artist-row").forEach((row) => {
      const åpne = () => {
        const artist = artists.find(a => a.id === row.dataset.id);
        if (artist) opts.onArtistClick(artist);
      };
      row.addEventListener("click", åpne);
      row.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        åpne();
      });
    });
  }

  injectTeacherRow(document.getElementById("sgi-extra"), {
    category: "subgenres",
    id: subgenreId,
    onEdit: opts.onSubgenreEdit
      ? () => { modalClose(modal); opts.onSubgenreEdit(subgenreId, "sub"); }
      : null,
  });

  modalOpen(modal);
}

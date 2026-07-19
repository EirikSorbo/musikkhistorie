// ============================================================================
//  SJANGER-LISTER & INFO
// ----------------------------------------------------------------------------
//  Sjangre-/undersjangre-listene og sjanger-info-modalen (lærer-oversikten).
//  Flyttet ut av explore.js (v3.55, runde 2). Delt kjerne fra explore-context.js.
// ============================================================================
import { escapeHtml, modalOpen, modalClose } from "./ui.js?v=3.69";
import { isVisible } from "./limits.js?v=3.69";
import { isMainGenre, GENEALOGY_MAIN_GENRES } from "./genealogy.js?v=3.69";
import { resolveDesc, missingDesc } from "./genre-descriptions.js?v=3.69";
import { opts, getState, canonMain, injectTeacherRow } from "./explore-context.js?v=3.69";

export function openSubgenreList() {
  const modal = document.getElementById("modal-subgenre-list");
  if (!modal) return;
  const s = getState();
  const active = s.artists.filter(isVisible);
  const checkedState = opts.getCheckedState ? opts.getCheckedState() : null;

  // Tre-drevet: alle sjangre fra treet vises alltid. De artist-taggede er en
  // delmengde (isMainGenre), men tas med for sikkerhets skyld. Kanoniser til
  // treets stavemåte, ellers gir en fritekst-tagg som «blues» både en ekstra
  // chip OG at offisielle «Blues» feilaktig vises som tom.
  const withArtists = new Set(
    active.flatMap(a => (a.mainGenre || [])
      .filter(isMainGenre)
      .map(s => canonMain.get(s.toLowerCase()) || s))
  );
  const sjangre = [...new Set([...GENEALOGY_MAIN_GENRES, ...withArtists])]
    .sort((a, b) => a.localeCompare(b, "no"));
  const slEl = document.getElementById("sl-chips");
  const checkedMainGenres = checkedState?.genres || [];
  slEl.innerHTML = sjangre.length
    ? sjangre.map((s) => {
        const empty = !withArtists.has(s);
        return `<button class="tag tag-sjanger ${checkedMainGenres.includes(s) ? "is-checked" : ""}${empty ? " is-empty" : ""}" data-sjanger="${escapeHtml(s)}"${empty ? ' title="Ingen artister ennå"' : ""}>${escapeHtml(s)}</button>`;
      }).join("")
    : `<p class="muted">Ingen sjangere registrert ennå.</p>`;

  modalOpen(modal);
}

// Undersjangre: frie tags fra artistene, i egen modal oppå Sjangre-modalen
// (før en fane i samme modal — nå en egen inngang via «Undersjangere»-knappen).
export function openUndersjangre() {
  const modal = document.getElementById("modal-undersjangre");
  if (!modal) return;
  const s = getState();
  const active = s.artists.filter(isVisible);
  const checkedState = opts.getCheckedState ? opts.getCheckedState() : null;
  const under = [...new Set(active.flatMap(a => [
    ...(a.mainGenre || []).filter(x => !isMainGenre(x)),
    ...(a.subGenre || []),
  ]))].sort((a, b) => a.localeCompare(b, "no"));
  const ulEl = document.getElementById("ul-chips");
  const checkedSubs = checkedState?.subgenres || [];
  ulEl.innerHTML = under.length
    ? under.map((u) => `<button class="tag tag-under ${checkedSubs.includes(u) ? "is-checked" : ""}" data-under="${escapeHtml(u)}">${escapeHtml(u)}</button>`).join("")
    : `<p class="muted">Ingen undersjangre registrert ennå.</p>`;

  modalOpen(modal);
}

// Sjanger-info-modalen: brukes av lærer-oversikten (data-ov-subinfo-radene,
// via explore-API-et) — under-chips i student-visningen går i stedet gjennom
// den delte showSubsjangerInfo (modal-sjanger).
export function openSubgenreInfo(subgenreId) {
  const modal = document.getElementById("modal-subgenre-info");
  if (!modal) return;
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
        ${artists.map(a => `<div class="result-row sgi-artist-row" data-id="${escapeHtml(a.id)}">
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
    el.querySelectorAll(".sgi-artist-row").forEach((row) => {
      row.addEventListener("click", () => {
        const artist = artists.find(a => a.id === row.dataset.id);
        if (artist) opts.onArtistClick(artist);
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

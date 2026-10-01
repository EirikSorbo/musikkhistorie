// ============================================================================
//  METASJANGER-OVERSIKTEN — ren modell (v5.94)
// ----------------------------------------------------------------------------
//  Oversiktssiden for en metasjanger i visningsmodus (brukerønske 2026-10-01):
//  sjangerperiodene, forbindelsene til andre familier, og artistene og
//  lytteeksemplene gruppert per sjanger i familien. Her bor utvalget og
//  grupperingen (Node-testet); js/explore-metaoversikt.js tegner siden.
//
//  `familie` er familiens tre-sjangre (etikettene) i tidsrekkefølge, slik
//  genreFamilyNodes gir dem. Grupperingen følger den rekkefølgen.
// ============================================================================
import { isVisible, byInfluenceThenName } from "./limits.js?v=5.94";
import { ytMaal } from "./presentasjon-modell.js?v=5.94";

const lav = (s) => String(s ?? "").toLowerCase();

// Etiketten i familien som et navn peker på (uten hensyn til store og små
// bokstaver), eller null.
function iFamilien(navn, familie) {
  const n = lav(navn);
  return familie.find((f) => lav(f) === n) || null;
}

// Artistene knyttet til metasjangeren (feltet metaGenre, som heftet og
// lærerens oversikt bruker), gruppert under den første av artistens
// sjangre som hører til familien: tre-sjangrene først, så undersjangrene.
// Uten noen sjanger i familien havner artisten under «Andre» sist.
// Rekkefølgen i hver gruppe: innflytelsesår, så navn.
export const ANDRE = "Andre";

export function artisterGruppert(meta, artists, familie) {
  const grupper = new Map(familie.map((f) => [f, []]));
  const andre = [];
  for (const a of artists || []) {
    if (!a || !isVisible(a) || a.metaGenre !== meta) continue;
    const hjem = (a.mainGenre || []).map((g) => iFamilien(g, familie)).find(Boolean)
      || (a.subGenre || []).map((g) => iFamilien(g, familie)).find(Boolean);
    (hjem ? grupper.get(hjem) : andre).push(a);
  }
  const ut = familie
    .map((f) => ({ sjanger: f, artister: grupper.get(f).sort(byInfluenceThenName) }))
    .filter((g) => g.artister.length);
  if (andre.length) ut.push({ sjanger: ANDRE, artister: andre.sort(byInfluenceThenName) });
  return ut;
}

// Lytteeksemplene, med samme regel som spillelistene i appen (ui.js
// playlistRows): for hver sjanger i familien er artistene de som har
// sjangeren som tre-sjanger eller undersjanger, og et eksempel er med når det
// er merket med akkurat den sjangeren, eller er umerket. Et eksempel står
// bare én gang, under den første sjangeren i tidsrekkefølgen som tar det.
// `ider` er YouTube-ID-ene i rekkefølge, til «Spill alle».
export function lytteeksemplerGruppert(artists, familie) {
  const sett = new Set();
  const ider = [];
  const synlige = (artists || []).filter((a) => a && isVisible(a)).sort(byInfluenceThenName);
  const grupper = familie.map((f) => {
    const sj = lav(f);
    const eksempler = [];
    for (const a of synlige) {
      const harSjanger = [...(a.mainGenre || []), ...(a.subGenre || [])].some((g) => lav(g) === sj);
      if (!harSjanger) continue;
      for (const m of a.musicExamples || []) {
        if (!m || !m.url || (m.genre && lav(m.genre) !== sj)) continue;
        const nokkel = `${lav(a.name)}|${lav(m.label || m.url)}`;
        if (sett.has(nokkel)) continue;
        sett.add(nokkel);
        const video = ytMaal(m.url)?.video || null;
        if (video) ider.push(video);
        eksempler.push({
          tittel: m.label || m.url, url: m.url, year: m.year || null,
          performanceYear: m.performanceYear || null,
          artist: a.name, artistId: a.id, video,
        });
      }
    }
    return { sjanger: f, eksempler };
  }).filter((g) => g.eksempler.length);
  return { grupper, ider, antall: sett.size };
}

// Forbindelsene til resten av treet: sjangrene utenfor familien som noen i
// familien vokste ut av (også røttene uten metasjanger), og sjangrene utenfor
// familien som vokste ut av noen i den. Unike noder, i tidsrekkefølge etter
// `aarFor(node)` (startåret; uten årstall sist), ellers i treets rekkefølge.
export function forbindelser(meta, genealogy, aarFor = () => null) {
  const tre = genealogy || [];
  const iFam = new Set(tre.filter((n) => n.g === meta).map((n) => n.id));
  const byId = new Map(tre.map((n) => [n.id, n]));
  const fraIder = new Set();
  for (const n of tre) {
    if (!iFam.has(n.id)) continue;
    for (const p of n.p || []) if (!iFam.has(p) && byId.has(p)) fraIder.add(p);
  }
  const ordne = (liste) => liste
    .map((n, i) => ({ n, i, y: aarFor(n) ?? Infinity }))
    .sort((a, b) => a.y - b.y || a.i - b.i)
    .map((x) => x.n);
  const fra = ordne(tre.filter((n) => fraIder.has(n.id)));
  const til = ordne(tre.filter((n) => !iFam.has(n.id) && (n.p || []).some((p) => iFam.has(p))));
  return { fra, til };
}

// Tidsrommet familien dekker, fra periodene (genre-periods.js periodGroups):
// tidligste startår, og «i dag» når minst én periode er åpen. null uten årstall.
export function tidsrom(rader) {
  const ok = (rader || []).filter((r) => r.status === "ok");
  if (!ok.length) return null;
  const fra = Math.min(...ok.map((r) => r.from));
  const aapen = ok.some((r) => r.to == null);
  return aapen ? `${fra}–i dag` : `${fra}–${Math.max(...ok.map((r) => r.to))}`;
}

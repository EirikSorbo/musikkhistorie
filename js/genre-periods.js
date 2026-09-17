// ============================================================================
//  SJANGERPERIODER — ren datalogikk for «Sjangerperioder» i «Det store bildet»
// ----------------------------------------------------------------------------
//  Når hver sjanger var aktiv, som liggende stolper per metasjanger (v5.20).
//  Skilt ut fra js/explore-sjangerperioder.js så den kan enhetstestes i Node:
//  treet, beskrivelsene og inneværende år kommer inn som argumenter, og
//  modulen rører verken DOM, Firestore eller modultilstand.
//
//  Alt er AVLEDET, ingenting lagres, så figuren følger pensumet av seg selv:
//   - metasjangrene: kalleren sender storyOrder(genreDescs), som følger
//     navnebytter i treet og holder STORY_SKJULT (Pop, Rock) utenfor
//   - sjangrene: nodene i treet med n.g === metasjangeren
//   - årstallene: activeFrom/activeTo på main-nivået i genreDescriptions, med
//     SAMME oppslag som sjangerkortet (resolveDescAny med [n.l, n.f]), så
//     figuren og kortet aldri kan vise ulike perioder for samme sjanger
// ============================================================================

import { resolveDescAny } from "./genre-descriptions.js?v=5.23";

// tab10-paletten (samme som diagrammet brukeren likte) pluss to ekstra.
export const PERIOD_COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf", "#0f766e", "#b45309"];

// Farge nummer i i en gruppe. Vokser en familie forbi paletten, genereres nye
// farger ved å rotere fargetonen med den gylne vinkelen, så «egen farge per
// stolpe» holder uten at noen må utvide lista for hånd. Alltid 6-sifret hex:
// toningen på åpne stolper legger til alfa som «00».
export function periodColor(i) {
  if (i < PERIOD_COLORS.length) return PERIOD_COLORS[i];
  const h = ((i - PERIOD_COLORS.length) * 137.508 + 17) % 360;
  const s = 0.58, l = 0.42;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const hex = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

const aar = (v) => (Number.isInteger(v) ? v : null);

// Status per rad. Bare «ok» tegnes som stolpe; resten vises som et merket hull
// i stedet for å forsvinne stille eller tegne en periode som ikke finnes:
//   mangler       ingen brukbart startår
//   ugyldigSlutt  sluttåret er satt, men ikke et gyldig årstall (feil i data:
//                 uten dette ble raden en «fortsatt aktiv»-stolpe)
//   ugyldig       sluttåret er før startåret
//   framtid       start- eller sluttår etter i dag (typisk en tastefeil som
//                 2062 for 1962; den ville ellers strukket aksen for ALLE
//                 gruppene, eller gitt en stolpe utenfor figuren)
function statusFor(from, to, sluttUgyldig, naa) {
  if (from === null) return "mangler";
  if (sluttUgyldig) return "ugyldigSlutt";
  if (to !== null && to < from) return "ugyldig";
  if (from > naa || (to !== null && to > naa)) return "framtid";
  return "ok";
}

// Én gruppe per metasjanger, i rekkefølgen kalleren gir. Rader med gyldige
// årstall kommer kronologisk: startår, så sluttår (åpen slutt, «i dag», etter
// lukkede med samme start), så treets rekkefølge. Hullene legges nederst.
export function periodGroups(metas, genreDescs = {}, genealogy = [], naa = new Date().getFullYear()) {
  return (metas || []).map((meta) => {
    const rows = genealogy
      .filter((n) => n.g === meta)
      .map((n, treeIdx) => {
        const r = resolveDescAny(genreDescs || {}, [n.l, n.f], "main");
        const from = aar(r.activeFrom), to = aar(r.activeTo);
        const status = statusFor(from, to, !!r.activeToUgyldig, naa);
        return {
          genre: n.l,
          from: status === "ok" ? from : null,
          to: status === "ok" ? to : null,
          status,
          treeIdx,
        };
      });
    const medAar = rows
      .filter((r) => r.status === "ok")
      .sort((a, b) => a.from - b.from
        || (a.to ?? Infinity) - (b.to ?? Infinity)
        || a.treeIdx - b.treeIdx);
    medAar.forEach((r, i) => { r.color = periodColor(i); });
    return { meta, rows: [...medAar, ...rows.filter((r) => r.status !== "ok")] };
  }).filter((g) => g.rows.length);
}

// Aksen følger dataene. Den starter på tiåret før den tidligste perioden, men
// aldri senere enn 1900, så den leses likt med varmekartets tiårsakse. Den
// slutter noen år etter i dag, så åpne perioder har plass til å tone ut. Siden
// årstall fram i tid er hull (se statusFor), kan ingen enkeltrad strekke aksen
// for resten av figuren. Tiårsmerkene går til siste hele tiår.
export function periodAxis(groups, naa) {
  const rader = (groups || []).flatMap((g) => g.rows).filter((r) => r.status === "ok");
  const minFra = rader.length ? Math.min(...rader.map((r) => r.from)) : 1900;
  const start = Math.min(1900, Math.floor(minFra / 10) * 10);
  const ticks = [];
  for (let t = start; t <= Math.floor(naa / 10) * 10; t += 10) ticks.push(t);
  return { start, slutt: naa + 5, ticks };
}

// Posisjon på aksen i prosent av sporets bredde.
export const pctAv = (axis, aarstall) => ((aarstall - axis.start) / (axis.slutt - axis.start)) * 100;

// Alt figuren tegnes av, som én streng. Visningen tegner bare på nytt når den
// endres: snapshotet for sjangerbeskrivelsene fyrer ved ENHVER endring i
// samlingen (beskrivelser, kilder, historier), og en omtegning nullstiller
// sidelengs scroll og fokus for den som bruker figuren.
export function periodSignatur(groups, axis) {
  return JSON.stringify([axis.start, axis.slutt,
    groups.map((g) => [g.meta, g.rows.map((r) => [r.genre, r.from, r.to, r.status])])]);
}

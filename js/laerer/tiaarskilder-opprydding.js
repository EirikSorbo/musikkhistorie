// ============================================================================
//  ENGANGSOPPRYDDING: SAMFUNNSKILDENE PÅ TIÅRENE (v6.92, brukervalg 2026-10-13)
// ----------------------------------------------------------------------------
//  Brukerens avgjørelse: kildene som bare er brukt til tiårenes samfunnstekster,
//  fjernes. Hvert tiår har ÉN kildeliste for begge tekstene, så teknologikildene
//  (LP, 45, Moog, DX7, TR-808, MP3, strømming …) blir stående; brukeren valgte
//  «bare samfunnskildene».
//
//  Lista under er de 16 samfunnskildene, slått opp i dataene 13.10. Alle 31
//  kildene på tiårene var brukt bare der, ingen andre steder i appen. Treffet
//  går på adressen. Skrivebordet viser kortet «Fjern samfunnskildene» så lenge
//  noen av dem står på et tiår (teacher-desk.js), og kortet forsvinner av seg
//  selv når de er borte. Modulen kan slettes etterpå.
// ============================================================================

export const SAMFUNNSKILDER = new Set([
  "https://www.loc.gov/classroom-materials/great-migration/",
  "https://www.britannica.com/event/Great-Migration",
  "https://www.ebsco.com/research-starters/music/rise-tin-pan-alley-music",
  "https://historynet.com/tin-pan-alley-where-americas-recording-industry-was-born/",
  "https://www.history.com/articles/great-migration",
  "https://guides.loc.gov/harlem-renaissance/",
  "https://www.nationalgeographic.com/history/article/how-the-harlem-renaissance-helped-forge-a-new-sense-of-black-identity",
  "https://www.encyclopedia.com/history/united-states-and-canada/us-history/great-migration",
  "https://www.archives.gov/research/african-americans/migrations/great-migration",
  "https://www.history.com/articles/civil-rights-movement-timeline",
  "https://www.britannica.com/list/timeline-of-the-american-civil-rights-movement",
  "https://www.loc.gov/exhibits/civil-rights-act/civil-rights-era.html",
  "https://timeline.carnegiehall.org/genres/funk",
  "https://nmaahc.si.edu/explore/stories/celebrating-black-music-month",
  "https://www.si.edu/spotlight/hip-hop-rap",
  "https://www.pewresearch.org/race-and-ethnicity/2025/05/07/views-of-race-policing-and-black-lives-matter-in-the-5-years-since-george-floyds-killing/",
]);

const erSamfunnskilde = (k) => SAMFUNNSKILDER.has(String(k?.url || "").trim());

// Tiårene som har samfunnskilder: { id, kilder (det som blir stående), fjernes }.
export function planTiaarskilder(decadeDescs = {}) {
  return Object.entries(decadeDescs || {})
    .map(([id, d]) => {
      const kilder = Array.isArray(d?.kilder) ? d.kilder : [];
      return { id, kilder: kilder.filter((k) => !erSamfunnskilde(k)), fjernes: kilder.filter(erSamfunnskilde) };
    })
    .filter((t) => t.fjernes.length)
    .sort((a, b) => Number(a.id) - Number(b.id));
}

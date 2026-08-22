// ============================================================================
//  BYGGER content/genealogy-DOKUMENTET (v2-formen) FRA FRØET
// ----------------------------------------------------------------------------
//  Ren, delt transformasjon: tar frøets rådata og leverer dokumentet slik det
//  faktisk ligger i Firestore — metaGenres med farge/kolonne, fam KUN som
//  unntak på nodene, uten era/t/cx.
//
//  Delt av:
//    · tools/seed-genealogy.js      (skriver json files/genealogy-seed.json)
//    · tests/helpers/seed-model.js  (testene skal kjøre NØYAKTIG formen
//      produksjonen leser — v1-formen med fam på alle noder skjulte at
//      rebuild() leste metaByName for sent, se v4.65)
//    · tools/dump-genre-fixture.js  (regenererer testfasiten bevisst)
//
//  Ingen imports av data her: kalleren sender inn sitt eget frø, så modulen
//  aldri kan skape en andre instans av genealogy-data med annen ?v=-suffiks.
// ============================================================================

// Metasjangrene som egne oppføringer, i den pedagogiske rekkefølgen. Fargen
// utledes her (den vanligste familien blant metasjangerens noder, røtter
// unntatt) slik at dokumentet BÆRER den. Fra fase 3 er feltet lærerens å
// redigere. (Et `order`-felt ble skrevet tidligere — ingenting leste det.)
function byggMetaGenres({ GENEALOGY, FAMILIES, META_ORDER_HINT }) {
  const brukte = [...new Set(GENEALOGY.filter((n) => n.g).map((n) => n.g))];
  const rang = new Map(META_ORDER_HINT.map((m, i) => [m, i]));
  const sortert = [...brukte].sort((a, b) => (rang.get(a) ?? Infinity) - (rang.get(b) ?? Infinity));

  // Kolonnene (venstre-mot-høyre i kartet) utledes av medianen av de gamle
  // håndsatte cx-ene, slik at det utregnede kartet arver plasseringen som satt.
  const medianCx = (navn) => {
    const v = GENEALOGY.filter((n) => n.g === navn).map((n) => n.cx).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)] ?? 0;
  };
  const kolonne = new Map([...brukte].sort((a, b) => medianCx(a) - medianCx(b)).map((m, i) => [m, i]));

  const tally = {};
  for (const n of GENEALOGY) {
    if (!n.g || n.fam === "gray") continue;
    (tally[n.g] ||= {})[n.fam] = (tally[n.g][n.fam] || 0) + 1;
  }
  return sortert.map((navn, i) => {
    const fams = Object.entries(tally[navn] || {}).sort((a, b) => b[1] - a[1]);
    const fam = fams[0]?.[0] || "gray";
    return {
      name: navn, column: kolonne.get(navn) ?? i,
      fam, color: FAMILIES[fam]?.stroke || FAMILIES.gray.stroke,
    };
  });
}

// Noden slik den lagres. Utelater felter som er tomme, så dokumentet er lesbart
// og lite. fam lagres KUN som unntak — noden arver ellers metasjangerens farge,
// og en lærer som bytter farge på metasjangeren skal se hele familien følge
// etter. cx er borte (x regnes ut av js/genre-layout.js), og era/t er borte
// (innhold, bor i genreDescriptions siden v4.64).
function byggNode(n, metaGenres) {
  const ut = {
    id: n.id, l: n.l, f: n.f,
    g: n.g ?? null,
    r: n.r,
    p: n.p || [],
  };
  const arvet = n.g ? (metaGenres.find((m) => m.name === n.g)?.fam || null) : null;
  if (n.fam && n.fam !== arvet) ut.fam = n.fam;
  if (n.yOffset) ut.yOffset = n.yOffset;
  if (n.rx?.length) ut.rx = n.rx;
  return ut;
}

export function byggGenealogyDoc(seed) {
  const metaGenres = byggMetaGenres(seed);
  return {
    version: 2,
    nodes: seed.GENEALOGY.map((n) => byggNode(n, metaGenres)),
    families: seed.FAMILIES,
    metaOrderHint: seed.META_ORDER_HINT,
    metaGenres,
  };
}

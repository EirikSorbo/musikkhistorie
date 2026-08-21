// ============================================================================
//  SJANGERTREETS LAYOUT — kolonnene regnes ut, ikke plasseres for hånd
// ----------------------------------------------------------------------------
//  Fram til v4.53 bar hver node en håndsatt `cx`. Den var finjustert piksel for
//  piksel gjennom mange runder (kodekommentarene fortalte om streker som «grazet
//  etiketten på 1 px»), og det gjorde treet umulig å redigere for en lærer: å
//  legge til én sjanger krevde at noen flyttet naboene.
//
//  Her utledes x i stedet, av tre ting læreren faktisk forstår:
//    1. metasjangerens KOLONNE  — hvilken vannrett sone familien har
//    2. slektskapet             — et barn trekkes mot foreldrene sine
//    3. plassbehovet            — brede soner til metasjangre med mange
//                                 samtidige sjangre
//
//  Modulen er ren og uten DOM, så den deles av slektstreet (som etterpå løser
//  kollisjoner med MÅLTE etikettbredder) og av Sjangerhimmelen (som bruker
//  tallene rått). Før delte de `cx`; nå deler de denne.
// ============================================================================

// Kanonisk bredde på kartrommet. Renderne skalerer selv til scenen.
export const LAYOUT_WIDTH = 2400;

const MARGIN = 120;       // luft ytterst, så etiketter ikke havner i kanten
const BAND_GAP = 40;      // luft mellom to metasjanger-soner
const PASSES = 24;        // relaksasjonsrunder (konvergerer lenge før dette)

// Rad (tiår) som brøktall, slik nodene bærer den.
export const rowOf = (n) => (n.r || 0) + (n.yOffset || 0);

// Metasjangrene i VISUELL rekkefølge, venstre mot høyre. `column` er feltet
// læreren styrer; `order` (den pedagogiske rekkefølgen som varmekartet og
// tidslinjen bruker) er bevisst en ANNEN akse og brukes ikke her.
export function metaColumnOrder(metaGenres = []) {
  return [...metaGenres]
    .map((m, i) => ({ name: typeof m === "string" ? m : m.name, column: (typeof m === "object" && Number.isFinite(m.column)) ? m.column : i, i }))
    .filter((m) => m.name)
    .sort((a, b) => a.column - b.column || a.i - b.i)
    .map((m) => m.name);
}

// Returnerer Map<nodeId, x> i rommet [0, LAYOUT_WIDTH].
export function computeColumns(nodes = [], metaGenres = [], opts = {}) {
  const width = opts.width || LAYOUT_WIDTH;
  const ut = new Map();
  if (!nodes.length) return ut;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentsOf = (n) => [
    ...(Array.isArray(n.p) ? n.p : []),
    ...(Array.isArray(n.rx) ? n.rx : []),
  ].filter((id) => byId.has(id));

  // --- 1. Sonene -----------------------------------------------------------
  // Sonens bredde følger hvor mange sjangre metasjangeren har SAMTIDIG (flest
  // på én rad), ikke hvor mange den har totalt: det er samtidigheten som krever
  // vannrett plass. Jazz med elleve noder spredt over åtte tiår trenger mindre
  // enn navnet skulle tilsi.
  const metaNavn = metaColumnOrder(metaGenres);
  const kjente = new Set(metaNavn);
  // Metasjangre som finnes i nodene, men ikke er deklarert, havner sist heller
  // enn å forsvinne.
  for (const n of nodes) if (n.g && !kjente.has(n.g)) { metaNavn.push(n.g); kjente.add(n.g); }

  const soner = metaNavn.map((navn) => {
    const egne = nodes.filter((n) => n.g === navn);
    const perRad = new Map();
    egne.forEach((n) => {
      const k = rowOf(n).toFixed(2);
      perRad.set(k, (perRad.get(k) || 0) + 1);
    });
    const maksSamtidig = Math.max(1, ...perRad.values());
    return { navn, noder: egne, vekt: maksSamtidig };
  }).filter((s) => s.noder.length);

  const sumVekt = soner.reduce((s, b) => s + b.vekt, 0) || 1;
  const ledig = Math.max(200, width - 2 * MARGIN - BAND_GAP * Math.max(0, soner.length - 1));
  let x = MARGIN;
  for (const s of soner) {
    s.bredde = (ledig * s.vekt) / sumVekt;
    s.fra = x;
    s.til = x + s.bredde;
    s.midt = x + s.bredde / 2;
    x = s.til + BAND_GAP;
  }

  // --- 2. Startplassering --------------------------------------------------
  const sonePerNode = new Map();
  for (const s of soner) for (const n of s.noder) { ut.set(n.id, s.midt); sonePerNode.set(n.id, s); }

  // --- 3. Relaksasjon ------------------------------------------------------
  // Hver node trekkes mot gjennomsnittet av foreldrene sine, men holdes inne i
  // sin egen sone. Så spres nodene som deler rad innenfor sonen, slik at de
  // ikke ligger oppå hverandre. Rendereren finjusterer etterpå med målte
  // bredder; her handler det om å få RIKTIG REKKEFØLGE og retning.
  const ikkeRot = nodes.filter((n) => n.g);
  const radNoklerPerSone = new Map();
  for (const s of soner) {
    const kart = new Map();
    s.noder.forEach((n) => {
      const k = rowOf(n).toFixed(2);
      if (!kart.has(k)) kart.set(k, []);
      kart.get(k).push(n);
    });
    radNoklerPerSone.set(s.navn, kart);
  }

  for (let pass = 0; pass < PASSES; pass++) {
    for (const n of ikkeRot) {
      const ps = parentsOf(n).map((id) => ut.get(id)).filter((v) => Number.isFinite(v));
      if (!ps.length) continue;
      const snitt = ps.reduce((a, b) => a + b, 0) / ps.length;
      const s = sonePerNode.get(n.id);
      // 35 % dragning mot foreldrene: nok til at slektskapet former kartet,
      // lite nok til at sonene holder seg som kolonner.
      const ny = ut.get(n.id) + (snitt - ut.get(n.id)) * 0.35;
      ut.set(n.id, Math.max(s.fra, Math.min(s.til, ny)));
    }
    // Spre innenfor rad + sone
    for (const s of soner) {
      for (const gruppe of radNoklerPerSone.get(s.navn).values()) {
        if (gruppe.length < 2) continue;
        gruppe.sort((a, b) => ut.get(a.id) - ut.get(b.id));
        const steg = s.bredde / gruppe.length;
        gruppe.forEach((n, i) => {
          const mål = s.fra + steg * (i + 0.5);
          ut.set(n.id, ut.get(n.id) + (mål - ut.get(n.id)) * 0.5);
        });
      }
    }
  }

  // --- 4. Røttene ----------------------------------------------------------
  // Røttene (g === null) tilhører ingen metasjanger. De legges over barna sine,
  // så armene ned i treet blir korte og loddrette i stedet for å krysse kartet.
  const røtter = nodes.filter((n) => !n.g);
  for (let pass = 0; pass < 6; pass++) {
    for (const r of røtter) {
      const barn = nodes.filter((k) => parentsOf(k).includes(r.id)).map((k) => ut.get(k.id)).filter(Number.isFinite);
      if (!barn.length) { if (!ut.has(r.id)) ut.set(r.id, width / 2); continue; }
      const snitt = barn.reduce((a, b) => a + b, 0) / barn.length;
      ut.set(r.id, Math.max(MARGIN, Math.min(width - MARGIN, snitt)));
    }
    // Røtter på samme rad skyves fra hverandre
    const perRad = new Map();
    røtter.forEach((r) => {
      const k = rowOf(r).toFixed(2);
      if (!perRad.has(k)) perRad.set(k, []);
      perRad.get(k).push(r);
    });
    for (const gruppe of perRad.values()) {
      if (gruppe.length < 2) continue;
      gruppe.sort((a, b) => ut.get(a.id) - ut.get(b.id));
      const min = 190;
      for (let i = 1; i < gruppe.length; i++) {
        const a = ut.get(gruppe[i - 1].id), b = ut.get(gruppe[i].id);
        if (b - a < min) {
          const skyv = (min - (b - a)) / 2;
          ut.set(gruppe[i - 1].id, a - skyv);
          ut.set(gruppe[i].id, b + skyv);
        }
      }
    }
  }

  for (const [id, v] of ut) ut.set(id, Math.max(MARGIN * 0.5, Math.min(width - MARGIN * 0.5, v)));
  return ut;
}

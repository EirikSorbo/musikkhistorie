// ============================================================================
//  SJANGERBESKRIVELSER — standardtekster (seed) + oppslag per nivå
// ----------------------------------------------------------------------------
//  Standardbeskrivelsene for tre-sjangrene bor her (flyttet ut av genealogy.js,
//  altså ikke hardkodet i kart-koden). Lærer kan overstyre PER NIVÅ via
//  Firestore («subgenres»): doc = sjangernavn, med valgfrie felt
//  meta/main/sub = { description, kilder }. Eldre flat { description, kilder }
//  leses fortsatt som delt fallback. Nivå: meta (metasjanger), main (tre-
//  sjanger), sub (fri undersjanger). main er nøklet på både label og fullt navn.
// ============================================================================

export const GENRE_SEED = {
  meta: {},
  main: {
      "Euro-folk": "Appalachiske ballader, salmer og britiske music halls — de hvite nybyggernes arv.",
      "Europeisk folkemusikk": "Appalachiske ballader, salmer og britiske music halls — de hvite nybyggernes arv.",
      "Vestafrikansk": "Griot-tradisjon, work songs, call & response og rytmefokus — kjernen i nesten alt som kommer etter.",
      "Vestafrikansk musikk": "Griot-tradisjon, work songs, call & response og rytmefokus — kjernen i nesten alt som kommer etter.",
      "Work songs": "Arbeidssanger på plantasjene; dialog mellom solist og gruppe.",
      "Work songs / field hollers": "Arbeidssanger på plantasjene; dialog mellom solist og gruppe.",
      "Spirituals": "Religiøse sanger som blandet europeiske salmer med afrikansk uttrykk.",
      "Negro spirituals": "Religiøse sanger som blandet europeiske salmer med afrikansk uttrykk.",
      "Blues": "Verdslig, individuell sang om smerte og lengsel. Grunnmuren for nesten all populærmusikk.",
      "Ragtime": "Komponert og notert, synkopert pianomusikk. Bindeledd mot jazzen.",
      "Tin Pan Alley": "Låtskriversamlebånd i New York; «the American songbook».",
      "Jazz": "Født i New Orleans av ragtime «played hot» + blues. Improvisasjon og swing.",
      "Country": "De hvites folkemusikk, formet av skotsk-irsk arv, vaudeville og blues.",
      "Country (hillbilly)": "De hvites folkemusikk, formet av skotsk-irsk arv, vaudeville og blues.",
      "Gospel": "Komponert kirkemusikk med blues-driv. Vugge for soul og R&B.",
      "Swing": "Storband-jazz som ble USAs danse- og popmusikk.",
      "Bluegrass": "Tradisjonsbundet country med virtuost strengespill.",
      "Honky tonk": "Røff bar-country om drikking og hjertesorg, elektrisk forsterket.",
      "Bebop": "Kunstnerisk opprør mot kommersialisert swing: jazzen går fra dansemusikk til lyttemusikk.",
      "R&B": "Blues + jazzens energi + gospelens vokal. Forløper for soul og rock.",
      "Rhythm & blues": "Blues + jazzens energi + gospelens vokal. Forløper for soul og rock.",
      "Nashville": "Polert, pop-orientert country med strykere og kor.",
      "Nashville-sound": "Polert, pop-orientert country med strykere og kor.",
      "Chicago blues": "Elektrisk, råere byblues. Tente den britiske blues-bølgen og rocken.",
      "Cool jazz": "Intellektuell motreaksjon mot bebop: dempet, lyrisk, behersket.",
      "Hard bop": "Motreaksjon mot cool jazz — tilbake til de afroamerikanske røttene: blues- og gospel-drevet.",
      "Soul": "Gospel møter R&B. Lydsporet til borgerrettskampen.",
      "Modal jazz": "Frigjøring fra akkordene; bygd på skalaer og stemninger.",
      "Free jazz": "Motreaksjon mot fast struktur (hard bop/modal): frigjøring fra alt, kollektiv improvisasjon.",
      "Funk": "Alt destillert til rytme og groove. Peker mot hip-hop.",
      "Reggae": "Jamaicansk off-beat med «riddim». Toasting → grunnlaget for rap.",
      "Reggae & dub": "Jamaicansk off-beat med «riddim». Toasting → grunnlaget for rap.",
      "Outlaw": "Opprør mot det polerte Nashville-systemet: røffere uttrykk og kunstnerisk frihet.",
      "Outlaw country": "Opprør mot det polerte Nashville-systemet: røffere uttrykk og kunstnerisk frihet.",
      "Fusion": "Jazz + rock + funk + verdens folkemusikk. Elektrisk og global.",
      "Jazz-fusion": "Jazz + rock + funk + verdens folkemusikk. Elektrisk og global.",
      "Hip-hop": "Bronx-kultur: DJ-ing, MC-ing, breakdance, graffiti. Beat over melodi.",
      "Disco": "Four-on-the-floor fra klubbene. Vugge for all klubbmusikk.",
      "House": "Disco gjenfødt på trommemaskin i Chicago-klubbene.",
      "Techno": "Detroits futuristiske, maskinelle svar på house.",
      "Americana": "Jordnær, kritikerhyllet motvekt til mainstream-Nashville.",
      "Americana / alt-country": "Jordnær, kritikerhyllet motvekt til mainstream-Nashville.",
      "Neo-soul": "Soul med hip-hop-mikrorytmikk og rike harmonier.",
      "Trance / DnB": "Rave-eksplosjonen: melodisk trance og høyt tempo drum'n'bass.",
      "Trance & drum'n'bass": "Rave-eksplosjonen: melodisk trance og høyt tempo drum'n'bass.",
      "Nu-jazz": "Norsk fjelljazz møter electronica og drum'n'bass.",
      "Folk": "Bevisst gjenoppliving av amerikansk og britisk folkemusikk; vise- og protesttradisjon. Bro mot folkrock, singer-songwriter og americana.",
      "Folk (revival)": "Bevisst gjenoppliving av amerikansk og britisk folkemusikk; vise- og protesttradisjon. Bro mot folkrock, singer-songwriter og americana.",
      "Rock'n'roll": "Afroamerikansk R&B møter hvit country. Ungdomsopprøret som sprengte populærmusikken vidåpen.",
      "British invasion": "Britiske band gjenoppdaget og gjenfortolket Chicago-bluesen og rock'n'roll, og sendte den tilbake til USA.",
      "Blues revival (British invasion)": "Britiske band gjenoppdaget og gjenfortolket Chicago-bluesen og rock'n'roll, og sendte den tilbake til USA.",
      "Blues Rock": "Forsterket, virtuos videreføring av bluesen — grunnmuren for hardrock.",
      "Blues rock": "Forsterket, virtuos videreføring av bluesen — grunnmuren for hardrock.",
      "Fjelljazz": "Nordisk, åpen og melodisk jazz med ECM-klang — naturlyrikk og romfølelse.",
      "Fjelljazz (ECM)": "Nordisk, åpen og melodisk jazz med ECM-klang — naturlyrikk og romfølelse.",
      "Gangsta rap": "Rå skildring av gatelivet, særlig på Vestkysten. Kommersielt gjennombrudd og kulturkamp.",
      "Trap": "Sørstats-hiphop med 808-bass og hi-hat-ruller. Ble den dominerende lyden i moderne pop.",
      "Elektronika": "Bredt felt for lytterettet elektronisk musikk utenfor dansegulvet.",
      "EDM": "Stadionvennlig dansemusikk med store «drops». Elektronikaens kommersielle topp."
  },
  sub: {},
};

function fromOverride(o, level) {
  if (!o) return null;
  if (o[level] && o[level].description) return { description: o[level].description, kilder: o[level].kilder || [] };
  if (o.description) return { description: o.description, kilder: o.kilder || [] }; // eldre flat (delt)
  return null;
}

// Beste beskrivelse for (navn, nivå): overstyring (nivå → flat) → seed.
export function resolveDesc(overrides, name, level) {
  return fromOverride(overrides && overrides[name], level)
      || (GENRE_SEED[level] && GENRE_SEED[level][name] ? { description: GENRE_SEED[level][name], kilder: [] } : null)
      || { description: "", kilder: [] };
}

// Som resolveDesc, men over flere navn (f.eks. nodens label OG fulle navn):
// sjekk ALLE navn for overstyring FØRST, deretter seed — slik at en lagret
// overstyring aldri maskeres av seed-teksten.
export function resolveDescAny(overrides, names, level) {
  for (const n of names) { const r = fromOverride(overrides && overrides[n], level); if (r) return r; }
  for (const n of names) { const s = GENRE_SEED[level] && GENRE_SEED[level][n]; if (s) return { description: s, kilder: [] }; }
  return { description: "", kilder: [] };
}

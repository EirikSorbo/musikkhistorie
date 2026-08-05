// ============================================================================
//  ARTIST-CACHE — delt localStorage-lag for artistlista
// ----------------------------------------------------------------------------
//  Forsiden FYLLER cachen fra sanntidslytteren (ved sidebytte, se landing.js);
//  studentsiden LESER den til duplikatsjekken i forslagsskjemaet, i stedet for
//  å abonnere på hele artistsamlingen bare for å slå opp navn.
//
//  Skjemaversjon i nøkkelen: bump ved feltnavn-endringer på artist, så en
//  gammel cache ignoreres og appen faller tilbake til ferske Firestore-data.
// ============================================================================

const CACHE_SCHEMA = "v3";
const CACHE_ARTISTS = `pensum_cache_artists_${CACHE_SCHEMA}`;

// Rydder bort caches fra eldre skjemaer. Beholdt selv om alle migreringer er
// kjørt: nøklene er uleselige for appen, men opptar fortsatt localStorage-
// kvoten i nettlesere som har besøkt appen før — og en full kvote gjør at
// DAGENS cache ikke lar seg skrive (setItem kaster, offline-visningen ryker).
function purgeLegacyCache() {
  try {
    for (const k of Object.keys(localStorage)) {
      if ((k.startsWith("pensum_cache_artists") || k.startsWith("pensum_cache_config"))
          && k !== CACHE_ARTISTS) {
        localStorage.removeItem(k);
      }
    }
  } catch { /* ingen tilgang */ }
}

export function saveArtists(list) {
  try {
    localStorage.setItem(CACHE_ARTISTS, JSON.stringify(list));
  } catch { /* full storage */ }
}

// Returnerer artistlista fra cachen, eller [] når den mangler/er ødelagt.
export function loadArtists() {
  purgeLegacyCache();
  try {
    const raw = localStorage.getItem(CACHE_ARTISTS);
    const list = raw ? JSON.parse(raw) : null;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

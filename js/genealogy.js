// ============================================================================
//  SLEKTSTRE — «Carta» i musicmap-stil
// ----------------------------------------------------------------------------
//  2D-kart: tid løper nedover, metasjanger bortover. Dra for å panorere,
//  scroll/knapper for å zoome, hover lyser opp påvirkningslinjene, klikk åpner
//  panel med beskrivelse + spilleliste. Strukturen er fast og designet for
//  lesbarhet; beskrivelser kan overstyres fra Firestore (genreDescriptions-samlingen).
// ============================================================================

import { linkifyAll, wireAllLinks } from "./linkify.js?v=4.02";
import { escapeHtml, buildKilderList } from "./util.js?v=4.02";
import { resolveDesc, resolveDescAny, missingDesc } from "./genre-descriptions.js?v=4.02";
import { modalOpen, modalClose } from "./ui-modal.js?v=4.02";
import { renderGenreEditBtn } from "./ui-helpers.js?v=4.02";
import { heatRow, heatStripHtml, heatAxisHtml, getHeatData } from "./heat-strip.js?v=4.02";

// rad (r) → tiår; tid løper nedover.
export const GENEALOGY = [
  { id: "eurofolk", l: "Europeisk", f: "Europeisk folkemusikk", fam: "gray", cx: 600, r: 0, p: [], g: null, era: "Røtter", t: [] },
  { id: "vestafrik", l: "Vestafrikansk", f: "Vestafrikansk musikk", fam: "gray", cx: 900, r: 0, p: [], g: null, era: "Røtter", t: [] },
  // Hymner og Vaudeville er de to europeiske kanalene inn i amerikansk
  // populærmusikk: den ene sakral, den andre kommersiell. Uten dem sto
  // «Europeisk» som en udifferensiert sekk, og linjene videre til Spirituals,
  // Country og Tin Pan Alley måtte tegnes fra den sekken i stedet for fra det
  // som faktisk påvirket dem.
  { id: "hymner", l: "Hymner", f: "Salmer og vekkelsessang", fam: "gray", cx: 530, r: 0, yOffset: 0.5, p: ["eurofolk"], g: null, era: "1700–1800-tallet", t: ["Amazing Grace (1779)", "Wondrous Love – Sacred Harp-tradisjonen"] },
  { id: "vaudeville", l: "Vaudeville", f: "Vaudeville og varieté", fam: "gray", cx: 390, r: 0, yOffset: 0.5, p: ["eurofolk"], g: null, era: "1880–1930", t: ["Some of These Days – Sophie Tucker (1911)", "Alexander's Ragtime Band – Irving Berlin (1911)"] },
  { id: "brassband", l: "Brassband", f: "Brass- og marsjtradisjon", fam: "gray", cx: 1030, r: 0, yOffset: 0.5, p: ["eurofolk"], g: null, era: "1800-tallet", t: ["The Stars and Stripes Forever – Sousa (1896)", "Just a Closer Walk with Thee – New Orleans-begravelsesmarsj"] },
  { id: "worksongs", l: "Work songs", f: "Work songs / field hollers", fam: "gray", cx: 780, r: 0, yOffset: 0.5, p: ["vestafrik"], g: null, era: "1800-tallet", t: ["I'll Be So Glad When the Sun Goes Down (1959)"] },
  { id: "spirituals", l: "Spirituals", f: "Negro spirituals", fam: "gray", cx: 1270, r: 0, yOffset: 0.5, p: ["vestafrik", "hymner"], g: null, era: "1800-tallet", t: ["Swing Low (1909)", "Slave Songs of the United States (1867)"] },
  { id: "blues", l: "Blues", f: "Blues", fam: "blue", cx: 580, r: 1, yOffset: 0.5, p: ["worksongs", "vaudeville"], g: "Blues", era: "ca. 1900", t: ["Cross Road Blues – Robert Johnson (1937)", "St. Louis Blues – Bessie Smith (1925)"] },
  // Ragtime er ROT, ikke pensumsjanger (v3.96, brukervalg): den er forløperen
  // jazzen vokser ut av, på linje med Work songs og Spirituals — ikke en stil
  // studentene skal tagge artister med. Derfor g: null (ute av mainGenre-
  // vokabularet og varmekartet) og gray-familien, som de andre røttene.
  // Noden, beskrivelsen og koblingene består; den er fortsatt jazzens inngang.
  { id: "ragtime", l: "Ragtime", f: "Ragtime", fam: "gray", cx: 900, r: 1, p: ["vestafrik", "brassband"], g: null, era: "1897", t: ["Maple Leaf Rag – Scott Joplin", "The Entertainer – Scott Joplin"] },
  { id: "tinpan", l: "Tin Pan Alley", f: "Tin Pan Alley", fam: "gray", cx: 450, r: 2, p: ["vaudeville"], g: "Pop", era: "1910–50", t: ["White Christmas – Irving Berlin (1942)", "Summertime – Gershwin (1935)"] },
  { id: "jazz", l: "Jazz", f: "Jazz", fam: "purple", cx: 700, r: 2, p: ["ragtime", "brassband", "blues"], g: "Jazz", era: "ca. 1915", t: ["Dipper Mouth Blues – King Oliver (1923)", "West End Blues – Louis Armstrong (1928)"] },
  { id: "country", l: "Country", f: "Country (hillbilly)", fam: "amber", cx: 330, r: 3, p: ["eurofolk", "hymner", "blues"], g: "Country", era: "1920-tallet", t: ["Wildwood Flower – Carter Family (1928)", "Blue Yodel – Jimmie Rodgers (1929)"] },
  { id: "gospel", l: "Gospel", f: "Gospel", fam: "olive", cx: 1070, r: 4, p: ["spirituals", "blues"], g: "Gospel", era: "1930-tallet", t: ["Precious Lord, Take My Hand – Dorsey (1932)", "Lord Don't Move the Mountain – Mahalia Jackson"] },
  { id: "swing", l: "Swing", f: "Swing", fam: "purple", cx: 700, r: 4, p: ["jazz"], g: "Jazz", era: "1930–45", t: ["Sing, Sing, Sing – Benny Goodman (1937)", "Take the A Train – Duke Ellington (1941)"] },
  { id: "bluegrass", l: "Bluegrass", f: "Bluegrass", fam: "amber", cx: 70, r: 4, p: ["country"], g: "Country", era: "1939", t: ["Uncle Pen – Bill Monroe (1965)"] },
  { id: "honkytonk", l: "Honky tonk", f: "Honky tonk", fam: "amber", cx: 195, r: 5, p: ["country"], g: "Country", era: "1940-tallet", t: ["Lovesick Blues – Hank Williams (1949)", "Your Cheatin' Heart – Hank Williams (1953)"] },
  { id: "bebop", l: "Bebop", f: "Bebop", fam: "purple", cx: 700, r: 5, p: ["swing"], g: "Jazz", era: "1945", t: ["Koko – Charlie Parker", "A Night in Tunisia – Dizzy Gillespie"] },
  { id: "rnb", l: "R&B", f: "Rhythm & blues", fam: "red", cx: 1190, r: 5, p: ["blues", "gospel"], g: "R&B", era: "1940-tallet", t: ["Beans and Cornbread – Louis Jordan (1949)", "Hallelujah I Love Her So – Ray Charles (1956)"] },
  { id: "nashville", l: "Nashville", f: "Nashville-sound", fam: "amber", cx: 195, r: 6, p: ["honkytonk"], g: "Country", era: "1957", t: ["Crazy – Patsy Cline (1961)", "Four Walls – Jim Reeves (1957)"] },
  { id: "chicagoblues", l: "Electric blues", f: "Electric blues", fam: "blue", cx: 580, r: 5, p: ["blues"], g: "Blues", era: "midten av 1940-tallet", t: ["Got My Mojo Workin' – Muddy Waters (1956)", "Call It Stormy Monday – T-Bone Walker (1948)"] },
  { id: "cool", l: "Cool jazz", f: "Cool jazz", fam: "purple", cx: 700, r: 6, p: ["bebop"], g: "Jazz", era: "1949", t: ["Take Five – Dave Brubeck (1959)", "Birth of the Cool – Miles Davis"] },
  { id: "hardbop", l: "Hard bop", f: "Hard bop", fam: "purple", cx: 825, r: 6, p: ["bebop"], rx: ["cool"], g: "Jazz", era: "1955", t: ["Moanin' – Art Blakey (1959)"] },
  { id: "soul", l: "Soul", f: "Soul", fam: "red", cx: 1190, r: 6, p: ["gospel", "rnb"], g: "R&B", era: "1959", t: ["Respect – Aretha Franklin (1967)", "A Change Is Gonna Come – Sam Cooke (1964)"] },
  { id: "modal", l: "Modal jazz", f: "Modal jazz", fam: "purple", cx: 700, r: 6, yOffset: 0.5, p: ["bebop", "cool"], g: "Jazz", era: "1958", t: ["So What – Miles Davis (1959)", "A Love Supreme – John Coltrane (1964)"] },
  { id: "free", l: "Free jazz", f: "Free jazz", fam: "purple", cx: 825, r: 7, p: ["bebop"], rx: ["hardbop"], g: "Jazz", era: "1960", t: ["Free Jazz – Ornette Coleman (1961)"] },
  { id: "funk", l: "Funk", f: "Funk", fam: "red", cx: 1190, r: 7, p: ["soul"], g: "R&B", era: "1967", t: ["Papa's Got a Brand New Bag – James Brown", "Chameleon – Herbie Hancock (1973)"] },
  { id: "reggae", l: "Reggae", f: "Reggae & dub", fam: "green", cx: 1590, r: 7, p: ["rnb"], g: "Klubbmusikk", era: "1968", t: ["Is This Love – Bob Marley", "Do the Reggay – Toots & the Maytals (1968)"] },
  { id: "outlaw", l: "Outlaw", f: "Outlaw country", fam: "amber", cx: 195, r: 8, p: ["honkytonk"], rx: ["nashville"], g: "Country", era: "1970-tallet", t: ["Red Headed Stranger – Willie Nelson (1975)"] },
  { id: "fusion", l: "Fusion", f: "Jazz-fusion", fam: "purple", cx: 760, r: 8, p: ["modal", "funk", "rock"], g: "Jazz", era: "1970", t: ["Bitches Brew – Miles Davis (1970)", "Birdland – Weather Report (1977)"] },
  { id: "hiphop", l: "Hip-hop", f: "Hip-hop", fam: "pink", cx: 1340, r: 8, p: ["funk", "reggae", "disco"], g: "Hip-hop", era: "ca. 1979", t: ["Rapper's Delight – Sugarhill Gang (1979)", "The Message – Grandmaster Flash (1982)"] },
  { id: "disco", l: "Disco", f: "Disco", fam: "teal", cx: 1650, r: 8, p: ["funk", "soul"], g: "Klubbmusikk", era: "1974", t: ["Stayin' Alive – Bee Gees (1977)", "Le Freak – Chic (1978)"] },
  // House og techno er slått sammen (v3.97, brukervalg): to scener — Chicago og
  // Detroit — som deler puls, maskinpark og publikum, og som i pensumet uansett
  // leses som én elektronisk grunnstamme. Labelen bruker «&», ikke «/»: labelen
  // ER doc-ID-en i genreDescriptions, og Firestore forbyr «/» i doc-ID-er
  // (samme grunn som «Trance & DnB»).
  { id: "house", l: "House & techno", f: "House & techno", fam: "teal", cx: 1780, r: 9, p: ["disco"], g: "Klubbmusikk", era: "1980–85", t: ["Move Your Body – Marshall Jefferson", "Your Love – Frankie Knuckles", "Strings of Life – Derrick May", "Big Fun – Inner City"] },
  { id: "americana", l: "Americana", f: "Americana / alt-country", fam: "amber", cx: 70, r: 10, p: ["folk"], rx: ["nashville"], g: "Country", era: "1990-tallet", t: ["Oh My Sweet Carolina – Ryan Adams (2001)"] },
  { id: "neosoul", l: "Neo-soul", f: "Neo-soul", fam: "red", cx: 1130, r: 10, p: ["soul", "hiphop"], g: "R&B", era: "1990-tallet", t: ["On & On – Erykah Badu (1997)", "Brown Sugar – D'Angelo (1995)"] },
  { id: "trance", l: "Trance & DnB", f: "Trance & drum'n'bass", fam: "teal", cx: 1780, r: 10, p: ["house"], g: "Klubbmusikk", era: "1990-tallet", t: ["For an Angel – Paul van Dyk (1994)", "Timeless – Goldie (1995)"] },
  { id: "nujazz", l: "Nu-jazz", f: "Nu-jazz", fam: "purple", cx: 780, r: 10, p: ["fusion", "house", "fjelljazz"], g: "Jazz", era: "1997", t: ["Khmer – Nils Petter Molvær (1997)", "Existence – Bugge Wesseltoft (1998)"] },

  // --- Folk (revival) ---
  { id: "folk", l: "Folk", f: "Folk (revival)", fam: "amber", cx: 70, r: 7, p: ["eurofolk"], g: "Country", era: "1950–60-tallet", t: ["This Land Is Your Land – Woody Guthrie (1944)", "Blowin' in the Wind – Bob Dylan (1963)"] },

  // --- Rock ---
  { id: "rocknroll", l: "Rock'n'roll", f: "Rock'n'roll", fam: "rock", cx: 445, r: 6, p: ["rnb", "honkytonk"], g: "Rock", era: "1955", t: ["Johnny B. Goode – Chuck Berry (1958)", "Hound Dog – Elvis Presley (1956)"] },
  // «British invasion» er slått inn i Blues rock (v3.96, brukervalg): den var en
  // HENDELSE mer enn en stilart, hadde bare to artister — og begge sto allerede
  // i Blues rock — og lå under Blues selv om fenomenet hører rocken til.
  // Blues rock arver rock'n'roll som forelder, så linja rock'n'roll → britisk
  // bølge → blues rock ikke brytes, bare kortes ned. Låteksemplene fra den
  // britiske bølgen er beholdt her, og Blues rock-beskrivelsen fortalte allerede
  // historien om bølgen. Epoken utvides bakover til 1963, som var britinv-ens.
  { id: "bluesrock", l: "Blues rock", f: "Blues rock", fam: "blue", cx: 580, r: 7, p: ["chicagoblues", "rock"], g: "Blues", era: "1963–69", t: ["Crossroads – Cream (1968)", "Whole Lotta Love – Led Zeppelin (1969)", "(I Can't Get No) Satisfaction – The Rolling Stones (1965)", "For Your Love – The Yardbirds (1965)"] },

  // --- Rock ---
  { id: "rock", l: "Rock", f: "Rock", fam: "rock", cx: 445, r: 7, p: ["rocknroll"], g: "Rock", era: "tidlig 1960-tall", t: ["My Generation – The Who (1965)", "Light My Fire – The Doors (1967)"] },

  // --- Pop ---
  { id: "pop", l: "Pop", f: "Pop", fam: "pop", cx: 300, r: 7, p: ["tinpan", "rnb", "rocknroll"], g: "Pop", era: "1960-tallet", t: ["Be My Baby – The Ronettes (1963)", "Walk On By – Dionne Warwick (1964)"] },

  // --- Fjelljazz (ECM) ---
  { id: "fjelljazz", l: "Fjelljazz", f: "Fjelljazz (ECM)", fam: "purple", cx: 950, r: 8, p: ["modal", "free"], g: "Jazz", era: "1970-tallet", t: ["Dansere – Jan Garbarek (1976)", "Witchi-Tai-To – Jan Garbarek (1974)"] },

  // --- Country videre: tradisjonalistene ---
  // Neotradisjonalismen er 1980-tallets svar på countrypolitan-popen: Outlaw-
  // opprørets holdning møter honky tonk-instrumentene igjen. Ligger mellom
  // Outlaw (1970-t) og Cont. country (1990-t–) og binder dem sammen.
  // NB: KUN Outlaw som forelder. Honky tonk-arven og motreaksjonen mot Nashville
  // arves gjennom Outlaw, som allerede har begge — tegnet vi dem på nytt her,
  // ville strekene gått bak Nashville og Outlaw langs nøyaktig samme rute som
  // de eksisterende, og sett ut som doble streker.
  { id: "neotrad", l: "Neotrad. country", f: "Neotraditional country", fam: "amber", cx: 195, r: 9, p: ["outlaw"], g: "Country", era: "1980-tallet", t: ["Amarillo by Morning – George Strait (1983)", "Whoever's in New England – Reba McEntire (1986)"] },

  // --- Hip-hop videre ---
  { id: "gangsta", l: "Gangsta rap", f: "Gangsta rap", fam: "pink", cx: 1340, r: 10, p: ["hiphop"], g: "Hip-hop", era: "ca. 1990", t: ["Straight Outta Compton – N.W.A (1988)", "Nuthin' but a 'G' Thang – Dr. Dre (1992)"] },
  // Gullalderen sto uten egen node: «Hip-hop» rommet 22 artister fra 1973 til
  // 2003 — pionerene i Bronx, gullalderen OG midt-90-tallet i ett. Treet hoppet
  // dermed fra Sugarhill Gang rett til Gangsta rap, og hele østkysttradisjonen
  // manglet. Gangsta rap er bevisst IKKE forelder: den er samtidig med
  // gullalderen (N.W.A 1988), ikke etterkommer — de er to greiner ut fra
  // hip-hop, øst og vest.
  { id: "gullalder", l: "Gullalder-hip-hop", f: "Hip-hopens gullalder (boom bap)", fam: "pink", cx: 1340, r: 9, p: ["hiphop"], g: "Hip-hop", era: "1986–94", t: ["Fight the Power – Public Enemy (1989)", "C.R.E.A.M. – Wu-Tang Clan (1993)", "N.Y. State of Mind – Nas (1994)"] },
  { id: "trap", l: "Trap", f: "Trap", fam: "pink", cx: 1340, r: 12, p: ["gangsta"], g: "Hip-hop", era: "2000–2010-tallet", t: ["Sicko Mode – Travis Scott (2018)", "Mask Off – Future (2017)"] },

  // --- Elektronisk videre ---
  { id: "elektronika", l: "Elektronika", f: "Elektronika", fam: "teal", cx: 1780, r: 11, p: ["house"], g: "Klubbmusikk", era: "1990–2000-tallet", t: ["Windowlicker – Aphex Twin (1999)", "Midnight in a Perfect World – DJ Shadow (1996)"] },
  { id: "edm", l: "EDM", f: "EDM", fam: "teal", cx: 1780, r: 12, p: ["elektronika", "house"], g: "Klubbmusikk", era: "2010-tallet", t: ["Levels – Avicii (2011)", "Titanium – David Guetta ft. Sia (2011)"] },

  // --- Samtid ---
  // Sjangre som samler trådene i hver sin familie. Alle henter fra flere hold på
  // tvers av treet — det er hele poenget med dem: samtidsmusikken er der grenene
  // møtes igjen. Cont. R&B og Cont. hip-hop ligger på 2000-t-raden fordi 1990-t
  // allerede er full i den delen av kartet (Neo-soul, Gangsta rap); årstallet i
  // `era` er fasiten for når de oppsto, ikke raden.
  { id: "contjazz", l: "Cont. jazz", f: "Contemporary jazz", fam: "purple", cx: 780, r: 12, p: ["nujazz", "hiphop"], g: "Jazz", era: "2010-tallet", t: ["The Epic – Kamasi Washington (2015)", "Black Radio – Robert Glasper Experiment (2012)"] },
  { id: "contcountry", l: "Cont. country", f: "Contemporary country", fam: "amber", cx: 195, r: 12, p: ["neotrad", "nashville", "pop", "rock"], g: "Country", era: "1990-tallet–i dag", t: ["Need You Now – Lady Antebellum (2009)", "Cruise – Florida Georgia Line (2012)"] },
  { id: "contgospel", l: "Cont. gospel", f: "Contemporary gospel", fam: "olive", cx: 1070, r: 12, p: ["gospel", "hiphop", "neosoul"], g: "Gospel", era: "1990-tallet–i dag", t: ["Stomp – Kirk Franklin & God's Property (1997)", "Break Every Chain – Tasha Cobbs (2013)"] },
  { id: "contrnb", l: "Cont. R&B", f: "Contemporary R&B", fam: "red", cx: 1160, r: 11, p: ["funk", "hiphop"], g: "R&B", era: "1990-tallet–i dag", t: ["Real Love – Mary J. Blige (1992)", "Crazy in Love – Beyoncé (2003)"] },
  { id: "conthiphop", l: "Cont. hip-hop", f: "Contemporary hip-hop", fam: "pink", cx: 1440, r: 11, p: ["gullalder", "gangsta"], g: "Hip-hop", era: "1995–i dag", t: ["Jesus Walks – Kanye West (2004)", "Alright – Kendrick Lamar (2015)"] },
];

// Sjangervokabular for filteret (alle ekte sjangre i treet, ikke røtter).
export const GENEALOGY_MAIN_GENRES = [...new Set(GENEALOGY.filter((n) => n.g).map((n) => n.l))]
  .sort((a, b) => a.localeCompare(b, "no"));

// Metasjangre (treets kolonner): én rad per hovedretning. Beholder rekkefølgen
// fra GENEALOGY (≈ kronologisk) og utvides automatisk når nye metasjangre
// legges inn i treet. Er VOKABULARET — hvilke metasjangre som finnes — og brukes
// der rekkefølgen ikke betyr noe (nedtrekkslister, filtre, tellinger).
// Visningsflatene sorterer etter META_GENRE_ORDER under.
export const GENEALOGY_META_GENRES = [...new Set(GENEALOGY.filter((n) => n.g).map((n) => n.g))];

// Pedagogisk visningsrekkefølge for metasjangrene (brukervalg): den
// afroamerikanske linja samlet først — Blues → Jazz → R&B → Hip-hop →
// Klubbmusikk → Gospel — og deretter Country → Pop → Rock. Treets egen
// rekkefølge (GENEALOGY_META_GENRES ovenfor) er ≈ kronologisk og river disse
// slektskapene fra hverandre; her står familiene som henger sammen ved siden
// av hverandre. Brukes av artistenes tidslinje OG varmekartet — de to flatene
// deler mønster og fargespråk, og må derfor lese likt ovenfra og ned.
//
// Listen er en RANGERING, ikke en fasit på hvilke metasjangre som finnes: den
// sorterer det treet faktisk inneholder, og en ny metasjanger som ikke står her
// havner sist i treets egen rekkefølge i stedet for å forsvinne.
const META_ORDER_HINT = ["Blues", "Jazz", "R&B", "Hip-hop", "Klubbmusikk", "Gospel", "Country", "Pop", "Rock"];
export const META_GENRE_ORDER = (() => {
  const rank = new Map(META_ORDER_HINT.map((m, i) => [m, i]));
  // Array.sort er stabil, så ukjente metasjangre beholder treets rekkefølge seg imellom.
  return [...GENEALOGY_META_GENRES].sort(
    (a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
})();

// Alle koblinger (streker) i treet: avstamning/påvirkning (p) + motreaksjon
// (rx), i definisjonsrekkefølge. Delt av slektstreets trykkbaner, lærer-
// oversikten (koblinger uten beskrivelse) og eksport/import.
export const GENEALOGY_EDGES = (() => {
  const edges = [];
  GENEALOGY.forEach((n) => {
    const ps = n.p.slice();
    (n.rx || []).forEach((id) => { if (!ps.includes(id)) ps.push(id); });
    ps.forEach((pid) => edges.push({ from: pid, to: n.id, react: (n.rx || []).includes(pid) }));
  });
  return edges;
})();

// Dokument-ID i Firestore-samlingen edgeDescriptions for koblingen fra → til.
export function edgeKey(fromId, toId) {
  return `${fromId}__${toId}`;
}

// Er navnet en ekte tre-sjanger (mainGenre)? Brukes til å skille mainGenre fra
// frie undersjangre (subGenre). Delt av store, ui, explore og teacher.
const MAIN_GENRE_SET = new Set(GENEALOGY_MAIN_GENRES.map((g) => g.toLowerCase()));
export function isMainGenre(name) {
  return MAIN_GENRE_SET.has(String(name).toLowerCase());
}

// Finn tre-noden (ekte sjanger, g≠null) et navn peker på — matcher både label
// (l) og fullt navn (f), case-insensitivt. isMainGenre ser kun på labels og
// er riktig for KLASSIFISERING (tagger skal være l); denne er for NAVIGASJON,
// der også nodens fulle navn (f.eks. under-chippen «Outlaw country») skal
// finne frem til sjangerbeskrivelsen.
export function findTreeGenreNode(name) {
  const s = String(name).toLowerCase();
  return GENEALOGY.find((n) => n.g && (n.l.toLowerCase() === s || n.f.toLowerCase() === s)) || null;
}

// Main-beskrivelsen for en tre-sjanger. ÉN kilde, delt av visningen
// (showSjangerInfo under) og lærerens editor (teacher-content.js
// openSingleSubgenreModal) — de MÅ lese samme dokument.
//
// Oppslaget prøver både nodens label (l) og fulle navn (f), fordi 18 av 48
// noder har l≠f og eldre tekster kan ligge under fullnavnet. Skrivingen bruker
// derimot ALLTID labelen — den er doc-ID-en i genreDescriptions. Leste de to
// ulikt, ville editoren åpnet tom over en tekst som vises i popupen, og lagring
// ville lagd et duplikat under labelen.
export function resolveMainDesc(genreDescs, genreId) {
  const n = GENEALOGY.find((x) => x.l === genreId || x.f === genreId);
  return n
    ? resolveDescAny(genreDescs, [n.l, n.f], "main")
    : resolveDesc(genreDescs, genreId, "main");
}

// Varmelinja øverst på sjangerkortet: samme glidende stripe som i varmekartet,
// med tiårene over — så man ser sjangerens tyngdepunkt gjennom historien før man
// leser et eneste ord. Fargen er nodens egen familiefarge fra treet.
//
// Vises kun for ekte tre-sjangre (n.g) og kun når nivåene faktisk er lastet:
// tre.html laster ikke innhold i det hele tatt, og da er en tom grå linje verre
// enn ingen linje. Er nivåene lastet, men sjangeren mangler rad, står stripa
// som «ingen data» med en forklarende linje under — samme sannhet som
// varmekartet forteller.
function heatStripBlock(n) {
  const heat = getHeatData();
  if (!n.g || !heat) return "";
  const vals = heatRow(heat, n.l);
  const color = FAMILIES[n.fam]?.stroke || FAMILIES.gray.stroke;
  const tom = vals.every((v) => v == null);
  return `<div class="gx-heat">${heatAxisHtml()}${heatStripHtml(color, vals)}` +
    (tom ? `<p class="gx-heat-missing">Ingen varmekart-nivåer for denne sjangeren ennå.</p>` : "") +
    `</div>`;
}

// Vis sjanger-beskrivelse i #modal-sjanger uten å laste hele kartet.
// opts: { root, genreDescs, onShowArtists }
// Kortet som står åpent nå (label + opts), så det kan tegnes på nytt når data
// lander etter at det ble åpnet. Sporet HER, ikke i sidene, fordi kortet åpnes
// fra flere innganger: sjanger-bobler, tre-noder og lærerens oversikt. Sporing i
// én av dem ville bare dekket den ene.
let openSjanger = null;

// Tegn det åpne sjangerkortet på nytt. Gjør ingenting hvis ingen står åpent, så
// den er trygg å kalle fra et hvilket som helst snapshot.
export function refreshSjangerInfo() {
  if (!openSjanger) return false;
  const modal = (openSjanger.opts.root || document).querySelector("#modal-sjanger");
  if (!modal?.classList.contains("open")) return false;
  return showSjangerInfo(openSjanger.label, openSjanger.opts);
}

export function showSjangerInfo(label, opts = {}) {
  const { root = document, genreDescs = {}, artists = [], techItems = [], genres = [], onArtistClick, onTechClick, onMainGenreClick, onShowArtists, onShowPlaylist, onShowTimeline, onEdit, onPropose, hasPendingEdit } = opts;
  const map = Object.fromEntries(GENEALOGY.map((n) => [n.id, n]));
  const n = GENEALOGY.find((x) => x.l === label || x.f === label);
  if (!n) return false;
  const modal = root.querySelector("#modal-sjanger");
  const mTitle = root.querySelector("#sj-title");
  const mBody = root.querySelector("#sj-body");
  if (!modal || !mTitle || !mBody) return;

  const inf = n.p.map((p) => escapeHtml(map[p]?.f || p)).join(", ") || "—";
  const grewInto = GENEALOGY.filter((x) => x.p.includes(n.id)).map((x) => escapeHtml(x.f)).join(", ") || "—";
  const reactAgainst = (n.rx || []).map((p) => escapeHtml(map[p]?.f || p));
  const reactedBy = GENEALOGY.filter((x) => (x.rx || []).includes(n.id)).map((x) => escapeHtml(x.f));
  // Tre-noder er på «main»-nivå. Hent beskrivelse/kilder nivå-bevisst — kun
  // fra data (ingen fallback; mangler teksten, vises missingDesc under).
  // Delt resolver med lærerens editor, så de aldri leser ulike dokumenter.
  const resolved = resolveMainDesc(genreDescs, n.l);
  const descText = resolved.description;
  const kilderHtml = buildKilderList(resolved.kilder, "Kilder");

  const btnArea = [
    (n.g && onShowArtists) ? `<button type="button" class="btn ghost small gx-artists-btn">Artister</button>` : "",
    (n.g && onShowPlaylist) ? `<button type="button" class="btn ghost small gx-playlist-btn">Spilleliste</button>` : "",
    (n.g && onShowTimeline) ? `<button type="button" class="btn ghost small gx-timeline-btn">Tidslinje</button>` : "",
  ].filter(Boolean).join(" ");

  const lc = { artists, techItems, genres, onArtistClick, onTechClick, onMainGenreClick };
  openSjanger = { label, opts };
  mTitle.textContent = n.f;
  mBody.innerHTML = `
    ${heatStripBlock(n)}
    <p class="gx-era">${escapeHtml(n.era)}</p>
    <p class="gx-desc">${descText ? linkifyAll(descText, lc) : `<span class="gx-missing">${missingDesc("main")}</span>`}</p>
    <p class="gx-rel"><strong>Vokste ut av:</strong> ${inf}</p>
    ${reactAgainst.length ? `<p class="gx-rel gx-react-rel"><strong>Motreaksjon mot:</strong> ${reactAgainst.join(", ")}</p>` : ""}
    <p class="gx-rel"><strong>Førte videre til:</strong> ${grewInto}</p>
    ${reactedBy.length ? `<p class="gx-rel gx-react-rel"><strong>Reaksjoner mot denne:</strong> ${reactedBy.join(", ")}</p>` : ""}
    ${kilderHtml}
    ${btnArea ? `<div style="margin-top:10px;display:flex;gap:8px">${btnArea}</div>` : ""}`;
  wireAllLinks(mBody, lc);
  const b = mBody.querySelector(".gx-artists-btn");
  if (b) b.addEventListener("click", () => onShowArtists({ label: n.l }));
  const bp = mBody.querySelector(".gx-playlist-btn");
  if (bp) bp.addEventListener("click", () => onShowPlaylist({ label: n.l, fullName: n.f, node: n }));
  const bt = mBody.querySelector(".gx-timeline-btn");
  if (bt) bt.addEventListener("click", () => onShowTimeline({ label: n.l }));
  // Rediger (lærer): n.l er doc-ID-en i genreDescriptions — samme ID som
  // «Foreslå endring» under bruker, så begge veier treffer samme dokument.
  renderGenreEditBtn(root, onEdit ? () => onEdit(n.l, "main") : null);
  // Foreslå endring (student). entityId = n.l — SAMME dokument-ID som lærer-
  // redigering bruker (tidligere n.f, som traff et annet dokument). Nivået
  // «main» følger med så godkjenning skriver til riktig nivåfelt.
  const foot = root.querySelector("#sj-foot");
  const propBtn = root.querySelector("#sj-propose");
  if (foot && propBtn) {
    if (onPropose) {
      const locked = hasPendingEdit?.("subgenre", n.l);
      foot.style.display = "";
      propBtn.disabled = !!locked;
      propBtn.textContent = locked ? "Forslag venter på godkjenning" : "Foreslå endring";
      propBtn.onclick = () => onPropose({
        entityType: "subgenre",
        entityId: n.l,
        entityName: n.f,
        level: "main",
        currentValues: { description: descText || "" },
      });
    } else {
      foot.style.display = "none";
    }
  }
  modalOpen(modal);
  return true;
}

// Vis koblings-beskrivelse (en strek i treet) i #modal-sjanger. Tekstene bor i
// Firestore-samlingen edgeDescriptions (doc-ID = edgeKey(fra, til)) — ingen
// fallback i koden; mangler teksten, vises en tydelig mangler-melding (samme
// prinsipp som sjangerbeskrivelsene). opts: { root, edgeDescs, artists,
// techItems, genres, onArtistClick, onTechClick, onMainGenreClick, onEditEdge }
function showEdgeInfo(fromId, toId, opts = {}) {
  const { root = document, edgeDescs = {}, artists = [], techItems = [], genres = [], onArtistClick, onTechClick, onMainGenreClick, onEditEdge } = opts;
  const map = Object.fromEntries(GENEALOGY.map((n) => [n.id, n]));
  const a = map[fromId], b = map[toId];
  if (!a || !b) return false;
  const modal = root.querySelector("#modal-sjanger");
  const mTitle = root.querySelector("#sj-title");
  const mBody = root.querySelector("#sj-body");
  if (!modal || !mTitle || !mBody) return false;

  const react = (b.rx || []).includes(fromId);
  const doc = edgeDescs[edgeKey(fromId, toId)] || {};
  const descText = doc.description || "";
  const kilderHtml = buildKilderList(doc.kilder, "Kilder");

  // Sjanger-knappene åpner de to sjangrenes egne popuper (samme rute som
  // sjanger-tags), så koblingen alltid kan leses i sammenheng.
  const genreBtns = onMainGenreClick
    ? `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn ghost small gx-edge-from-btn">Om ${escapeHtml(a.l)}</button>
        <button type="button" class="btn ghost small gx-edge-to-btn">Om ${escapeHtml(b.l)}</button>
        ${onEditEdge ? `<button type="button" class="btn ghost small gx-edge-edit-btn">Rediger</button>` : ""}
      </div>`
    : "";

  const lc = { artists, techItems, genres, onArtistClick, onTechClick, onMainGenreClick };
  mTitle.textContent = `${a.f} → ${b.f}`;
  mBody.innerHTML = `
    <p class="gx-era">${react ? "Motreaksjon" : "Avstamning / påvirkning"} · ${escapeHtml(a.era)} → ${escapeHtml(b.era)}</p>
    <p class="gx-desc">${descText ? linkifyAll(descText, lc) : `<span class="gx-missing">${missingDesc("kobling")}</span>`}</p>
    ${kilderHtml}
    ${genreBtns}`;
  wireAllLinks(mBody, lc);
  const bf = mBody.querySelector(".gx-edge-from-btn");
  if (bf) bf.addEventListener("click", () => onMainGenreClick(a.l));
  const bt2 = mBody.querySelector(".gx-edge-to-btn");
  if (bt2) bt2.addEventListener("click", () => onMainGenreClick(b.l));
  const be2 = mBody.querySelector(".gx-edge-edit-btn");
  if (be2) be2.addEventListener("click", () => onEditEdge(fromId, toId));

  // «Foreslå endring»-foten og Rediger-ikonet i hodet gjelder sjanger-
  // beskrivelser — nullstill begge her, så de ikke blir stående igjen fra en
  // tidligere sjanger-popup i samme modal og redigerer feil sjanger.
  // (Koblingen har sin egen Rediger-knapp i kroppen, .gx-edge-edit-btn.)
  const foot = root.querySelector("#sj-foot");
  if (foot) foot.style.display = "none";
  renderGenreEditBtn(root, null);

  modalOpen(modal);
  return true;
}

const W = 1900, NW = 116, NH = 40, SVGNS = "http://www.w3.org/2000/svg";
const RY = { 0: 70, 1: 165, 2: 260, 3: 355, 4: 450, 5: 545, 6: 640, 7: 735, 8: 830, 9: 925, 10: 1020, 11: 1115, 12: 1210 };
const ROW_GAP = 95;   // avstand mellom RY-radene; brukes til node-yOffset (brøkdel av en rad)
const DEC = { 0: "Røtter", 1: "1900", 2: "1910-t", 3: "1920-t", 4: "1930-t", 5: "1940-t", 6: "1950-t", 7: "1960-t", 8: "1970-t", 9: "1980-t", 10: "1990-t", 11: "2000-t", 12: "2010-t" };
// Sjangerfamilier: strekfarge + etikett til fargeforklaringen. Rekkefølgen her
// styrer rekkefølgen i forklaringen. Familier som brukes i treet, men mangler
// her, varsles i konsollen og tegnes uten farge (se renderGenealogy).
const FAMILIES = {
  blue:   { stroke: "#3b82f6", label: "Blues" },
  rock:   { stroke: "#334155", label: "Rock" },
  pop:    { stroke: "#c026d3", label: "Pop" },
  amber:  { stroke: "#d97706", label: "Country" },
  purple: { stroke: "#7c3aed", label: "Jazz" },
  red:    { stroke: "#dc2626", label: "R&B / soul / funk" },
  // Gospel ble skilt ut av den røde familien i v3.88 (R&B overtok rødt) og måtte
  // UT av rød-rosa-aksen, ikke bare et hakk til side i den: rødt (R&B), rosa
  // (hip-hop) og fuchsia (Pop) ligger allerede tett, og en burgunder mellom dem
  // ble enten forvekslet med rosa eller så mørk at den leste som svart.
  // Oliven er den eneste ledige kulørsonen i paletten — 90° fra Klubbmusikkens
  // turkis og tydelig mattere enn reggae-grønnen den deler legend med.
  olive:  { stroke: "#4d7c0f", label: "Gospel" },
  teal:   { stroke: "#0d9488", label: "Disco / electronica" },
  pink:   { stroke: "#db2777", label: "Hip-hop" },
  green:  { stroke: "#16a34a", label: "Reggae" },
  gray:   { stroke: "#9bada1", label: "Røtter" },
};
const FAM_STROKE = Object.fromEntries(Object.entries(FAMILIES).map(([k, v]) => [k, v.stroke]));

// Fargepaletten + per-sjanger-oppslag eksponeres så andre visninger (f.eks.
// varmekartet) kan gruppere mainGenre etter metaGenre og fargelegge dem med
// nøyaktig de samme slektstre-familiefargene.
export { FAMILIES };
export const MAIN_GENRE_INFO = Object.fromEntries(
  GENEALOGY.filter((n) => n.g).map((n) => [n.l, {
    meta: n.g,                                  // metaGenre (metasjanger)
    fam: n.fam,                                 // familienøkkel i treet
    color: FAMILIES[n.fam]?.stroke || FAMILIES.gray.stroke,
  }])
);

// Farge per METASJANGER (metaGenre): familiefargen som flest av metasjangerens
// tre-noder bruker. Utledet, ikke hardkodet — en ny node med ny familie flytter
// automatisk fargen hvis den blir den vanligste. Brukt av sjangerhistorie-
// knappene, så de snakker samme fargespråk som treet.
//
// Det finnes BEVISST ingen unntaksliste lenger (v3.88): hver metasjanger har nå
// sin egen familie, så tellingen alene gir syv ulike farger. Tidligere måtte
// R&B låne hip-hop-rosa fordi R&B og Gospel delte den røde familien; nå har
// Gospel fått «wine» og hip-hop er egen metasjanger som beholder rosa.
//
// «gray» holdes utenfor tellingen: den er røttenes farge, ikke en identitet en
// metasjanger kan arve. Uten den regelen ville Tin Pan Alley (gray) og Pop (pop)
// stått 1–1 i Pop, og Pop fått røtter-gråen — samme grå som «Røtter» i
// forklaringen. Skulle en metasjanger bestå av bare gray-noder, faller den
// tilbake til gråen med vilje.
export const META_GENRE_COLOR = (() => {
  const tally = {};                              // meta → { fam: antall }
  for (const n of GENEALOGY) {
    if (!n.g || n.fam === "gray") continue;
    (tally[n.g] ||= {})[n.fam] = (tally[n.g][n.fam] || 0) + 1;
  }
  const metas = [...new Set(GENEALOGY.filter((n) => n.g).map((n) => n.g))];
  return Object.fromEntries(metas.map((meta) => {
    const fams = Object.entries(tally[meta] || {}).sort((a, b) => b[1] - a[1]);
    return [meta, FAMILIES[fams[0]?.[0]]?.stroke || FAMILIES.gray.stroke];
  }));
})();

function el(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// ----------------------------------------------------------------------------
//  Bygger kartet i modal-rotelementet. Returnerer { fit } for å sentrere ved
//  hver åpning. opts: { root, genreDescs, onShowArtists }
// ----------------------------------------------------------------------------
export function renderGenealogy({ root, genreDescs = {}, edgeDescs = {}, artists: staticArtists, getArtists, getTechItems, getMainGenres, onArtistClick, onTechClick, onMainGenreClick, onShowArtists, onShowPlaylist }) {
  const artists = getArtists ? { get current() { return getArtists(); } } : { current: staticArtists || [] };
  const tech = getTechItems ? { get current() { return getTechItems(); } } : { current: [] };
  const genreProxy = getMainGenres ? { get current() { return getMainGenres(); } } : { current: [] };
  const stage = root.querySelector("#gx-stage");
  const cam = root.querySelector("#gx-cam");
  const modal = root.querySelector("#modal-sjanger");

  const map = {}, kids = {};
  // yOffset (brøkdel av en rad, valgfritt): lar en node ligge litt UNDER
  // gridlinja i sitt eget tiårsbånd — brukt der en sjanger nedstammer fra en
  // node i SAMME tiår (blues↔work songs, blues rock↔British invasion, modal↔cool),
  // så «forelder over barn» bevares uten å bryte rad = tiår.
  GENEALOGY.forEach((n) => { n.y = RY[n.r] + (n.yOffset || 0) * ROW_GAP; n.rx = n.rx || []; map[n.id] = n; kids[n.id] = []; });
  // Alle foreldre = avstamning (p) + motreaksjon (rx)
  const parentsOf = (n) => { const a = n.p.slice(); n.rx.forEach((id) => { if (!a.includes(id)) a.push(id); }); return a; };
  GENEALOGY.forEach((n) => parentsOf(n).forEach((p) => { if (kids[p]) kids[p].push(n.id); }));

  const anc = (id, s = {}) => { parentsOf(map[id]).forEach((p) => { if (!s[p]) { s[p] = 1; anc(p, s); } }); return s; };

  cam.innerHTML = "";

  // Tiår-rutenett (tids-aksen)
  for (let r = 0; r <= 12; r++) {
    cam.appendChild(el("line", { x1: 0, y1: RY[r] - 47, x2: W, y2: RY[r] - 47, class: "gx-grid" }));
    const dl = el("text", { x: 14, y: RY[r] - 40, class: "gx-decade" });
    dl.textContent = DEC[r];
    cam.appendChild(dl);
  }

  // Kanter — heltrukne = avstamning, stiplet = motreaksjon
  const edges = [], edgeHits = [];
  GENEALOGY.forEach((n) => parentsOf(n).forEach((pid) => {
    const pa = map[pid];
    const reaction = n.rx.includes(pid);
    let d;
    if (pa.r === n.r) {
      // Samme tiår: bue under begge nodene
      const y1 = pa.y + NH / 2, y2 = n.y + NH / 2, bow = 46;
      d = `M${pa.cx},${y1} C${pa.cx},${y1 + bow} ${n.cx},${y2 + bow} ${n.cx},${y2}`;
    } else {
      const x1 = pa.cx, y1 = pa.y + NH / 2, x2 = n.cx, y2 = n.y - NH / 2, ym = (y1 + y2) / 2;
      d = `M${x1},${y1} C${x1},${ym} ${x2},${ym} ${x2},${y2}`;
    }
    const path = el("path", { d, class: "gx-edge" + (reaction ? " gx-react" : "") });
    path.dataset.p = pid; path.dataset.c = n.id; path.dataset.fam = n.fam; path.dataset.react = reaction ? "1" : "";
    cam.appendChild(path); edges.push(path);
    // Usynlig, bred trykkbane oppå streken: en ~1,4 px linje er umulig å
    // treffe med finger (og fiklete med mus), så denne fanger klikk/hover for
    // koblingen. Nodene tegnes senere og ligger derfor alltid øverst.
    const hit = el("path", { d, class: "gx-edge-hit" });
    hit.dataset.p = pid; hit.dataset.c = n.id;
    cam.appendChild(hit); edgeHits.push(hit);
  }));

  // Noder
  const gnodes = {};
  GENEALOGY.forEach((n) => {
    const g = el("g", { class: "gx-node gx-f-" + n.fam });
    g.dataset.id = n.id;
    const rect = el("rect", { x: n.cx - NW / 2, y: n.y - NH / 2, width: NW, height: NH, rx: 8 });
    g.appendChild(rect);
    const tx = el("text", { x: n.cx, y: n.y, "text-anchor": "middle", "dominant-baseline": "central" });
    tx.textContent = n.l;
    g.appendChild(tx); cam.appendChild(g); gnodes[n.id] = g;
    // Noen etiketter er bredere enn NW («British invasion»); boksen utvides
    // til teksten så fokus-fyllet ved hover dekker hele navnet. Måling krever
    // synlig DOM — utenfor dokumentflyt blir bredden 0 og NW beholdes.
    const w = (tx.getComputedTextLength ? tx.getComputedTextLength() : 0) + 18;
    if (w > NW) {
      // KLEM mot nærmeste nabo i samme rad: den usynlige trefflata skal aldri
      // nå forbi midtpunktet mot naboen, ellers treffer klikk/hover ved kanten
      // feil node (målt overlapp på britinv/modal og chicagoblues/bebop).
      let nearestHalf = Infinity;
      for (const m of GENEALOGY) {
        if (m.r === n.r && m.id !== n.id) nearestHalf = Math.min(nearestHalf, Math.abs(m.cx - n.cx) / 2);
      }
      const half = Math.min(w / 2, Math.max(NW / 2, nearestHalf - 2));
      rect.setAttribute("x", n.cx - half);
      rect.setAttribute("width", half * 2);
    }
  });

  // Utheving (vises ved hover): hele anelinjen bakover + kun direkte barn
  // fremover. Full etterkommer-lukning lyste opp 60–90 % av kartet for de
  // tidlige sjangrene (blues, gospel …) og mistet all effekt; historien
  // videre nedover følges ledd for ledd, eller via popupens «Førte videre til».
  let moved = false;
  function light(id) {
    const ancSelf = anc(id); ancSelf[id] = 1;
    const line = Object.assign({}, ancSelf);
    kids[id].forEach((c) => { line[c] = 1; });
    GENEALOGY.forEach((n) => {
      gnodes[n.id].classList.toggle("gx-dim", !line[n.id]);
      gnodes[n.id].classList.toggle("gx-focus", n.id === id);
    });
    edges.forEach((e) => {
      // Kun streker som ligger på de opplyste banene: innad i anelinjen
      // (koblingens barn er ane eller sjangeren selv) eller ut til et direkte
      // barn. «Begge endepunkter lyser» holdt ikke — det tente snarveier
      // utenom sjangeren (f.eks. blues→R&B ved hover på gospel).
      const on = ancSelf[e.dataset.c] || e.dataset.p === id;
      e.classList.toggle("gx-hl", !!on);
      e.classList.toggle("gx-dim", !on);
      e.style.stroke = on ? (e.dataset.react ? "#d97706" : (FAM_STROKE[e.dataset.fam] || "")) : "";
    });
  }
  // Utheving av ÉN kobling (hover på trykkbane): de to endepunkt-nodene +
  // selve streken lyser, alt annet dimmes.
  function lightEdge(pid, cid) {
    GENEALOGY.forEach((n) => {
      gnodes[n.id].classList.toggle("gx-dim", n.id !== pid && n.id !== cid);
      gnodes[n.id].classList.remove("gx-focus");
    });
    edges.forEach((e) => {
      const on = e.dataset.p === pid && e.dataset.c === cid;
      e.classList.toggle("gx-hl", on);
      e.classList.toggle("gx-dim", !on);
      e.style.stroke = on ? (e.dataset.react ? "#d97706" : (FAM_STROKE[e.dataset.fam] || "")) : "";
    });
  }
  function clearLight() {
    GENEALOGY.forEach((n) => gnodes[n.id].classList.remove("gx-dim", "gx-focus"));
    edges.forEach((e) => { e.classList.remove("gx-hl", "gx-dim"); e.style.stroke = ""; });
  }

  // --- Touch: uten hover trykker man for å lyse opp. Første trykk på en node
  //     dimmer alt utenom slekta (nøyaktig som hover på Mac) og viser et lite
  //     kort nederst; andre trykk på samme node — eller «Detaljer»-knappen —
  //     åpner popupen. Kun på touch/pen; mus beholder hover + direkte klikk. ---
  let selectedId = null;
  let lastPointerType = "mouse";
  const card = document.createElement("div");
  card.className = "gx-card";
  card.innerHTML =
    `<span class="gx-card-dot"></span>` +
    `<span class="gx-card-name"></span>` +
    `<button type="button" class="btn ghost small gx-card-btn">Detaljer</button>`;
  stage.appendChild(card);
  const cardDot = card.querySelector(".gx-card-dot");
  const cardName = card.querySelector(".gx-card-name");
  card.querySelector(".gx-card-btn").addEventListener("click", (ev) => {
    ev.stopPropagation();               // ellers ville stage-klikket nullstilt valget
    if (selectedId) openModal(selectedId);
  });
  function showCard(n) {
    cardName.textContent = n.l;
    cardDot.style.background = FAM_STROKE[n.fam] || FAM_STROKE.gray;
    card.classList.add("show");
  }
  function selectTouch(id) { selectedId = id; light(id); showCard(map[id]); }
  function clearTouchSel() { selectedId = null; card.classList.remove("show"); }
  const isTouch = () => lastPointerType === "touch" || lastPointerType === "pen";

  function reset() { clearLight(); clearTouchSel(); }

  // Klikk → popup med detaljer. Bruker den delte showSjangerInfo, så node-klikk
  // og tag-klikk alltid viser nøyaktig samme popup (én kilde til sannhet).
  function openModal(id) {
    const n = map[id];
    showSjangerInfo(n.l, {
      root, genreDescs,
      artists: artists.current, techItems: tech.current, genres: genreProxy.current,
      onArtistClick, onTechClick, onMainGenreClick,
      onShowArtists, onShowPlaylist,
    });
  }

  // Klikk på strek → koblings-popup (samme modal, delt showEdgeInfo).
  function openEdgeModal(pid, cid) {
    showEdgeInfo(pid, cid, {
      root, edgeDescs,
      artists: artists.current, techItems: tech.current, genres: genreProxy.current,
      onArtistClick, onTechClick, onMainGenreClick,
    });
  }

  GENEALOGY.forEach((n) => {
    const g = gnodes[n.id];
    // Hover-lyset skal ikke overstyre et aktivt touch-valg (mus-events kan bli
    // syntetisert etter et trykk på touch), derfor sjekk selectedId.
    g.addEventListener("mouseenter", () => { if (!selectedId) light(n.id); });
    g.addEventListener("mouseleave", () => { if (!selectedId) clearLight(); });
    g.addEventListener("click", (ev) => {
      if (moved) return;
      ev.stopPropagation();
      if (!isTouch()) { openModal(n.id); return; }   // mus: som før
      if (selectedId === n.id) openModal(n.id);        // andre trykk → detaljer
      else selectTouch(n.id);                           // første trykk → lys opp
    });
  });

  // Trykkbanene: hover lyser opp koblingen (kun mus — touch-valget skal ikke
  // overstyres), klikk/tap åpner koblings-popupen direkte på begge plattformer
  // (popupen ER poenget med en strek, i motsetning til nodenes to-trinns-trykk).
  edgeHits.forEach((h) => {
    const pid = h.dataset.p, cid = h.dataset.c;
    h.addEventListener("mouseenter", () => { if (!selectedId) lightEdge(pid, cid); });
    h.addEventListener("mouseleave", () => { if (!selectedId) clearLight(); });
    h.addEventListener("click", (ev) => {
      if (moved) return;
      ev.stopPropagation();               // ikke la stage-klikket nullstille lyset
      openEdgeModal(pid, cid);
    });
  });

  // Lukking av popup (backdrop-klikk + ✕). Escape håndteres på sidenivå
  // (tre.js sin modalCloseTop), så vi registrerer IKKE en egen Escape-lytter
  // her — ellers ville Escape lukket både denne popupen og en stablet modal
  // (f.eks. artistlista) samtidig.
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal) modalClose(modal); });
    const cl = modal.querySelector(".modal-close");
    if (cl) cl.addEventListener("click", () => modalClose(modal));
  }

  // Pan / zoom
  let sc = 0.56, tx = 20, ty = 10;
  function apply() { cam.setAttribute("transform", `translate(${tx},${ty}) scale(${sc})`); }
  function fit() {
    const sw = stage.clientWidth || 760;
    sc = sw / (W + 30);
    tx = (sw - W * sc) / 2;
    ty = 10;
    apply();
  }
  function zoom(f, cx, cy) {
    const sw = stage.clientWidth || 760, sh = stage.clientHeight || 440;
    cx = cx == null ? sw / 2 : cx; cy = cy == null ? sh / 2 : cy;
    const ns = Math.max(0.3, Math.min(1.8, sc * f));
    tx = cx - (cx - tx) * (ns / sc); ty = cy - (cy - ty) * (ns / sc); sc = ns; apply();
  }
  root.querySelector("#gx-zin").addEventListener("click", () => zoom(1.25));
  root.querySelector("#gx-zout").addEventListener("click", () => zoom(0.8));
  root.querySelector("#gx-rst").addEventListener("click", () => { fit(); reset(); });

  stage.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const rect = stage.getBoundingClientRect();
    zoom(ev.deltaY < 0 ? 1.12 : 0.9, ev.clientX - rect.left, ev.clientY - rect.top);
  }, { passive: false });

  // Peker-styrt pan + pinch-zoom. Ett Map fra pointerId → siste posisjon, så to
  // fingre ALDRI deler ett (sx,sy)-par (som ga ville pan-hopp: finger nr. 2
  // overskrev startpunktet og begge fingres move regnet dx/dy på kryss). Én
  // peker = pan; to pekere = pinch-zoom om midtpunktet. Speiler constellation.js.
  const pointers = new Map();
  let pinchDist = 0;
  stage.addEventListener("pointerdown", (ev) => {
    lastPointerType = ev.pointerType || "mouse";
    const first = pointers.size === 0;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (first) { moved = false; stage.classList.add("gx-drag"); }
    else pinchDist = 0;   // andre finger ned: nullstill pinch-referansen
  });
  stage.addEventListener("pointermove", (ev) => {
    if (!pointers.has(ev.pointerId)) return;
    const prev = pointers.get(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 1) {
      const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      tx += dx; ty += dy; apply();
    } else if (pointers.size === 2) {
      moved = true;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (pinchDist > 0) {
        const rect = stage.getBoundingClientRect();
        zoom(d / pinchDist, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      }
      pinchDist = d;
    }
  });
  const endPtr = (ev) => {
    pointers.delete(ev.pointerId);
    pinchDist = 0;
    if (!pointers.size) stage.classList.remove("gx-drag");
  };
  window.addEventListener("pointerup", endPtr);
  stage.addEventListener("pointercancel", endPtr);
  stage.addEventListener("click", (ev) => {
    // Trykk på tomt kart (ikke node, ikke mini-kortet) nullstiller lys + valg.
    if (!ev.target.closest(".gx-node") && !ev.target.closest(".gx-card") && !moved) reset();
  });

  // Forklaring: kun strektypene (avstamning vs. motreaksjon). Fargene varsles
  // fortsatt i konsollen hvis en nodefamilie mangler strekfarge (brukt ved hover).
  new Set(GENEALOGY.map((n) => n.fam)).forEach((fam) => {
    if (!FAMILIES[fam]) console.warn(`Slektstre: fam «${fam}» mangler i FAMILIES (ingen strekfarge ved hover).`);
  });
  const legend = root.querySelector("#gx-legend");
  if (legend) {
    legend.innerHTML =
      `<div class="gx-leg"><span class="gx-sw-line gx-sw-solid"></span>avstamning / påvirkning</div>` +
      `<div class="gx-leg"><span class="gx-sw-line"></span>motreaksjon</div>` +
      `<div class="gx-leg gx-leg-hint">klikk på en strek for å lese om koblingen</div>`;
  }

  reset();
  apply();
  return { fit };
}

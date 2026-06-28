// ============================================================================
//  SLEKTSTRE — «Carta» i musicmap-stil
// ----------------------------------------------------------------------------
//  2D-kart: tid løper nedover, supersjanger bortover. Dra for å panorere,
//  scroll/knapper for å zoome, hover lyser opp påvirkningslinjene, klikk åpner
//  panel med beskrivelse + spilleliste. Strukturen er fast og designet for
//  lesbarhet; beskrivelser kan overstyres fra Firestore (subgenres-samlingen).
// ============================================================================

import { linkifyAll, wireAllLinks } from "./linkify.js?v=2.50";
import { escapeHtml, buildKilderList } from "./util.js?v=2.50";

// rad (r) → tiår; tid løper nedover.
export const GENEALOGY = [
  { id: "eurofolk", l: "Euro-folk", f: "Europeisk folkemusikk", fam: "gray", cx: 400, r: 0, p: [], g: null, era: "Røtter", d: "Appalachiske ballader, salmer og britiske music halls — de hvite nybyggernes arv.", t: [] },
  { id: "vestafrik", l: "Vestafrikansk", f: "Vestafrikansk musikk", fam: "gray", cx: 700, r: 0, p: [], g: null, era: "Røtter", d: "Griot-tradisjon, work songs, call & response og rytmefokus — kjernen i nesten alt som kommer etter.", t: [] },
  { id: "worksongs", l: "Work songs", f: "Work songs / field hollers", fam: "gray", cx: 580, r: 1, p: ["vestafrik"], g: null, era: "1800-tallet", d: "Arbeidssanger på plantasjene; dialog mellom solist og gruppe.", t: ["I'll Be So Glad When the Sun Goes Down (1959)"] },
  { id: "spirituals", l: "Spirituals", f: "Negro spirituals", fam: "gray", cx: 1070, r: 1, p: ["vestafrik"], g: null, era: "1800-tallet", d: "Religiøse sanger som blandet europeiske salmer med afrikansk uttrykk.", t: ["Swing Low (1909)", "Slave Songs of the United States (1867)"] },
  { id: "blues", l: "Blues", f: "Blues", fam: "blue", cx: 580, r: 2, p: ["worksongs"], g: "Blues", era: "ca. 1900", d: "Verdslig, individuell sang om smerte og lengsel. Grunnmuren for nesten all populærmusikk.", t: ["Cross Road Blues – Robert Johnson (1937)", "St. Louis Blues – Bessie Smith (1925)"] },
  { id: "ragtime", l: "Ragtime", f: "Ragtime", fam: "purple", cx: 700, r: 2, p: ["vestafrik"], g: "Jazz", era: "1897", d: "Komponert og notert, synkopert pianomusikk. Bindeledd mot jazzen.", t: ["Maple Leaf Rag – Scott Joplin", "The Entertainer – Scott Joplin"] },
  { id: "tinpan", l: "Tin Pan Alley", f: "Tin Pan Alley", fam: "gray", cx: 450, r: 2, p: ["eurofolk"], g: "R&B", era: "1910–50", d: "Låtskriversamlebånd i New York; «the American songbook».", t: ["White Christmas – Irving Berlin (1942)", "Summertime – Gershwin (1935)"] },
  { id: "jazz", l: "Jazz", f: "Jazz", fam: "purple", cx: 700, r: 3, p: ["ragtime", "blues"], g: "Jazz", era: "ca. 1915", d: "Født i New Orleans av ragtime «played hot» + blues. Improvisasjon og swing.", t: ["Dipper Mouth Blues – King Oliver (1923)", "West End Blues – Louis Armstrong (1928)"] },
  { id: "country", l: "Country", f: "Country (hillbilly)", fam: "amber", cx: 330, r: 3, p: ["eurofolk", "blues"], g: "Country", era: "1920-tallet", d: "De hvites folkemusikk, formet av skotsk-irsk arv, vaudeville og blues.", t: ["Wildwood Flower – Carter Family (1928)", "Blue Yodel – Jimmie Rodgers (1929)"] },
  { id: "gospel", l: "Gospel", f: "Gospel", fam: "red", cx: 1070, r: 3, p: ["spirituals", "blues"], g: "Gospel", era: "1930-tallet", d: "Komponert kirkemusikk med blues-driv. Vugge for soul og R&B.", t: ["Precious Lord, Take My Hand – Dorsey (1932)", "Lord Don't Move the Mountain – Mahalia Jackson"] },
  { id: "swing", l: "Swing", f: "Swing", fam: "purple", cx: 700, r: 4, p: ["jazz"], g: "Jazz", era: "1930–45", d: "Storband-jazz som ble USAs danse- og popmusikk.", t: ["Sing, Sing, Sing – Benny Goodman (1937)", "Take the A Train – Duke Ellington (1941)"] },
  { id: "bluegrass", l: "Bluegrass", f: "Bluegrass", fam: "amber", cx: 70, r: 5, p: ["country"], g: "Country", era: "1939", d: "Tradisjonsbundet country med virtuost strengespill.", t: ["Uncle Pen – Bill Monroe (1965)"] },
  { id: "honkytonk", l: "Honky tonk", f: "Honky tonk", fam: "amber", cx: 195, r: 5, p: ["country"], g: "Country", era: "1940-tallet", d: "Røff bar-country om drikking og hjertesorg, elektrisk forsterket.", t: ["Lovesick Blues – Hank Williams (1949)", "Your Cheatin' Heart – Hank Williams (1953)"] },
  { id: "bebop", l: "Bebop", f: "Bebop", fam: "purple", cx: 700, r: 5, p: ["swing"], rx: ["swing"], g: "Jazz", era: "1945", d: "Kunstnerisk opprør mot kommersialisert swing: jazzen går fra dansemusikk til lyttemusikk.", t: ["Koko – Charlie Parker", "A Night in Tunisia – Dizzy Gillespie"] },
  { id: "rnb", l: "R&B", f: "Rhythm & blues", fam: "red", cx: 1190, r: 5, p: ["blues", "gospel"], g: "R&B", era: "1940-tallet", d: "Blues + jazzens energi + gospelens vokal. Forløper for soul og rock.", t: ["Beans and Cornbread – Louis Jordan (1949)", "Hallelujah I Love Her So – Ray Charles (1956)"] },
  { id: "nashville", l: "Nashville", f: "Nashville-sound", fam: "amber", cx: 195, r: 6, p: ["honkytonk"], g: "Country", era: "1957", d: "Polert, pop-orientert country med strykere og kor.", t: ["Crazy – Patsy Cline (1961)", "Four Walls – Jim Reeves (1957)"] },
  { id: "chicagoblues", l: "Chicago blues", f: "Chicago blues", fam: "blue", cx: 580, r: 6, p: ["blues"], g: "Blues", era: "1948", d: "Elektrisk, råere byblues. Tente den britiske blues-bølgen og rocken.", t: ["Got My Mojo Workin' – Muddy Waters (1956)", "Call It Stormy Monday – T-Bone Walker (1948)"] },
  { id: "cool", l: "Cool jazz", f: "Cool jazz", fam: "purple", cx: 700, r: 6, p: ["bebop"], rx: ["bebop"], g: "Jazz", era: "1949", d: "Intellektuell motreaksjon mot bebop: dempet, lyrisk, behersket.", t: ["Take Five – Dave Brubeck (1959)", "Birth of the Cool – Miles Davis"] },
  { id: "hardbop", l: "Hard bop", f: "Hard bop", fam: "purple", cx: 825, r: 6, p: ["bebop"], rx: ["cool"], g: "Jazz", era: "1955", d: "Motreaksjon mot cool jazz — tilbake til de afroamerikanske røttene: blues- og gospel-drevet.", t: ["Moanin' – Art Blakey (1959)"] },
  { id: "soul", l: "Soul", f: "Soul", fam: "red", cx: 1190, r: 6, p: ["gospel", "rnb"], g: "R&B", era: "1959", d: "Gospel møter R&B. Lydsporet til borgerrettskampen.", t: ["Respect – Aretha Franklin (1967)", "A Change Is Gonna Come – Sam Cooke (1964)"] },
  { id: "modal", l: "Modal jazz", f: "Modal jazz", fam: "purple", cx: 700, r: 7, p: ["bebop"], g: "Jazz", era: "1958", d: "Frigjøring fra akkordene; bygd på skalaer og stemninger.", t: ["So What – Miles Davis (1959)", "A Love Supreme – John Coltrane (1964)"] },
  { id: "free", l: "Free jazz", f: "Free jazz", fam: "purple", cx: 825, r: 7, p: ["bebop"], rx: ["hardbop"], g: "Jazz", era: "1960", d: "Motreaksjon mot fast struktur (hard bop/modal): frigjøring fra alt, kollektiv improvisasjon.", t: ["Free Jazz – Ornette Coleman (1961)"] },
  { id: "funk", l: "Funk", f: "Funk", fam: "red", cx: 1190, r: 7, p: ["soul"], g: "R&B", era: "1967", d: "Alt destillert til rytme og groove. Peker mot hip-hop.", t: ["Papa's Got a Brand New Bag – James Brown", "Chameleon – Herbie Hancock (1973)"] },
  { id: "reggae", l: "Reggae", f: "Reggae & dub", fam: "green", cx: 1320, r: 7, p: ["rnb"], g: "R&B", era: "1968", d: "Jamaicansk off-beat med «riddim». Toasting → grunnlaget for rap.", t: ["Is This Love – Bob Marley", "Do the Reggay – Toots & the Maytals (1968)"] },
  { id: "outlaw", l: "Outlaw", f: "Outlaw country", fam: "amber", cx: 195, r: 8, p: ["honkytonk"], rx: ["nashville"], g: "Country", era: "1970-tallet", d: "Opprør mot det polerte Nashville-systemet: røffere uttrykk og kunstnerisk frihet.", t: ["Red Headed Stranger – Willie Nelson (1975)"] },
  { id: "fusion", l: "Fusion", f: "Jazz-fusion", fam: "purple", cx: 760, r: 8, p: ["jazz", "funk"], g: "Jazz", era: "1970", d: "Jazz + rock + funk + verdens folkemusikk. Elektrisk og global.", t: ["Bitches Brew – Miles Davis (1970)", "Birdland – Weather Report (1977)"] },
  { id: "hiphop", l: "Hip-hop", f: "Hip-hop", fam: "pink", cx: 1250, r: 9, p: ["funk", "reggae"], g: "R&B", era: "ca. 1979", d: "Bronx-kultur: DJ-ing, MC-ing, breakdance, graffiti. Beat over melodi.", t: ["Rapper's Delight – Sugarhill Gang (1979)", "The Message – Grandmaster Flash (1982)"] },
  { id: "disco", l: "Disco", f: "Disco", fam: "teal", cx: 1380, r: 8, p: ["funk", "soul"], g: "Klubbmusikk", era: "1974", d: "Four-on-the-floor fra klubbene. Vugge for all klubbmusikk.", t: ["Stayin' Alive – Bee Gees (1977)", "Le Freak – Chic (1978)"] },
  { id: "house", l: "House", f: "House", fam: "teal", cx: 1510, r: 9, p: ["disco"], g: "Klubbmusikk", era: "1980", d: "Disco gjenfødt på trommemaskin i Chicago-klubbene.", t: ["Move Your Body – Marshall Jefferson", "Your Love – Frankie Knuckles"] },
  { id: "techno", l: "Techno", f: "Techno", fam: "teal", cx: 1380, r: 9, p: ["house", "disco"], g: "Klubbmusikk", era: "1985", d: "Detroits futuristiske, maskinelle svar på house.", t: ["Strings of Life – Derrick May", "Big Fun – Inner City"] },
  { id: "americana", l: "Americana", f: "Americana / alt-country", fam: "amber", cx: 70, r: 10, p: ["country", "folk"], rx: ["nashville"], g: "Country", era: "1990-tallet", d: "Jordnær, kritikerhyllet motvekt til mainstream-Nashville.", t: ["Oh My Sweet Carolina – Ryan Adams (2001)"] },
  { id: "neosoul", l: "Neo-soul", f: "Neo-soul", fam: "red", cx: 1130, r: 10, p: ["soul", "hiphop"], g: "R&B", era: "1990-tallet", d: "Soul med hip-hop-mikrorytmikk og rike harmonier.", t: ["On & On – Erykah Badu (1997)", "Brown Sugar – D'Angelo (1995)"] },
  { id: "trance", l: "Trance / DnB", f: "Trance & drum'n'bass", fam: "teal", cx: 1510, r: 10, p: ["techno", "house"], g: "Klubbmusikk", era: "1990-tallet", d: "Rave-eksplosjonen: melodisk trance og høyt tempo drum'n'bass.", t: ["For an Angel – Paul van Dyk (1994)", "Timeless – Goldie (1995)"] },
  { id: "nujazz", l: "Nu-jazz", f: "Nu-jazz", fam: "purple", cx: 780, r: 11, p: ["fusion", "techno", "fjelljazz"], g: "Jazz", era: "1997", d: "Norsk fjelljazz møter electronica og drum'n'bass.", t: ["Khmer – Nils Petter Molvær (1997)", "Existence – Bugge Wesseltoft (1998)"] },

  // --- Folk (revival) ---
  { id: "folk", l: "Folk", f: "Folk (revival)", fam: "amber", cx: 70, r: 7, p: ["eurofolk"], g: "Country", era: "1950–60-tallet", d: "Bevisst gjenoppliving av amerikansk og britisk folkemusikk; vise- og protesttradisjon. Bro mot folkrock, singer-songwriter og americana.", t: ["This Land Is Your Land – Woody Guthrie (1944)", "Blowin' in the Wind – Bob Dylan (1963)"] },

  // --- Rock ---
  { id: "rocknroll", l: "Rock'n'roll", f: "Rock'n'roll", fam: "rock", cx: 445, r: 6, p: ["rnb", "country", "honkytonk"], g: null, era: "1955", d: "Afroamerikansk R&B møter hvit country. Ungdomsopprøret som sprengte populærmusikken vidåpen.", t: ["Johnny B. Goode – Chuck Berry (1958)", "Hound Dog – Elvis Presley (1956)"] },
  { id: "britinv", l: "British invasion", f: "Blues revival (British invasion)", fam: "blue", cx: 580, r: 7, p: ["chicagoblues", "rocknroll"], g: "Blues", era: "1963–66", d: "Britiske band gjenoppdaget og gjenfortolket Chicago-bluesen og rock'n'roll, og sendte den tilbake til USA.", t: ["(I Can't Get No) Satisfaction – The Rolling Stones (1965)", "For Your Love – The Yardbirds (1965)"] },
  { id: "bluesrock", l: "Blues Rock", f: "Blues rock", fam: "blue", cx: 580, r: 8, p: ["britinv", "chicagoblues"], g: "Blues", era: "sent 1960-tall", d: "Forsterket, virtuos videreføring av bluesen — grunnmuren for hardrock.", t: ["Crossroads – Cream (1968)", "Whole Lotta Love – Led Zeppelin (1969)"] },

  // --- Fjelljazz (ECM) ---
  { id: "fjelljazz", l: "Fjelljazz", f: "Fjelljazz (ECM)", fam: "purple", cx: 950, r: 8, p: ["modal", "free"], g: "Jazz", era: "1970-tallet", d: "Nordisk, åpen og melodisk jazz med ECM-klang — naturlyrikk og romfølelse.", t: ["Dansere – Jan Garbarek (1976)", "Witchi-Tai-To – Jan Garbarek (1974)"] },

  // --- Hip-hop videre ---
  { id: "gangsta", l: "Gangsta rap", f: "Gangsta rap", fam: "pink", cx: 1250, r: 10, p: ["hiphop"], g: "R&B", era: "ca. 1990", d: "Rå skildring av gatelivet, særlig på Vestkysten. Kommersielt gjennombrudd og kulturkamp.", t: ["Straight Outta Compton – N.W.A (1988)", "Nuthin' but a 'G' Thang – Dr. Dre (1992)"] },
  { id: "trap", l: "Trap", f: "Trap", fam: "pink", cx: 1250, r: 12, p: ["gangsta"], g: "R&B", era: "2000–2010-tallet", d: "Sørstats-hiphop med 808-bass og hi-hat-ruller. Ble den dominerende lyden i moderne pop.", t: ["Sicko Mode – Travis Scott (2018)", "Mask Off – Future (2017)"] },

  // --- Elektronisk videre ---
  { id: "elektronika", l: "Elektronika", f: "Elektronika", fam: "teal", cx: 1510, r: 11, p: ["techno", "house"], g: "Klubbmusikk", era: "1990–2000-tallet", d: "Bredt felt for lytterettet elektronisk musikk utenfor dansegulvet.", t: ["Windowlicker – Aphex Twin (1999)", "Midnight in a Perfect World – DJ Shadow (1996)"] },
  { id: "edm", l: "EDM", f: "EDM", fam: "teal", cx: 1510, r: 12, p: ["elektronika"], g: "Klubbmusikk", era: "2010-tallet", d: "Stadionvennlig dansemusikk med store «drops». Elektronikaens kommersielle topp.", t: ["Levels – Avicii (2011)", "Titanium – David Guetta ft. Sia (2011)"] },
];

// Sjangervokabular for filteret (alle ekte sjangre i treet, ikke røtter).
export const GENEALOGY_MAIN_GENRES = [...new Set(GENEALOGY.filter((n) => n.g).map((n) => n.l))]
  .sort((a, b) => a.localeCompare(b, "no"));

// Supersjangre (treets kolonner): én rad per hovedretning. Beholder rekkefølgen
// fra GENEALOGY (≈ kronologisk). Brukes som rader i varmekartet — utvides
// automatisk når nye supersjangre legges inn i treet.
export const GENEALOGY_META_GENRES = [...new Set(GENEALOGY.filter((n) => n.g).map((n) => n.g))];

// Er navnet en ekte tre-sjanger (mainGenre)? Brukes til å skille mainGenre fra
// frie undersjangre (subGenre). Delt av store, ui, explore og teacher.
const MAIN_GENRE_SET = new Set(GENEALOGY_MAIN_GENRES.map((g) => g.toLowerCase()));
export function isMainGenre(name) {
  return MAIN_GENRE_SET.has(String(name).toLowerCase());
}

// Vis sjanger-beskrivelse i #modal-sjanger uten å laste hele kartet.
// opts: { root, subgenreDescs, onShowArtists }
export function showSjangerInfo(label, opts = {}) {
  const { root = document, subgenreDescs = {}, artists = [], techItems = [], genres = [], onArtistClick, onTechClick, onMainGenreClick, onShowArtists, onShowPlaylist, onEdit, onPropose, hasPendingEdit } = opts;
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
  const descFor = () => { const o = subgenreDescs[n.f] || subgenreDescs[n.l]; return (o && o.description) ? o.description : n.d; };
  const descObj = subgenreDescs[n.f] || subgenreDescs[n.l] || {};
  const kilder = Array.isArray(descObj.kilder) ? descObj.kilder : [];
  const kilderHtml = buildKilderList(kilder, "Kilder");

  const btnArea = [
    (n.g && onShowArtists) ? `<button type="button" class="btn ghost small gx-artists-btn">Vis artister</button>` : "",
    (n.g && onShowPlaylist) ? `<button type="button" class="btn ghost small gx-playlist-btn">Vis spilleliste</button>` : "",
    onEdit ? `<button type="button" class="btn ghost small gx-edit-btn">Rediger</button>` : "",
  ].filter(Boolean).join(" ");

  const lc = { artists, techItems, genres, onArtistClick, onTechClick, onMainGenreClick };
  mTitle.textContent = n.f;
  mBody.innerHTML = `
    <p class="gx-era">${escapeHtml(n.era)}</p>
    <p class="gx-desc">${linkifyAll(descFor(), lc)}</p>
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
  const be = mBody.querySelector(".gx-edit-btn");
  if (be) be.addEventListener("click", () => onEdit(n.f));
  // Foreslå endring (student)
  const foot = root.querySelector("#sj-foot");
  const propBtn = root.querySelector("#sj-propose");
  if (foot && propBtn) {
    if (onPropose) {
      const locked = hasPendingEdit?.("subgenre", n.f);
      foot.style.display = "";
      propBtn.disabled = !!locked;
      propBtn.textContent = locked ? "Forslag venter på godkjenning" : "Foreslå endring";
      propBtn.onclick = () => onPropose({
        entityType: "subgenre",
        entityId: n.f,
        entityName: n.f,
        currentValues: { description: descObj.description || n.d || "" },
      });
    } else {
      foot.style.display = "none";
    }
  }
  window._modalZ = window._modalZ || 100;
  modal.style.zIndex = ++window._modalZ;
  modal.classList.add("open");
  return true;
}

const W = 1660, H = 1180, NW = 116, NH = 40, SVGNS = "http://www.w3.org/2000/svg";
const RY = { 0: 70, 1: 165, 2: 260, 3: 355, 4: 450, 5: 545, 6: 640, 7: 735, 8: 830, 9: 925, 10: 1020, 11: 1115, 12: 1210 };
const DEC = { 0: "Røtter", 1: "1900", 2: "1910-t", 3: "1920-t", 4: "1930-t", 5: "1940-t", 6: "1950-t", 7: "1960-t", 8: "1970-t", 9: "1980-t", 10: "1990-t", 11: "2000-t", 12: "2010-t" };
// Sjangerfamilier: strekfarge + etikett til fargeforklaringen. Rekkefølgen her
// styrer rekkefølgen i forklaringen. Familier som brukes i treet, men mangler
// her, varsles i konsollen og tegnes uten farge (se renderGenealogy).
const FAMILIES = {
  blue:   { stroke: "#3b82f6", label: "Blues" },
  rock:   { stroke: "#334155", label: "Rock" },
  amber:  { stroke: "#d97706", label: "Country" },
  purple: { stroke: "#7c3aed", label: "Jazz" },
  red:    { stroke: "#dc2626", label: "Gospel / soul / funk" },
  teal:   { stroke: "#0d9488", label: "Disco / electronica" },
  pink:   { stroke: "#db2777", label: "Hip-hop" },
  green:  { stroke: "#16a34a", label: "Reggae" },
  gray:   { stroke: "#9bada1", label: "Røtter" },
};
const FAM_STROKE = Object.fromEntries(Object.entries(FAMILIES).map(([k, v]) => [k, v.stroke]));

function el(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// ----------------------------------------------------------------------------
//  Bygger kartet i modal-rotelementet. Returnerer { fit } for å sentrere ved
//  hver åpning. opts: { root, subgenreDescs, onShowArtists }
// ----------------------------------------------------------------------------
export function renderGenealogy({ root, subgenreDescs = {}, artists: staticArtists, getArtists, getTechItems, getMainGenres, onArtistClick, onTechClick, onMainGenreClick, onShowArtists, onShowPlaylist }) {
  const artists = getArtists ? { get current() { return getArtists(); } } : { current: staticArtists || [] };
  const tech = getTechItems ? { get current() { return getTechItems(); } } : { current: [] };
  const genreProxy = getMainGenres ? { get current() { return getMainGenres(); } } : { current: [] };
  const stage = root.querySelector("#gx-stage");
  const cam = root.querySelector("#gx-cam");
  const modal = root.querySelector("#modal-sjanger");

  const map = {}, kids = {};
  GENEALOGY.forEach((n) => { n.y = RY[n.r]; n.rx = n.rx || []; map[n.id] = n; kids[n.id] = []; });
  // Alle foreldre = avstamning (p) + motreaksjon (rx)
  const parentsOf = (n) => { const a = n.p.slice(); n.rx.forEach((id) => { if (!a.includes(id)) a.push(id); }); return a; };
  GENEALOGY.forEach((n) => parentsOf(n).forEach((p) => { if (kids[p]) kids[p].push(n.id); }));

  const anc = (id, s = {}) => { parentsOf(map[id]).forEach((p) => { if (!s[p]) { s[p] = 1; anc(p, s); } }); return s; };
  const desc = (id, s = {}) => { kids[id].forEach((c) => { if (!s[c]) { s[c] = 1; desc(c, s); } }); return s; };

  cam.innerHTML = "";

  // Tiår-rutenett (tids-aksen)
  for (let r = 0; r <= 12; r++) {
    cam.appendChild(el("line", { x1: 0, y1: RY[r] - 47, x2: W, y2: RY[r] - 47, class: "gx-grid" }));
    const dl = el("text", { x: 14, y: RY[r] - 40, class: "gx-decade" });
    dl.textContent = DEC[r];
    cam.appendChild(dl);
  }

  // Kanter — heltrukne = avstamning, stiplet = motreaksjon
  const edges = [];
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
  }));

  // Noder
  const gnodes = {};
  GENEALOGY.forEach((n) => {
    const g = el("g", { class: "gx-node gx-f-" + n.fam });
    g.dataset.id = n.id;
    g.appendChild(el("rect", { x: n.cx - NW / 2, y: n.y - NH / 2, width: NW, height: NH, rx: 8 }));
    const tx = el("text", { x: n.cx, y: n.y, "text-anchor": "middle", "dominant-baseline": "central" });
    tx.textContent = n.l;
    g.appendChild(tx); cam.appendChild(g); gnodes[n.id] = g;
  });

  // Utheving (vises ved hover)
  let moved = false;
  function light(id) {
    const line = anc(id); line[id] = 1;
    const dn = desc(id); for (const k in dn) line[k] = 1;
    GENEALOGY.forEach((n) => gnodes[n.id].classList.toggle("gx-dim", !line[n.id]));
    edges.forEach((e) => {
      const on = line[e.dataset.p] && line[e.dataset.c];
      e.classList.toggle("gx-hl", !!on);
      e.classList.toggle("gx-dim", !on);
      e.style.stroke = on ? (e.dataset.react ? "#d97706" : (FAM_STROKE[e.dataset.fam] || "")) : "";
    });
  }
  function clearLight() {
    GENEALOGY.forEach((n) => gnodes[n.id].classList.remove("gx-dim"));
    edges.forEach((e) => { e.classList.remove("gx-hl", "gx-dim"); e.style.stroke = ""; });
  }
  const reset = clearLight;

  // Klikk → popup med detaljer. Bruker den delte showSjangerInfo, så node-klikk
  // og tag-klikk alltid viser nøyaktig samme popup (én kilde til sannhet).
  function openModal(id) {
    const n = map[id];
    showSjangerInfo(n.l, {
      root, subgenreDescs,
      artists: artists.current, techItems: tech.current, genres: genreProxy.current,
      onArtistClick, onTechClick, onMainGenreClick,
      onShowArtists, onShowPlaylist,
    });
  }

  GENEALOGY.forEach((n) => {
    const g = gnodes[n.id];
    g.addEventListener("mouseenter", () => light(n.id));
    g.addEventListener("mouseleave", clearLight);
    g.addEventListener("click", (ev) => { if (moved) return; ev.stopPropagation(); openModal(n.id); });
  });

  // Lukking av popup
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
    const cl = modal.querySelector(".modal-close");
    if (cl) cl.addEventListener("click", () => modal.classList.remove("open"));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.classList.remove("open"); });
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

  let drag = false, sx, sy;
  stage.addEventListener("pointerdown", (ev) => {
    drag = true; moved = false; sx = ev.clientX; sy = ev.clientY;
    stage.classList.add("gx-drag");
  });
  stage.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    tx += dx; ty += dy; sx = ev.clientX; sy = ev.clientY; apply();
  });
  window.addEventListener("pointerup", () => { drag = false; stage.classList.remove("gx-drag"); });
  stage.addEventListener("click", (ev) => {
    if (!ev.target.closest(".gx-node") && !moved) reset();
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
      `<div class="gx-leg"><span class="gx-sw-line"></span>motreaksjon</div>`;
  }

  reset();
  apply();
  return { fit };
}

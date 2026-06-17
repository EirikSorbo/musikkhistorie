// ============================================================================
//  SLEKTSTRE — hvordan sjangrene henger sammen
// ----------------------------------------------------------------------------
//  Strukturen (noder, posisjoner, foreldre, familie) er fast og designet for
//  lesbarhet. Beskrivelser kan overstyres fra Firestore (subgenres-samlingen)
//  slik at læreren kan redigere dem via den vanlige sjanger-editoren.
// ============================================================================

// Tid løper nedover: rad 0 = røtter, rad 11 = 2000-tallet.
export const GENEALOGY = [
  { id: "vestafrik", l: "Vestafrikansk", f: "Vestafrikansk musikk", fam: "gray", cx: 250, r: 0, p: [], g: null, era: "Røtter", d: "Griot-tradisjon, work songs, call & response og rytmefokus — kjernen i nesten alt som kommer etter.", t: [] },
  { id: "eurofolk", l: "Euro-folk", f: "Europeisk folkemusikk", fam: "gray", cx: 110, r: 0, p: [], g: null, era: "Røtter", d: "Appalachiske ballader, salmer og britiske music halls — de hvite nybyggernes arv.", t: [] },
  { id: "worksongs", l: "Work songs", f: "Work songs / field hollers", fam: "gray", cx: 250, r: 1, p: ["vestafrik"], g: null, era: "1800-tallet", d: "Arbeidssanger på plantasjene; dialog mellom solist og gruppe.", t: ["I'll Be So Glad When the Sun Goes Down (1959)"] },
  { id: "spirituals", l: "Spirituals", f: "Negro spirituals", fam: "gray", cx: 380, r: 1, p: ["vestafrik"], g: null, era: "1800-tallet", d: "Religiøse sanger som blandet europeiske salmer med afrikansk uttrykk.", t: ["Swing Low (1909)", "Slave Songs of the United States (1867)"] },
  { id: "blues", l: "Blues", f: "Blues", fam: "blue", cx: 200, r: 2, p: ["worksongs"], g: "Blues", era: "ca. 1900", d: "Verdslig, individuell sang om smerte og lengsel. Grunnmuren for nesten all populærmusikk.", t: ["Cross Road Blues – Robert Johnson (1937)", "St. Louis Blues – Bessie Smith (1925)"] },
  { id: "ragtime", l: "Ragtime", f: "Ragtime", fam: "purple", cx: 330, r: 2, p: ["vestafrik"], g: "Jazz", era: "1897", d: "Komponert og notert, synkopert pianomusikk. Bindeledd mot jazzen.", t: ["Maple Leaf Rag – Scott Joplin", "The Entertainer – Scott Joplin"] },
  { id: "tinpan", l: "Tin Pan Alley", f: "Tin Pan Alley", fam: "gray", cx: 560, r: 2, p: ["eurofolk"], g: "Afroamerikansk populærmusikk", era: "1910–50", d: "Låtskriversamlebånd i New York; «the American songbook».", t: ["White Christmas – Irving Berlin (1942)", "Summertime – Gershwin (1935)"] },
  { id: "jazz", l: "Jazz", f: "Jazz", fam: "purple", cx: 330, r: 3, p: ["ragtime", "blues"], g: "Jazz", era: "ca. 1915", d: "Født i New Orleans av ragtime «played hot» + blues. Improvisasjon og swing.", t: ["Dipper Mouth Blues – King Oliver (1923)", "West End Blues – Louis Armstrong (1928)"] },
  { id: "country", l: "Country", f: "Country (hillbilly)", fam: "amber", cx: 110, r: 3, p: ["eurofolk", "blues"], g: "Country", era: "1920-tallet", d: "De hvites folkemusikk, formet av skotsk-irsk arv, vaudeville og blues.", t: ["Wildwood Flower – Carter Family (1928)", "Blue Yodel – Jimmie Rodgers (1929)"] },
  { id: "gospel", l: "Gospel", f: "Gospel", fam: "red", cx: 450, r: 3, p: ["spirituals", "blues"], g: "Afroamerikansk populærmusikk", era: "1930-tallet", d: "Komponert kirkemusikk med blues-driv. Vugge for soul og R&B.", t: ["Precious Lord, Take My Hand – Dorsey (1932)", "Lord Don't Move the Mountain – Mahalia Jackson"] },
  { id: "swing", l: "Swing", f: "Swing", fam: "purple", cx: 330, r: 4, p: ["jazz"], g: "Jazz", era: "1930–45", d: "Storband-jazz som ble USAs danse- og popmusikk.", t: ["Sing, Sing, Sing – Benny Goodman (1937)", "Take the A Train – Duke Ellington (1941)"] },
  { id: "bluegrass", l: "Bluegrass", f: "Bluegrass", fam: "amber", cx: 110, r: 5, p: ["country"], g: "Country", era: "1939", d: "Tradisjonsbundet country med virtuost strengespill.", t: ["Uncle Pen – Bill Monroe (1965)"] },
  { id: "honkytonk", l: "Honky tonk", f: "Honky tonk", fam: "amber", cx: 230, r: 5, p: ["country"], g: "Country", era: "1940-tallet", d: "Røff bar-country om drikking og hjertesorg, elektrisk forsterket.", t: ["Lovesick Blues – Hank Williams (1949)", "Your Cheatin' Heart – Hank Williams (1953)"] },
  { id: "bebop", l: "Bebop", f: "Bebop", fam: "purple", cx: 360, r: 5, p: ["swing"], g: "Jazz", era: "1945", d: "Kunstnerisk opprør: jazzen går fra dansemusikk til lyttemusikk.", t: ["Koko – Charlie Parker", "A Night in Tunisia – Dizzy Gillespie"] },
  { id: "rnb", l: "R&B", f: "Rhythm & blues", fam: "red", cx: 500, r: 5, p: ["blues", "gospel"], g: "Afroamerikansk populærmusikk", era: "1940-tallet", d: "Blues + jazzens energi + gospelens vokal. Forløper for soul og rock.", t: ["Beans and Cornbread – Louis Jordan (1949)", "Hallelujah I Love Her So – Ray Charles (1956)"] },
  { id: "chicagoblues", l: "Chicago blues", f: "Chicago blues", fam: "blue", cx: 110, r: 6, p: ["blues"], g: "Blues", era: "1948", d: "Elektrisk, råere byblues. Tente den britiske blues-bølgen og rocken.", t: ["Got My Mojo Workin' – Muddy Waters (1956)", "Call It Stormy Monday – T-Bone Walker (1948)"] },
  { id: "nashville", l: "Nashville", f: "Nashville-sound", fam: "amber", cx: 250, r: 6, p: ["honkytonk"], g: "Country", era: "1957", d: "Polert, pop-orientert country med strykere og kor.", t: ["Crazy – Patsy Cline (1961)", "Four Walls – Jim Reeves (1957)"] },
  { id: "cool", l: "Cool jazz", f: "Cool jazz", fam: "purple", cx: 350, r: 6, p: ["bebop"], g: "Jazz", era: "1949", d: "Intellektuell motreaksjon: dempet, lyrisk, behersket.", t: ["Take Five – Dave Brubeck (1959)", "Birth of the Cool – Miles Davis"] },
  { id: "hardbop", l: "Hard bop", f: "Hard bop", fam: "purple", cx: 470, r: 6, p: ["bebop"], g: "Jazz", era: "1955", d: "Tilbake til røttene: blues- og gospel-drevet jazz.", t: ["Moanin' – Art Blakey (1959)"] },
  { id: "soul", l: "Soul", f: "Soul", fam: "red", cx: 600, r: 6, p: ["gospel", "rnb"], g: "Afroamerikansk populærmusikk", era: "1959", d: "Gospel møter R&B. Lydsporet til borgerrettskampen.", t: ["Respect – Aretha Franklin (1967)", "A Change Is Gonna Come – Sam Cooke (1964)"] },
  { id: "modal", l: "Modal jazz", f: "Modal jazz", fam: "purple", cx: 280, r: 7, p: ["bebop"], g: "Jazz", era: "1958", d: "Frigjøring fra akkordene; bygd på skalaer og stemninger.", t: ["So What – Miles Davis (1959)", "A Love Supreme – John Coltrane (1964)"] },
  { id: "free", l: "Free jazz", f: "Free jazz", fam: "purple", cx: 390, r: 7, p: ["bebop"], g: "Jazz", era: "1960", d: "Frigjøring fra alt: kollektiv improvisasjon uten fast struktur.", t: ["Free Jazz – Ornette Coleman (1961)"] },
  { id: "funk", l: "Funk", f: "Funk", fam: "red", cx: 500, r: 7, p: ["soul"], g: "Afroamerikansk populærmusikk", era: "1967", d: "Alt destillert til rytme og groove. Peker mot hip-hop.", t: ["Papa's Got a Brand New Bag – James Brown", "Chameleon – Herbie Hancock (1973)"] },
  { id: "reggae", l: "Reggae", f: "Reggae & dub", fam: "green", cx: 620, r: 7, p: ["rnb"], g: "Afroamerikansk populærmusikk", era: "1968", d: "Jamaicansk off-beat med «riddim». Toasting → grunnlaget for rap.", t: ["Is This Love – Bob Marley", "Do the Reggay – Toots & the Maytals (1968)"] },
  { id: "outlaw", l: "Outlaw", f: "Outlaw country", fam: "amber", cx: 115, r: 8, p: ["honkytonk"], g: "Country", era: "1970-tallet", d: "Opprør mot Nashville: røffere uttrykk og kunstnerisk frihet.", t: ["Red Headed Stranger – Willie Nelson (1975)"] },
  { id: "fusion", l: "Fusion", f: "Jazz-fusion", fam: "purple", cx: 300, r: 8, p: ["jazz", "funk"], g: "Jazz", era: "1970", d: "Jazz + rock + funk + verdens folkemusikk. Elektrisk og global.", t: ["Bitches Brew – Miles Davis (1970)", "Birdland – Weather Report (1977)"] },
  { id: "disco", l: "Disco", f: "Disco", fam: "teal", cx: 500, r: 8, p: ["funk", "soul"], g: "Elektronisk musikk", era: "1974", d: "Four-on-the-floor fra klubbene. Vugge for all klubbmusikk.", t: ["Stayin' Alive – Bee Gees (1977)", "Le Freak – Chic (1978)"] },
  { id: "hiphop", l: "Hip-hop", f: "Hip-hop", fam: "pink", cx: 630, r: 8, p: ["funk", "reggae"], g: "Afroamerikansk populærmusikk", era: "1973", d: "Bronx-kultur: DJ-ing, MC-ing, breakdance, graffiti. Beat over melodi.", t: ["Rapper's Delight – Sugarhill Gang (1979)", "The Message – Grandmaster Flash (1982)"] },
  { id: "house", l: "House", f: "House", fam: "teal", cx: 500, r: 9, p: ["disco"], g: "Elektronisk musikk", era: "1980", d: "Disco gjenfødt på trommemaskin i Chicago-klubbene.", t: ["Move Your Body – Marshall Jefferson", "Your Love – Frankie Knuckles"] },
  { id: "techno", l: "Techno", f: "Techno", fam: "teal", cx: 620, r: 9, p: ["house"], g: "Elektronisk musikk", era: "1985", d: "Detroits futuristiske, maskinelle svar på house.", t: ["Strings of Life – Derrick May", "Big Fun – Inner City"] },
  { id: "americana", l: "Americana", f: "Americana / alt-country", fam: "amber", cx: 115, r: 10, p: ["country"], g: "Country", era: "1990-tallet", d: "Jordnær, kritikerhyllet motvekt til mainstream-Nashville.", t: ["Oh My Sweet Carolina – Ryan Adams (2001)"] },
  { id: "neosoul", l: "Neo-soul", f: "Neo-soul", fam: "red", cx: 470, r: 10, p: ["soul", "hiphop"], g: "Afroamerikansk populærmusikk", era: "1990-tallet", d: "Soul med hip-hop-mikrorytmikk og rike harmonier.", t: ["On & On – Erykah Badu (1997)", "Brown Sugar – D'Angelo (1995)"] },
  { id: "trance", l: "Trance / DnB", f: "Trance & drum'n'bass", fam: "teal", cx: 620, r: 10, p: ["techno", "house"], g: "Elektronisk musikk", era: "1990-tallet", d: "Rave-eksplosjonen: melodisk trance og høyt tempo drum'n'bass.", t: ["For an Angel – Paul van Dyk (1994)", "Timeless – Goldie (1995)"] },
  { id: "nujazz", l: "Nu-jazz", f: "Nu-jazz", fam: "purple", cx: 300, r: 11, p: ["fusion", "techno"], g: "Jazz", era: "1997", d: "Norsk fjelljazz møter electronica og drum'n'bass.", t: ["Khmer – Nils Petter Molvær (1997)", "Existence – Bugge Wesseltoft (1998)"] },
];

const ROW_LABELS = {
  0: "Røtter", 1: "1900", 2: "1910–20", 3: "1920–30", 4: "1930-t", 5: "1940-t",
  6: "1950-t", 7: "1960-t", 8: "1970-t", 9: "1980-t", 10: "1990-t", 11: "2000-t",
};

// Familiefarger for kanter ved markering (samme paletten som CSS-klassene .gx-f-*)
const FAM_STROKE = {
  gray: "#9bada1", blue: "#3b82f6", amber: "#d97706", purple: "#7c3aed",
  red: "#dc2626", teal: "#0d9488", pink: "#db2777", green: "#16a34a",
};

const LEGEND = [
  ["blue", "Blues"], ["amber", "Country"], ["purple", "Jazz"],
  ["red", "Gospel / soul / funk"], ["teal", "Disco / electronica"],
  ["pink", "Hip-hop"], ["green", "Reggae"], ["gray", "Røtter"],
];

const SVGNS = "http://www.w3.org/2000/svg";
const NW = 96, NH = 38, Y0 = 54, RG = 80;

function el(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ----------------------------------------------------------------------------
//  Tegner treet i de gitte elementene. Kalles én gang per åpning.
//  opts: { svg, info, legend, subgenreDescs, onShowArtists }
// ----------------------------------------------------------------------------
export function renderGenealogy({ svg, info, legend, subgenreDescs = {}, onShowArtists }) {
  const map = {}, kids = {};
  GENEALOGY.forEach((n) => { map[n.id] = n; kids[n.id] = []; });
  GENEALOGY.forEach((n) => n.p.forEach((p) => { if (kids[p]) kids[p].push(n.id); }));

  const cy = (n) => Y0 + n.r * RG;
  const anc = (id, s = {}) => { map[id].p.forEach((p) => { if (!s[p]) { s[p] = 1; anc(p, s); } }); return s; };
  const desc = (id, s = {}) => { kids[id].forEach((c) => { if (!s[c]) { s[c] = 1; desc(c, s); } }); return s; };

  // Bruk Firestore-beskrivelse hvis den finnes for sjangeren
  const descFor = (n) => {
    const o = subgenreDescs[n.f] || subgenreDescs[n.l];
    return (o && o.description) ? o.description : n.d;
  };

  svg.innerHTML = "";
  legend.innerHTML = "";

  for (let ri = 0; ri <= 11; ri++) {
    const lab = el("text", { x: 8, y: Y0 + ri * RG + 4, class: "gx-rowlab" });
    lab.textContent = ROW_LABELS[ri];
    svg.appendChild(lab);
  }

  const edges = [];
  GENEALOGY.forEach((n) => n.p.forEach((p) => {
    const pa = map[p];
    const x1 = pa.cx, y1 = cy(pa) + NH / 2, x2 = n.cx, y2 = cy(n) - NH / 2;
    const ym = (y1 + y2) / 2;
    const path = el("path", {
      d: `M${x1},${y1} C${x1},${ym} ${x2},${ym} ${x2},${y2}`,
      class: "gx-edge",
    });
    path.dataset.p = p; path.dataset.c = n.id; path.dataset.fam = n.fam;
    svg.appendChild(path); edges.push(path);
  }));

  const gnodes = {};
  GENEALOGY.forEach((n) => {
    const g = el("g", { class: "gx-node gx-f-" + n.fam });
    g.dataset.id = n.id;
    const x = n.cx - NW / 2, y = cy(n) - NH / 2;
    g.appendChild(el("rect", { x, y, width: NW, height: NH, rx: 7 }));
    const tx = el("text", { x: n.cx, y: cy(n), "text-anchor": "middle", "dominant-baseline": "central" });
    tx.textContent = n.l;
    g.appendChild(tx); svg.appendChild(g); gnodes[n.id] = g;
  });

  function showInfo(id) {
    const n = map[id];
    const inf = n.p.map((p) => escapeHtml(map[p].f)).join(", ") || "—";
    const ch = kids[id].map((c) => escapeHtml(map[c].f)).join(", ") || "—";
    const tracks = n.t.length
      ? `<ul class="gx-tracks">${n.t.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
      : "";
    const artistBtn = (n.g && onShowArtists)
      ? `<button type="button" class="btn ghost small gx-artists-btn">Vis artister</button>`
      : "";
    info.innerHTML = `
      <h3>${escapeHtml(n.f)}</h3>
      <p class="gx-era">${escapeHtml(n.era)}</p>
      <p class="gx-desc">${escapeHtml(descFor(n))}</p>
      <p class="gx-rel"><strong>Vokste ut av:</strong> ${inf}</p>
      <p class="gx-rel"><strong>Førte videre til:</strong> ${ch}</p>
      ${tracks}
      ${artistBtn}`;
    const btn = info.querySelector(".gx-artists-btn");
    if (btn) btn.addEventListener("click", () => onShowArtists({ label: n.l, fullName: n.f, genre: n.g }));
  }

  function select(id) {
    const line = anc(id); line[id] = 1;
    const dn = desc(id); for (const k in dn) line[k] = 1;
    GENEALOGY.forEach((n) => {
      const g = gnodes[n.id];
      g.classList.toggle("gx-dim", !line[n.id]);
      g.classList.toggle("gx-sel", n.id === id);
    });
    edges.forEach((e) => {
      const on = line[e.dataset.p] && line[e.dataset.c];
      e.classList.toggle("gx-hl", !!on);
      e.classList.toggle("gx-dim", !on);
      e.style.stroke = on ? (FAM_STROKE[e.dataset.fam] || "") : "";
    });
    showInfo(id);
  }

  function reset() {
    GENEALOGY.forEach((n) => gnodes[n.id].classList.remove("gx-dim", "gx-sel"));
    edges.forEach((e) => { e.classList.remove("gx-hl", "gx-dim"); e.style.stroke = ""; });
    info.innerHTML = `<p class="gx-desc">Trykk på en sjanger for å se hvor den kom fra, hva den førte til, og noen nøkkelinnspillinger.</p>`;
  }

  svg.addEventListener("click", (ev) => {
    const g = ev.target.closest(".gx-node");
    if (g) select(g.dataset.id);
  });

  LEGEND.forEach(([fam, label]) => {
    const d = document.createElement("div");
    d.className = "gx-leg";
    d.innerHTML = `<span class="gx-sw gx-f-${fam}"></span>${escapeHtml(label)}`;
    legend.appendChild(d);
  });

  reset();
  return { select, reset };
}

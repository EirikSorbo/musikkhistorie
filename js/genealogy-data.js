// ============================================================================
//  SLEKTSTRE — RÅDATA (frøet)
// ----------------------------------------------------------------------------
//  Nodene, familiefargene og den pedagogiske metasjanger-rekkefølgen. Fila er
//  REN DATA: ingen avledninger, ingen DOM, ingen importer. Avledningene
//  (sjangervokabular, kanter, fargeoppslag …) bor i js/genre-model.js, og
//  visningen i js/genealogy.js.
//
//  VIKTIG: fra v4.48 er dette FRØET, ikke fasiten. Appen kjører på treet som
//  ligger i Firestore; denne fila brukes til å generere seed-JSON-en (se
//  tools/seed-genealogy.js) og som fasit i testene. Ingen runtime-modul skal
//  importere herfra — da ville vi hatt en skjult fallback i koden, og kravet
//  er at manglende innhold skal SIES, ikke skjules.
// ============================================================================

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
  // id «country», etikett «Hillbilly»: 1920-tallets innspilte sjanger het
  // hillbilly i samtiden, og navnet ble tatt i bruk i v4.38 (brukervalg).
  // Metasjangeren heter fortsatt Country — den rommer alt fra Bluegrass til
  // Cont. country, og skal ikke hete Hillbilly.
  { id: "country", l: "Hillbilly", f: "Hillbilly", fam: "amber", cx: 330, r: 3, p: ["eurofolk", "hymner", "blues"], g: "Country", era: "1920-tallet", t: ["Wildwood Flower – Carter Family (1928)", "Blue Yodel – Jimmie Rodgers (1929)"] },
  { id: "gospel", l: "Gospel", f: "Gospel", fam: "olive", cx: 1070, r: 4, p: ["spirituals", "blues"], g: "Gospel", era: "1930-tallet", t: ["Precious Lord, Take My Hand – Dorsey (1932)", "Lord Don't Move the Mountain – Mahalia Jackson"] },
  { id: "swing", l: "Swing", f: "Swing", fam: "purple", cx: 700, r: 4, p: ["jazz"], g: "Jazz", era: "1930–45", t: ["Sing, Sing, Sing – Benny Goodman (1937)", "Take the A Train – Duke Ellington (1941)"] },
  { id: "bluegrass", l: "Bluegrass", f: "Bluegrass", fam: "amber", cx: 70, r: 4, p: ["country"], g: "Country", era: "1939", t: ["Uncle Pen – Bill Monroe (1965)"] },
  { id: "honkytonk", l: "Honky tonk", f: "Honky tonk", fam: "amber", cx: 195, r: 5, p: ["country"], g: "Country", era: "1940-tallet", t: ["Lovesick Blues – Hank Williams (1949)", "Your Cheatin' Heart – Hank Williams (1953)"] },
  { id: "bebop", l: "Bebop", f: "Bebop", fam: "purple", cx: 700, r: 5, p: ["swing"], g: "Jazz", era: "1945", t: ["Koko – Charlie Parker", "A Night in Tunisia – Dizzy Gillespie"] },
  // R&B, Soul og Funk står på tiåret sjangeren PREGET, ikke året den ble navngitt
  // (brukervalg 2026-08-04): R&B leses som 50-tallets sjanger, Soul som 60-tallets.
  // `era` er fortsatt fasiten for oppstartsåret, og sjangertidslinjen leser den —
  // ikke raden — så flyttingen endrer bare kartet.
  { id: "rnb", l: "R&B", f: "Rhythm & blues", fam: "red", cx: 1190, r: 6, p: ["blues", "gospel"], g: "R&B", era: "1940-tallet", t: ["Beans and Cornbread – Louis Jordan (1949)", "Hallelujah I Love Her So – Ray Charles (1956)"] },
  { id: "nashville", l: "Nashville", f: "Nashville-sound", fam: "amber", cx: 195, r: 6, p: ["honkytonk"], g: "Country", era: "1957", t: ["Crazy – Patsy Cline (1961)", "Four Walls – Jim Reeves (1957)"] },
  { id: "chicagoblues", l: "Electric blues", f: "Electric blues", fam: "blue", cx: 580, r: 5, p: ["blues"], g: "Blues", era: "midten av 1940-tallet", t: ["Got My Mojo Workin' – Muddy Waters (1956)", "Call It Stormy Monday – T-Bone Walker (1947)"] },
  { id: "cool", l: "Cool jazz", f: "Cool jazz", fam: "purple", cx: 700, r: 6, p: ["bebop"], g: "Jazz", era: "1949", t: ["Take Five – Dave Brubeck (1959)", "Birth of the Cool – Miles Davis"] },
  { id: "hardbop", l: "Hard bop", f: "Hard bop", fam: "purple", cx: 825, r: 6, p: ["bebop"], rx: ["cool"], g: "Jazz", era: "1955", t: ["Moanin' – Art Blakey (1959)"] },
  { id: "soul", l: "Soul", f: "Soul", fam: "red", cx: 1190, r: 7, yOffset: -0.2, p: ["gospel", "rnb"], g: "R&B", era: "1959", t: ["Respect – Aretha Franklin (1967)", "A Change Is Gonna Come – Sam Cooke (1964)"] },
  { id: "modal", l: "Modal jazz", f: "Modal jazz", fam: "purple", cx: 700, r: 6, yOffset: 0.5, p: ["bebop", "cool"], g: "Jazz", era: "1958", t: ["So What – Miles Davis (1959)", "A Love Supreme – John Coltrane (1964)"] },
  { id: "free", l: "Free jazz", f: "Free jazz", fam: "purple", cx: 825, r: 7, p: ["bebop"], rx: ["hardbop"], g: "Jazz", era: "1960", t: ["Free Jazz – Ornette Coleman (1961)"] },
  // Funk ligger NEDERST i 60-tallsbåndet og krysser 1970-linja: den kom sent i
  // tiåret, og skal leses som soulens fortsettelse på vei inn i 70-tallet.
  { id: "funk", l: "Funk", f: "Funk", fam: "red", cx: 1190, r: 7, yOffset: 0.4, p: ["soul"], g: "R&B", era: "1967", t: ["Papa's Got a Brand New Bag – James Brown", "Chameleon – Herbie Hancock (1973)"] },
  { id: "reggae", l: "Reggae", f: "Reggae & dub", fam: "green", cx: 1590, r: 7, p: ["rnb"], g: "Klubbmusikk", era: "1968", t: ["Is This Love – Bob Marley", "Do the Reggay – Toots & the Maytals (1968)"] },
  { id: "outlaw", l: "Outlaw", f: "Outlaw country", fam: "amber", cx: 195, r: 8, p: ["honkytonk"], rx: ["nashville"], g: "Country", era: "1970-tallet", t: ["Red Headed Stranger – Willie Nelson (1975)"] },
  { id: "fusion", l: "Fusion", f: "Jazz-fusion", fam: "purple", cx: 760, r: 8, p: ["modal", "funk", "rock"], g: "Jazz", era: "1970", t: ["Bitches Brew – Miles Davis (1970)", "Birdland – Weather Report (1977)"] },
  // id «hiphop», etikett «Early hip-hop» (v4.38): navnet «Hip-hop» flyttet ned
  // til gullalder-noden, så denne står igjen som pionerårene i Bronx.
  { id: "hiphop", l: "Early hip-hop", f: "Early hip-hop", fam: "pink", cx: 1340, r: 8, p: ["funk", "reggae", "disco"], g: "Hip-hop", era: "ca. 1979", t: ["Rapper's Delight – Sugarhill Gang (1979)", "The Message – Grandmaster Flash (1982)"] },
  { id: "disco", l: "Disco", f: "Disco", fam: "teal", cx: 1650, r: 8, p: ["funk", "soul"], g: "Klubbmusikk", era: "1974", t: ["Stayin' Alive – Bee Gees (1977)", "Le Freak – Chic (1978)"] },
  // House og techno er slått sammen (v3.97, brukervalg): to scener — Chicago og
  // Detroit — som deler puls, maskinpark og publikum, og som i pensumet uansett
  // leses som én elektronisk grunnstamme. Labelen bruker «&», ikke «/»: labelen
  // ER doc-ID-en i genreDescriptions, og Firestore forbyr «/» i doc-ID-er
  // (samme grunn som «Trance & DnB»).
  { id: "house", l: "House & techno", f: "House & techno", fam: "teal", cx: 1780, r: 9, p: ["disco"], g: "Klubbmusikk", era: "1980–85", t: ["Move Your Body – Marshall Jefferson", "Your Love – Frankie Knuckles", "Strings of Life – Derrick May", "Big Fun – Inner City"] },
  { id: "americana", l: "Americana", f: "Americana / alt-country", fam: "amber", cx: 70, r: 10, p: ["folk"], rx: ["nashville"], g: "Country", era: "1990-tallet", t: ["Oh My Sweet Carolina – Ryan Adams (2001)"] },
  // yOffset senker Neo-soul et kvart tiår ned i 90-tallsbåndet (v4.30). Sjangeren
  // hører hjemme sent i tiåret uansett (D'Angelo 1995, Badu 1997), og lavere ned
  // ligger den utenfor de tre strekene som passerte tett inntil etiketten:
  // newjack→contrnb og hiphop→contgospel grazet den på 1 px, og hiphop→neosoul
  // skar gjennom New jack swing-etiketten på veien ned hit.
  { id: "neosoul", l: "Neo-soul", f: "Neo-soul", fam: "red", cx: 1130, r: 10, yOffset: 0.25, p: ["soul", "hiphop"], g: "R&B", era: "1990-tallet", t: ["On & On – Erykah Badu (1997)", "Brown Sugar – D'Angelo (1995)"] },
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

  // --- R&B videre: new jack swing ---
  // Broen mellom funken og 90-tallets R&B, og den som gjør spranget fra Funk
  // (1967) til Cont. R&B leselig: Teddy Riley la sangtradisjonen oppå hip-hopens
  // programmerte trommer, og det er nettopp den koblingen Cont. R&B-beskrivelsen
  // åpner med («utgangspunktet er new jack swing»). Derfor er noden også Cont.
  // R&B-ens ENESTE forelder: funken og hip-hopen arves gjennom den, og tegnet vi
  // dem på nytt ville strekene gått langs samme rute forbi Neo-soul (jf.
  // Neotrad. country og regelen om færre foreldre).
  { id: "newjack", l: "New jack swing", f: "New jack swing", fam: "red", cx: 1115, r: 9, p: ["funk", "hiphop"], g: "R&B", era: "1987–93", t: ["My Prerogative – Bobby Brown (1988)", "Groove Me – Guy (1988)", "Poison – Bell Biv DeVoe (1990)", "Remember the Time – Michael Jackson (1992)"] },

  // --- Hip-hop videre ---
  { id: "gangsta", l: "Gangsta rap", f: "Gangsta rap", fam: "pink", cx: 1340, r: 10, p: ["hiphop"], g: "Hip-hop", era: "ca. 1990", t: ["Straight Outta Compton – N.W.A (1988)", "Nuthin' but a 'G' Thang – Dr. Dre (1992)"] },
  // NB: id-en er «gullalder», etiketten er «Hip-hop». Noden ble skilt ut i v3.88
  // som hip-hopens gullalder, og fikk hovednavnet i v4.38 (brukervalg): det er
  // denne perioden studentene skal kjenne som hip-hop, mens pionerene i Bronx
  // står som «Early hip-hop» over. ID-ene ble BEVISST ikke endret — de er
  // identiteten til de 80 koblingsbeskrivelsene (edgeKey = «fra__til»), og et
  // bytte der ville gjort dem foreldreløse.
  // Gangsta rap er bevisst IKKE forelder: den er samtidig med denne noden
  // (N.W.A 1988), ikke etterkommer — de er to greiner ut fra Early hip-hop,
  // øst og vest.
  { id: "gullalder", l: "Hip-hop", f: "Hip-hop", fam: "pink", cx: 1340, r: 9, p: ["hiphop"], g: "Hip-hop", era: "1986–94", t: ["Fight the Power – Public Enemy (1989)", "C.R.E.A.M. – Wu-Tang Clan (1993)", "N.Y. State of Mind – Nas (1994)"] },
  { id: "trap", l: "Trap", f: "Trap", fam: "pink", cx: 1340, r: 12, p: ["gangsta"], g: "Hip-hop", era: "2000–2010-tallet", t: ["Sicko Mode – Travis Scott (2018)", "Mask Off – Future (2017)"] },

  // --- Elektronisk videre ---
  { id: "elektronika", l: "Elektronika", f: "Elektronika", fam: "teal", cx: 1780, r: 11, p: ["house"], g: "Klubbmusikk", era: "1990–2000-tallet", t: ["Windowlicker – Aphex Twin (1999)", "Midnight in a Perfect World – DJ Shadow (1996)"] },
  { id: "edm", l: "EDM", f: "EDM", fam: "teal", cx: 1780, r: 12, p: ["elektronika", "house"], g: "Klubbmusikk", era: "2010-tallet", t: ["Levels – Avicii (2011)", "Titanium – David Guetta ft. Sia (2011)"] },

  // --- Samtid ---
  // Sjangre som samler trådene i hver sin familie. Alle henter fra flere hold på
  // tvers av treet — det er hele poenget med dem: samtidsmusikken er der grenene
  // møtes igjen. Hele blokka står på 2000-t-raden (brukervalg 2026-08-17): det er
  // tiåret de PREGET og er lest som samtidsmusikk i, og 1990-t er dessuten full
  // i denne delen av kartet (Neo-soul, Gangsta rap). Årstallet i `era` — og de
  // strukturerte årstallene i Firestore — er fasiten for når de oppsto, ikke raden.
  { id: "contjazz", l: "Cont. jazz", f: "Contemporary jazz", fam: "purple", cx: 780, r: 11, p: ["nujazz", "hiphop"], g: "Jazz", era: "2010-tallet", t: ["The Epic – Kamasi Washington (2015)", "Black Radio – Robert Glasper Experiment (2012)"] },
  { id: "contcountry", l: "Cont. country", f: "Contemporary country", fam: "amber", cx: 195, r: 11, p: ["neotrad", "nashville", "pop", "rock"], g: "Country", era: "1990-tallet–i dag", t: ["Need You Now – Lady Antebellum (2009)", "Cruise – Florida Georgia Line (2012)"] },
  // cx flyttet 1070 → 1020 da noden kom opp på 2000-t-raden: den måtte klare av
  // Cont. R&B ved siden av seg, og på kjøpet kom Gospel-streken ned forbi
  // Neo-soul-boksen med god margin (den lå 2 px fra kanten før).
  { id: "contgospel", l: "Cont. gospel", f: "Contemporary gospel", fam: "olive", cx: 1020, r: 11, p: ["gospel", "hiphop", "neosoul"], g: "Gospel", era: "1990-tallet–i dag", t: ["Stomp – Kirk Franklin & God's Property (1997)", "Break Every Chain – Tasha Cobbs (2013)"] },
  // cx flyttet 1160 → 1240 da New jack swing kom inn over den: streken mellom dem
  // måtte til høyre for Neo-soul-etiketten, ikke tvers gjennom den.
  { id: "contrnb", l: "Cont. R&B", f: "Contemporary R&B", fam: "red", cx: 1240, r: 11, p: ["newjack"], g: "R&B", era: "1990-tallet–i dag", t: ["Real Love – Mary J. Blige (1992)", "Crazy in Love – Beyoncé (2003)"] },
  { id: "conthiphop", l: "Cont. hip-hop", f: "Contemporary hip-hop", fam: "pink", cx: 1440, r: 11, p: ["gullalder", "gangsta"], g: "Hip-hop", era: "1995–i dag", t: ["Jesus Walks – Kanye West (2004)", "Alright – Kendrick Lamar (2015)"] },
];

// Sjangerfamilier: strekfarge + etikett til fargeforklaringen. Rekkefølgen her
// styrer rekkefølgen i forklaringen. Familier som brukes i treet, men mangler
// her, varsles i konsollen og tegnes uten farge (se renderGenealogy).
export const FAMILIES = {
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
export const META_ORDER_HINT = ["Blues", "Jazz", "R&B", "Hip-hop", "Klubbmusikk", "Gospel", "Country", "Pop", "Rock"];

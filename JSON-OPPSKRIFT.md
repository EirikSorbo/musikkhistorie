# JSON-oppskrift — Afroamerikansk musikkhistorie

Eksport-/importformat for hele datagrunnlaget. Filen ligger på rota og oppdateres når skjemaet endres.

**Versjon:** 2.85 (følger appversjonen i `js/version.js`)
**Sist endret:** 2026-07-04

---

## Toppnivåstruktur

```json
{
  "artists":           [ /* array av artistobjekter */ ],
  "decades":           { "1920": { ... }, "1930": { ... } },
  "genreDescriptions": { "meta": { "Blues": { ... } }, "main": { "Chicago blues": { ... } }, "sub": { "Delta blues": { ... } } },
  "tech":              [ /* array av teknologiobjekter */ ]
}
```

| Nøkkel | Type | Beskrivelse |
|---|---|---|
| `artists` | array | ALLE artister uansett status — også ventende og fjernede forslag (tapsfri backup). Rekkefølge spiller ingen rolle. |
| `decades` | objekt | Tiårsbeskrivelser. Nøkkel = tiåret som string ("1920", "1960"). |
| `genreDescriptions` | objekt | Sjangerbeskrivelser, nestet i tre bolker etter sjangertype (`meta`/`main`/`sub`). Se seksjon 3. Eldre filer med flat toppnøkkel `subgenres` leses fortsatt ved import. |
| `tech` | array | Teknologiske innovasjoner (alle statuser, også pending). Sortert etter `adoptedYear`. |

Konfig (`maxTotal`, `metaGenres`, `decades`, `instruments`, grenser) ligger i Firestore-collection `config`, ikke i denne filen.

---

## 1. Artistobjekt

```json
{
  "name": "Robert Johnson",
  "birthYear": 1911,
  "deathYear": 1938,
  "gender": "mann",
  "metaGenre": "Blues",
  "instrument": "Gitar",
  "mainGenre": ["Blues"],
  "subGenre": ["Delta blues", "Akustisk blues"],
  "influenceStart": 1936,
  "influenceEnd": 1938,
  "recordLabel": "Vocalion",
  "geography": "Mississippi Delta",
  "description": "Mytisk skikkelse i Delta blues-tradisjonen. Bare 29 innspillinger, men enorm innflytelse på etterkrigsblues, britisk blues-bølge og tidlig rock.",
  "keyWorks": [
    { "title": "Cross Road Blues", "year": 1936, "url": "https://open.spotify.com/track/..." },
    { "title": "Hellhound on My Trail", "year": 1937 },
    { "title": "Sweet Home Chicago", "year": 1936 }
  ],
  "musicExamples": [
    { "label": "King of the Delta Blues Singers (1961)", "url": "https://youtube.com/...", "year": 1961 },
    { "label": "Live at Newport 1964", "url": "https://youtube.com/...", "year": 1961, "performanceYear": 1964 }
  ],
  "kilder": [
    { "text": "Wald, Elijah. Escaping the Delta. Amistad, 2004." },
    { "text": "Library of Congress — Robert Johnson Centennial", "url": "https://loc.gov/..." }
  ],
  "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/...",
  "imageCredit": "Hooks Bros. / Public domain, via Wikimedia Commons",
  "proposedBy": "Eirik Sørbø",
  "status": "active",
  "priority": 2,
  "teacherChecked": true,
  "votedUpBy": ["a1B2c3EksempelUid"],
  "addedYear": 2026
}
```

### Feltbeskrivelser

| Felt | Type | Påkrevd | Notater |
|---|---|---|---|
| `name` | string | ✓ | Visningsnavn. Trim før lagring. |
| `birthYear` | number \| null | | 4-sifret årstall. |
| `deathYear` | number \| null | | 4-sifret årstall. |
| `gender` | string | ✓ | Én av: `"kvinne"`, `"mann"`, `"annet"`, `"ukjent"`. |
| `metaGenre` | string | ✓ | **Sjanger fra slektstreet.** Må være én av sjangrene i `GENEALOGY_MAIN_GENRES` (Blues, Jazz, Country, Bebop, Cool jazz, Hard bop, Modal jazz, Free jazz, Swing, Fusion, Nu-jazz, Chicago blues, Bluegrass, Honky tonk, Nashville, Outlaw, Americana, R&B, Soul, Funk, Reggae, Hip-hop, Neo-soul, Disco, House, Techno, Trance / DnB, Gospel). Brukes i grenser/kvoter. |
| `instrument` | string | ✓ | Må matche én verdi i `config.instruments` (eks. Vokal, Gitar, Piano/keyboards, Bass, Trommer/perkusjon, Saksofon, Trompet, Strykeinstrumenter, Elektronisk produksjon, Annet). |
| `mainGenre` | array av strings | | **Sjangere fra slektstreet.** Strengene må matche en label i `GENEALOGY` (Blues, Jazz, Country, Bebop, Cool jazz, Hard bop, Modal jazz, Free jazz, Swing, Fusion, Nu-jazz, Chicago blues, Bluegrass, Honky tonk, Nashville, Outlaw, Americana, R&B, Soul, Funk, Reggae, Hip-hop, Neo-soul, Disco, House, Techno, Trance / DnB, Gospel). |
| `subGenre` | array av strings | | **Frie tags.** Hva som helst (Delta blues, Akustisk blues, New Orleans-jazz, …). Brukes til søk og filter. |
| `influenceStart` | number | ✓ | Året kunstneren begynte å påvirke. Styrer tiår-tilhørighet. |
| `influenceEnd` | number \| null | | Året innflytelsen tok slutt (eller null hvis aktiv/død). |
| `recordLabel` | string | | Plateselskap(er) artisten er knyttet til. Fritekst, f.eks. `"Columbia"`, `"Stax / Atlantic"`. |
| `geography` | string | | Fritekst: by, region, miljø. "Mississippi Delta", "Bronx, New York". |
| `description` | string | | Pedagogisk begrunnelse — *hvorfor relevant?* Vanlig tekst, kort. |
| `keyWorks` | array av objekter | | Sentrale verk. Se under. |
| `musicExamples` | array av objekter | | Musikkeksempler (lyttelenker). `{ label, url, year?, performanceYear? }`. Se under. |
| `kilder` | array av objekter | ✓ | Kilder (minst én). Se under. |
| `imageUrl` | string | | URL til portrettbilde. Bruk Commons/CC-lisensiert. |
| `imageCredit` | string | | Fotograf + lisens, vises som bildetekst (eks. *"Carl Van Vechten / Library of Congress, public domain"*). |
| `proposedBy` | string | | Hvem la inn forslaget. Mangler → `"Anonym"`. |
| `status` | string | | `"active"`, `"pending"` eller `"removed"`. Eksporten tar med ALLE statuser (også pending). Ved lærer-import beholdes `active`/`removed`/`pending`; **mangler feltet, settes kortet til `active`** (importen regnes som lærergodkjent); ugyldige verdier blir `pending`. |
| `priority` | number | | Lærerens prioritet: 3=viktigst, 2=viktig, 1=mindre viktig, 0/mangler=ingen. |
| `teacherChecked` | boolean | | Lærerens «gjennomgått»-hake. |
| `votedUpBy` | array av strings | | Stemme-identiteter (uid-er). Bevares ved lærer-import, så backup→restore ikke mister studentstemmer. Studentinnsending kan ikke sette feltet (Firestore-reglene krever tom liste). |
| `addedYear` | number | | Året kortet ble lagt inn. Mangler → settes til inneværende år ved import. |

### `keyWorks[]`

```json
{ "title": "A Love Supreme", "year": 1965, "url": "https://..." }
```

| Felt | Påkrevd | Notater |
|---|---|---|
| `title` | ✓ | Verkets/låtens tittel. |
| `year` | | **Utgivelsesår.** 4-sifret. Brukes i visning og kronologisk sortering. |
| `url` | | Lenke (Spotify, YouTube, Apple Music). Hvis tomt brukes YouTube-søk på `tittel + artist`. |

### `kilder[]`

```json
{ "text": "Store norske leksikon.", "forfatter": "Arne Forsgren", "year": 2021, "url": "https://snl.no/country", "kategori": "Nettsteder" }
```

| Felt | Påkrevd | Notater |
|---|---|---|
| `text` | ✓ | Navnet på kilden. For nettkilder: publikasjonen alene («Store norske leksikon.»), slik at lenken bærer artikkelen — samme form på artist-, sjanger- og tiårskort. |
| `forfatter` | | Forfatter/artikkelforfatter. Vises i parentes etter tittelen, utenfor lenken. |
| `year` | | Publiseringsår (tall). Vises sammen med forfatteren. |
| `url` | | Klikkbar lenke. Hvis satt: hele teksten blir lenke. |
| `kategori` | | Styrer hvilken seksjon kilden havner i i Referanser-kortet. Gyldige verdier står i `KILDE_KATEGORIER` (`js/kilder.js`): `Bøker`, `Podkaster`, `Videoer`, `Nettsteder`. Mangler feltet, eller står det noe annet, havner kilden under «Ukategorisert» nederst i kortet — synlig, ikke skjult. (`Tidsskrifter` fra v4.39 leses som `Nettsteder`.) |

Referanser-kortet har én seksjon per kategori. Kun `Nettsteder` grupperes på
nettsted (`snl.no` → Store norske leksikon), og der utledes artikkeltittelen fra
URL-en, siden `text` som regel bare er navnet på oppslagsverket. Nettsteder med
færre enn tre artikler, og nettkilder uten lenke, samles under «Andre nettsteder».
I de øvrige seksjonene er `text` hele referansen, og den overstyrer alltid URL-en.

### `referanser` (toppnøkkel)

```json
"referanser": { "kilder": [{ "text": "Ted Gioia: The History of Jazz", "kategori": "Bøker" }], "updatedAt": "2026-08-19T…" }
```

Frittstående kilder som ikke hører til noe kort (lagt inn med «Ny referanse» på
lærersiden, lagret i `content/referanser`). Samme feltene som `kilder[]`. Ved
import ERSTATTES hele lista, siden den er ett dokument.

### `musicExamples[]`

```json
{ "label": "Live, Newport 1964", "url": "https://youtube.com/...", "year": 1964 }
```

Med framføringsår (konsertopptak e.l. der framføringen skjedde et annet år enn utgivelsen):

```json
{ "label": "Live at Montreaux 1968", "url": "https://youtube.com/...", "year": 2003, "performanceYear": 1968 }
```

| Felt | Påkrevd | Notater |
|---|---|---|
| `label` | | Tittel / beskrivelse. Vises som lenketekst (fallback: «Lytt»). |
| `url` | ✓ | URL til YouTube, Spotify, Apple Music e.l. |
| `year` | | **Utgivelsesår.** 4-sifret. Vises etter tittelen. |
| `performanceYear` | | **Framføringsår.** Settes kun når framføringen skjedde et annet år enn utgivelsen — typisk konsertopptak utgitt senere. Hvis satt, vises `(2003, framføring 1968)`. |

Forskjell på `musicExamples` og `keyWorks`: `musicExamples` er konkrete innspillinger/opptredener med lyttelenke; `keyWorks` er det kanoniske verket. Et verk kan eksistere som `keyWorks` uten lenke, og bli koblet til flere `musicExamples` (forskjellige versjoner).

---

## 2. Tiårsobjekt

Nøkkel = tiåret som string. Verdi:

```json
{
  "society": "Borgerrettsbevegelsen vokser frem som politisk kraft etter Brown vs. Board of Education (1954). Civil Rights Act (1964) og Voting Rights Act (1965) markerer juridiske vendepunkter. Vietnam-krigen polariserer USA, motkulturen vokser.",
  "societyMore": "1960-tallet rommer kontraster det er vanskelig å overdrive: …\n\nMartin Luther King Jr.s «I Have a Dream»-tale (28. august 1963) samlet 250 000 mennesker i Washington. Drapet på Malcolm X (1965) og King (1968) markerte en mer militant fase. Black Power-bevegelsen, ledet av blant andre Stokely Carmichael og Black Panther Party (1966), endret retning og retorikk.\n\nKulturelt: motkulturen, Summer of Love (1967), Woodstock (1969), Stonewall-opprøret (1969). Vietnam-krigen mobiliserte studenter og kunstnere mot statens autoritet. Musikken — fra soul til psykedelisk rock — fungerte som lydspor og politisk uttrykk samtidig.",
  "tech": "Transistorradioen blir allemannseie. FM-radio og stereoanlegg gjør populærmusikk til en sentral del av hjemmet. Multitrack-innspilling endrer studioproduksjon.",
  "techMore": "Frem til 1960 var monoinnspilling normen. Les Pauls åtte-spors maskin (1957) og Ampex 8-spors (1960-tallet) ga produsenter helt nye muligheter. Phil Spectors «Wall of Sound», Beach Boys' *Pet Sounds* (1966) og Beatles' *Sgt. Pepper's* (1967) demonstrerer hva studioet kunne være — et instrument i seg selv.\n\nMoog-synthesizeren (1964) introduserte elektroniske lyder for popmusikken. Stereoformatet erstattet mono mot slutten av tiåret. Kassettbåndet (1962) startet privat musikkdeling — en forløper til all senere bærbar musikk.",
  "kilder": [
    { "text": "Branch, T. Parting the Waters: America in the King Years 1954–63. Simon & Schuster, 1988." },
    { "text": "Marcus, G. Mystery Train. Plume, 1975." },
    { "text": "Library of Congress — Civil Rights History Project", "url": "https://www.loc.gov/collections/civil-rights-history-project/" }
  ]
}
```

| Felt | Påkrevd | Notater |
|---|---|---|
| `society` | | Kort tekst (1–3 setninger). Vises rett i tiår-popupen. |
| `societyMore` | | Utvidet tekst. «Les mer»-knappen blir synlig når dette finnes. Linjeskift (`\n\n`) blir bevart. |
| `tech` | | Samme som over, for teknologi. |
| `techMore` | | Utvidet teknologi. |
| `kilder` | | Felles kilder for tiåret (samfunn + teknologi). |

Tomt felt = ikke vises. «Les mer»-knappen er kun synlig hvis tilhørende `…More`-felt har innhold.

---

## 3. Sjangerbeskrivelser (`genreDescriptions`)

Nestet i tre bolker etter sjangerens TYPE — samme inndeling som lærer-dashbordet:

| Bolk | Innhold |
|---|---|
| `meta` | Metasjangre (`config.metaGenres`, f.eks. Blues, Jazz, Gospel). |
| `main` | Sjangre fra slektstreet som ikke også er metasjanger (Chicago blues, Bebop, …). |
| `sub` | Frie undersjangere (Delta blues, Vaudeville blues, …). |

Hvert sjangernavn står ÉN gang, i bolken som matcher typen. Verdien er hele dokumentet, som selv er **nivådelt**: nøklene `meta`/`main`/`sub` holder teksten for hvert nivå. Et navn som er både metasjanger og tre-node (f.eks. Blues) ligger i `meta`-bolken, men dokumentet kan ha tekst på flere nivåer:

```json
"genreDescriptions": {
  "meta": {
    "Blues": {
      "meta": {
        "description": "Metasjanger-beskrivelsen (vises i metasjanger-popup).",
        "kilder": [ { "text": "Wald, E. Escaping the Delta. Amistad, 2004." } ]
      },
      "main": {
        "description": "Tre-sjanger-beskrivelsen (vises fra slektstreet/sjangerlista)."
      }
    }
  },
  "main": {
    "Chicago blues": {
      "main": { "description": "Elektrifisert delta-blues i nord …" }
    }
  },
  "sub": {
    "Delta blues": {
      "sub": {
        "description": "Akustisk blues fra Mississippi-deltaet …",
        "kilder": [ { "text": "Palmer, R. Deep Blues. Penguin, 1981." } ]
      }
    }
  }
}
```

Per nivå:

| Felt | Påkrevd | Notater |
|---|---|---|
| `description` | | Beskrivelse av sjangeren på dette nivået. Vises i popup på alle sider. Overstyrer evt. standardbeskrivelsen i `genealogy.js`. |
| `kilder` | | Kilder spesifikt for sjangeren, samme form som artistenes `kilder[]`. |

For sjangere fra slektstreet: mangler `description`, brukes fallback fra `GENEALOGY`-noden (`d`-feltet i `genealogy.js`).

**Bakoverkompat ved import:** eldre filer med flat form (`{ "Blues": { "description": … } }`, evt. under toppnøkkelen `subgenres`) leses fortsatt; flate dokumenter pakkes automatisk inn i riktig nivå ut fra sjangertypen.

---

## 4. Teknologiobjekt

```json
{
  "name": "Vinylplata (LP)",
  "category": "Opptak og avspilling",
  "inventedYear": 1948,
  "adoptedYear": 1948,
  "adoptedLabel": "1948",
  "decade": "1940",
  "description": "Lansert 1948 av Columbia Records. Muliggjorde lengre album og bedre lydkvalitet enn 78-plata.",
  "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/...",
  "imageCredit": "Fotograf / lisens",
  "status": "active"
}
```

### Feltbeskrivelser

| Felt | Type | Påkrevd | Notater |
|---|---|---|---|
| `name` | string | ✓ | Visningsnavn for teknologien/innovasjonen. |
| `category` | string | ✓ | Én av: `"Opptak og avspilling"`, `"Kringkasting og spredning"`, `"Instrumenter og lydutstyr"`. |
| `inventedYear` | number \| null | | Året teknologien ble oppfunnet/lansert. |
| `adoptedYear` | number \| null | | Året teknologien ble tatt i bruk / fikk gjennomslag. Brukes til sortering og tiårsfiltrering. |
| `adoptedLabel` | string | | Visningslabel for perioden, f.eks. `"ca. 1950"`, `"sent 1960-tall"`, `"1948"`. |
| `decade` | string | | Tiåret teknologien primært tilhører (f.eks. `"1940"`, `"1960"`). Brukes til filtrering i tiårsvisningen. |
| `description` | string | | Kort beskrivelse av teknologien og dens betydning. |
| `imageUrl` | string | | URL til bilde. Bruk CC-lisensierte bilder. |
| `imageCredit` | string | | Fotograf + lisens, vises som bildetekst. |
| `status` | string | | `"active"` eller `"pending"` (studentforslag som venter på lærergodkjenning). Manglende felt regnes som aktiv. Eksporten tar med alle, også pending. |
| `proposedBy` | string | | Hvem foreslo kortet (settes på studentforslag). |

### Kategorier

| Kategori | Innhold |
|---|---|
| Opptak og avspilling | Grammofon, LP, CD, MP3, DAW, kassett, flerkanalsopptak osv. |
| Kringkasting og spredning | Radio, TV, MTV, satellitt, fildeling, strømming osv. |
| Instrumenter og lydutstyr | El-gitar, synther, trommemaskiner, MIDI, el-piano osv. |

Tech-data eksporteres/importeres sammen med resten av datasettet (under `tech`-nøkkelen). Ved import matches eksisterende kort på `name` (oppdateres); ukjente navn legges til som nye.

---

## Tekstformatering (gjelder ALLE beskrivelser)

Alle tekstfelter i appen leses som **markdown-light** — artistbeskrivelser,
sjanger- og koblingsbeskrivelser, innovasjonskort, podkastbeskrivelser,
tiårstekstene og historiene/innholdssidene. Samme syntaks overalt, og samme
knapper over hvert felt i editoren:

```
**fet**            *kursiv*            [lenketekst](https://…)
### Mellomtittel
- punkt            • punkt             – punkt
1. nummerert punkt

Blank linje = nytt avsnitt. Enkelt linjeskift = ny linje.
```

Detaljer verdt å kjenne:

- **Tankestrek som kulepunkt** (`– `) teller som punktliste. Det er slik de 80
  koblingsbeskrivelsene er skrevet, og de ble ekte lister uten at teksten ble rørt.
- **Stjerne inni et ord** blir IKKE kursiv (`N*E*R*D` står som det står).
  Kursivmarkørene må stå på ordgrense.
- **Lenker** må være `http`/`https`; alt annet vises som ren tekst. Lenketeksten
  blir aldri gjort om til artistlenke, så man slipper lenker inni lenker.
- **Artist-, sjanger- og teknologinavn** blir fortsatt automatisk klikkbare, også
  inni fet/kursiv tekst og inni listepunkter.
- **HTML i teksten escapes.** Egne `<b>`-tagger o.l. vises som tekst, ikke markup.
- **Tiårstekster skrevet med én linje per punkt, uten markering**, vises fortsatt
  som punktliste (det gjelder teknologifeltene fra 1900 til 2000). Idet feltet får
  et `- `, en blank linje eller en mellomtittel, gjelder vanlige regler.

Formateringen skjer ved visning; det som lagres i Firestore og i denne fila er
teksten slik den er skrevet.

---

## Praktiske retningslinjer

### Bilder
- Foretrekk Wikimedia Commons og Library of Congress (public domain eller CC).
- `imageUrl` må være direkte link til bildefil (ender på `.jpg`/`.png`/`.webp`).
- `imageCredit` bør inneholde fotograf + lisens + kilde, f.eks. *"Carl Van Vechten / Library of Congress, public domain"*.
- Unngå hotlinking fra nettsider du ikke kontrollerer — last opp til Commons hvis nødvendig.

### Kilder
- Lik stil i hele filen. Anbefaling: Chicago Author-Date eller MLA.
- Bøker: `Etternavn, Fornavn. Tittel. Forlag, år.`
- Nettsider: `"Tittel" — Nettsted. Hentet 2026-06-18.` + `url`.
- Akademiske artikler: full referanse, gjerne med DOI som `url`.

### Tagging — sjangre vs. undersjangre
- **`mainGenre`** = en av de ~30 sjangrene fra slektstreet. Disse styrer filtre, søk, spillelister, slektstre-koblinger. Vær konservativ.
- **`subGenre`** = frie tags. Brukes til mer spesifikke uttrykk (*Delta blues, Hard bop, Cool jazz, Neo-soul, Acid jazz, …*) eller geografiske/kontekstuelle markører. Bruk samme stavemåte konsekvent — bruk gjerne `genreDescriptions.sub` til å gi dem beskrivelser.
- Hvis du er i tvil: er navnet en node i slektstreet? → `mainGenre`. Hvis ikke → `subGenre`.

### `metaGenre` (sjanger fra slektstreet)
- Skal alltid være satt. Velges fra `GENEALOGY_MAIN_GENRES`. Brukes til kvoter (`maxPerMetaGenre`).
- For artister som krysser sjangere (eks. Ray Charles): velg den dominerende.

### Influence vs. levetid
- `birthYear`/`deathYear` = biografi.
- `influenceStart`/`influenceEnd` = aktiv musikkhistorisk innflytelse.
- Brukes til tiårfiltrering. En artist født 1911 men aktiv 1936–38 vises kun i 1930-tallet.

### Tomme felter
- Tomme `null`-felter er ok i JSON. `""` (tom streng) er også ok.
- Tomme arrays er ok. Mangler array → leses som `[]`.

---

## Eksempel — komplett mini-fil

```json
{
  "artists": [
    {
      "name": "Bessie Smith",
      "birthYear": 1894,
      "deathYear": 1937,
      "gender": "kvinne",
      "metaGenre": "Blues",
      "instrument": "Vokal",
      "mainGenre": ["Blues"],
      "subGenre": ["Classic blues", "Vaudeville blues"],
      "influenceStart": 1923,
      "influenceEnd": 1937,
      "recordLabel": "Columbia",
      "geography": "Chattanooga / New York",
      "description": "«Empress of the Blues». Vaudeville-skolert sangerinne som førte klassisk blues fra teaterscener inn på plate og ga sjangeren bred kulturell rekkevidde i 1920-årene.",
      "keyWorks": [
        { "title": "Downhearted Blues", "year": 1923 },
        { "title": "Nobody Knows You When You're Down and Out", "year": 1929 },
        { "title": "St. Louis Blues", "year": 1925, "url": "https://www.loc.gov/item/jukebox-21731/" }
      ],
      "musicExamples": [
        { "label": "Complete Recordings, Vol. 1 (Columbia)", "url": "https://open.spotify.com/album/...", "year": 1991 }
      ],
      "kilder": [
        { "text": "Davis, A. Blues Legacies and Black Feminism. Pantheon, 1998." },
        { "text": "Albertson, C. Bessie. Yale University Press, 2003." }
      ],
      "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/2/22/Bessie_Smith_%281936%29.jpg",
      "imageCredit": "Carl Van Vechten / Library of Congress, public domain",
      "proposedBy": "Eirik Sørbø",
      "status": "active",
      "priority": 3,
      "teacherChecked": false,
      "votedUpBy": [],
      "addedYear": 2026
    }
  ],
  "decades": {
    "1920": {
      "society": "Prohibition (1920–33), urban migrasjon fra sør til nord, Harlem-renessansen, og kvinners stemmerett (19th Amendment, 1920).",
      "societyMore": "Great Migration sendte millioner afroamerikanere nordover…\n\nHarlem-renessansen blomstret rundt forfattere som Langston Hughes og Zora Neale Hurston, men også musikere — jazzen forflyttet seg fra New Orleans til Chicago og New York.",
      "tech": "Den elektriske mikrofonen (1925) revolusjonerte innspilling. Radioen blir et masseformat.",
      "techMore": "Frem til 1925 ble plater spilt inn akustisk — sangere måtte rope i en horn. Western Electrics elektriske system (Victor og Columbia, 1925) endret alt: nyanse, bredde, intimitet ble mulig. Bessie Smith, Louis Armstrong og senere Bing Crosby bygde stilen rundt det nye mediet.",
      "kilder": [
        { "text": "Lewis, D. L. When Harlem Was in Vogue. Knopf, 1981." },
        { "text": "Suisman, D. Selling Sounds. Harvard University Press, 2009." }
      ]
    }
  },
  "genreDescriptions": {
    "meta": {
      "Blues": {
        "meta": {
          "description": "Verdslig, individuell sang om smerte og lengsel, født av work songs og spirituals i Mississippi-deltaet rundt 1900.",
          "kilder": [
            { "text": "Wald, E. Escaping the Delta. Amistad, 2004." }
          ]
        }
      }
    },
    "main": {},
    "sub": {
      "Classic blues": {
        "sub": {
          "description": "Den tidlige innspilte bluesen sunget av kvinner — vaudeville-skolert, teatralsk og storband-akkompagnert. Mamie Smith, Ma Rainey og Bessie Smith definerte sjangeren på 1920-tallet.",
          "kilder": [
            { "text": "Davis, A. Blues Legacies and Black Feminism. Pantheon, 1998." }
          ]
        }
      }
    }
  }
}
```

---

## Import-/eksport-flyt

1. **Eksport** (lærersiden → «Eksporter»): `musikkhistorie-YYYY-MM-DD.json` med alle fire seksjoner. Tar med ALLE artister og tech-kort uansett status — også ventende forslag — så eksporten er en komplett, tapsfri backup.
2. **Import** (lærersiden → «Importer»): velg fil. Hele artistlista valideres FØR noe skrives eller slettes; feil rapporteres med radnummer og ingenting endres. Deretter valget *Erstatt* eller *Slå sammen*.
3. **Erstatt alle**: laster ned en full sikkerhetskopi av dagens data og krever bekreftelse på at fila faktisk kom, FØR noe slettes.
4. **Slå sammen**: artister matches på navn (case-insensitive). Tomme felter fylles automatisk fra importfilen. Konflikter løses interaktivt eller med *Behold alle*/*Importer alle*.
5. **Tiår + sjangerbeskrivelser** importeres alltid (overskriver eksisterende verdier). **Tech** matches på navn (oppdater/legg til).

### Formatkrav (ingen bakoverkompatibilitet)
Kompat-lagene for eldre filformater er fjernet (v4.23), etter at live-dataene ble verifisert rene. Importfiler må derfor følge formatet i dette dokumentet:
- Feltnavnene `metaGenre`/`mainGenre`/`subGenre` er påkrevd. Eldre `genre`/`sjangre`/`undersjangre` og et kombinert `subgenres`-array leses **ikke**.
- Sjangerbeskrivelser: kun nestet `genreDescriptions` med bolkene `meta`/`main`/`sub` (dagens eksportformat). Toppnøkkelen `subgenres` og flate `{ description }`-dokumenter leses **ikke** lenger — et dokument uten `main`, `sub` eller `story` hoppes over.
- `keyWorks` og `musicExamples` må være lister av objekter; `keyWorks` som kommaseparert streng og det gamle `links`-feltet konverteres **ikke** lenger.
- `kilder` kan skrives som objekter (`{ text, url }`) eller rene strenger — strenger tolkes som kildetekst uten lenke. Dette er den ENESTE gjenværende koersjonen, og finnes fordi importfiler skrives for hånd.
- `recordingYear` i `keyWorks` er fjernet (v1.68). Eksisterende verdier ignoreres.
- Bruk alltid en fersk eksport fra appen som backup. Gamle backup-filer kan ikke lenger importeres riktig.

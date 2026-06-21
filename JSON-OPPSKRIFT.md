# JSON-oppskrift — Afroamerikansk musikkhistorie

Eksport-/importformat for hele datagrunnlaget. Filen ligger på rota og oppdateres når skjemaet endres.

**Versjon:** 1.78
**Sist endret:** 2026-06-21

---

## Toppnivåstruktur

```json
{
  "artists":   [ /* array av artistobjekter */ ],
  "decades":   { "1920": { ... }, "1930": { ... } },
  "subgenres": { "Blues": { ... }, "Delta blues": { ... } },
  "tech":      [ /* array av teknologiobjekter */ ]
}
```

| Nøkkel | Type | Beskrivelse |
|---|---|---|
| `artists` | array | Alle artistforslag. Rekkefølge spiller ingen rolle. |
| `decades` | objekt | Tiårsbeskrivelser. Nøkkel = tiåret som string ("1920", "1960"). |
| `subgenres` | objekt | Sjanger- og undersjangerbeskrivelser. Nøkkel = navnet eksakt slik det brukes som tag (`"Blues"`, `"Delta blues"`). |
| `tech` | array | Teknologiske innovasjoner. Sortert etter `adoptedYear`. |

Konfig (`maxTotal`, `genres`, `decades`, `instruments`, grenser) ligger i Firestore-collection `config`, ikke i denne filen.

---

## 1. Artistobjekt

```json
{
  "name": "Robert Johnson",
  "birthYear": 1911,
  "deathYear": 1938,
  "gender": "mann",
  "genre": "Blues",
  "instrument": "Gitar",
  "sjangre": ["Blues"],
  "undersjangre": ["Delta blues", "Akustisk blues"],
  "influenceStart": 1936,
  "influenceEnd": 1938,
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
  "proposedBy": "Eirik Sørbø"
}
```

### Feltbeskrivelser

| Felt | Type | Påkrevd | Notater |
|---|---|---|---|
| `name` | string | ✓ | Visningsnavn. Trim før lagring. |
| `birthYear` | number \| null | | 4-sifret årstall. |
| `deathYear` | number \| null | | 4-sifret årstall. |
| `gender` | string | ✓ | Én av: `"kvinne"`, `"mann"`, `"annet"`, `"ukjent"`. |
| `genre` | string | ✓ | **Sjanger fra slektstreet.** Må være én av sjangrene i `GENEALOGY_GENRES` (Blues, Jazz, Country, Bebop, Cool jazz, Hard bop, Modal jazz, Free jazz, Swing, Fusion, Nu-jazz, Chicago blues, Bluegrass, Honky tonk, Nashville, Outlaw, Americana, R&B, Soul, Funk, Reggae, Hip-hop, Neo-soul, Disco, House, Techno, Trance / DnB, Gospel). Brukes i grenser/kvoter. |
| `instrument` | string | ✓ | Må matche én verdi i `config.instruments` (eks. Vokal, Gitar, Piano/keyboards, Bass, Trommer/perkusjon, Saksofon, Trompet, Strykeinstrumenter, Elektronisk produksjon, Annet). |
| `sjangre` | array av strings | | **Sjangere fra slektstreet.** Strengene må matche en label i `GENEALOGY` (Blues, Jazz, Country, Bebop, Cool jazz, Hard bop, Modal jazz, Free jazz, Swing, Fusion, Nu-jazz, Chicago blues, Bluegrass, Honky tonk, Nashville, Outlaw, Americana, R&B, Soul, Funk, Reggae, Hip-hop, Neo-soul, Disco, House, Techno, Trance / DnB, Gospel). |
| `undersjangre` | array av strings | | **Frie tags.** Hva som helst (Delta blues, Akustisk blues, New Orleans-jazz, …). Brukes til søk og filter. |
| `influenceStart` | number | ✓ | Året kunstneren begynte å påvirke. Styrer tiår-tilhørighet. |
| `influenceEnd` | number \| null | | Året innflytelsen tok slutt (eller null hvis aktiv/død). |
| `geography` | string | | Fritekst: by, region, miljø. "Mississippi Delta", "Bronx, New York". |
| `description` | string | | Pedagogisk begrunnelse — *hvorfor relevant?* Vanlig tekst, kort. |
| `keyWorks` | array av objekter | | Sentrale verk. Se under. |
| `musicExamples` | array av objekter | | Musikkeksempler (lyttelenker). `{ label, url, year?, performanceYear? }`. Se under. |
| `kilder` | array av objekter | ✓ | Kilder (minst én). Se under. |
| `imageUrl` | string | | URL til portrettbilde. Bruk Commons/CC-lisensiert. |
| `imageCredit` | string | | Fotograf + lisens, vises som bildetekst (eks. *"Carl Van Vechten / Library of Congress, public domain"*). |
| `proposedBy` | string | | Hvem la inn forslaget. |

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
{ "text": "Wald, E. Escaping the Delta. 2004.", "url": "https://..." }
```

| Felt | Påkrevd | Notater |
|---|---|---|
| `text` | ✓ | Hele kildereferansen, sluttet stil (Chicago/MLA). |
| `url` | | Klikkbar lenke. Hvis satt: hele teksten blir lenke. |

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

## 3. Sjanger-/undersjangerobjekt

Nøkkel = nøyaktig navnet som brukes som tag. Sjangere fra slektstreet bruker label (`"Blues"`) eller fullnavn (`"Rhythm & blues"`). Undersjangere bruker det studenten/læreren skrev (`"Delta blues"`).

```json
{
  "description": "Verdslig, individuell sang om smerte og lengsel, født av work songs og spirituals i Mississippi-deltaet rundt 1900. Tolv-takters skjema, blå toner, kall-og-svar-strukturen fra Vest-Afrika. Grunnmuren for jazz, rock, R&B og soul.",
  "kilder": [
    { "text": "Wald, E. Escaping the Delta. Amistad, 2004." },
    { "text": "Palmer, R. Deep Blues. Penguin, 1981." }
  ]
}
```

| Felt | Påkrevd | Notater |
|---|---|---|
| `description` | | Beskrivelse av sjangeren. Vises i popup på alle sider. Overstyrer evt. standardbeskrivelsen i `genealogy.js`. |
| `kilder` | | Kilder spesifikt for sjangeren. |

For sjangere fra slektstreet: hvis `subgenres["Blues"]` ikke har `description`, brukes fallback fra `GENEALOGY`-noden (`d`-feltet i `genealogy.js`).

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
  "imageCredit": "Fotograf / lisens"
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

### Kategorier

| Kategori | Innhold |
|---|---|
| Opptak og avspilling | Grammofon, LP, CD, MP3, DAW, kassett, flerkanalsopptak osv. |
| Kringkasting og spredning | Radio, TV, MTV, satellitt, fildeling, strømming osv. |
| Instrumenter og lydutstyr | El-gitar, synther, trommemaskiner, MIDI, el-piano osv. |

Startdata finnes i `data/tech-innovations.json`.

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
- **`sjangre`** = en av de ~30 sjangrene fra slektstreet. Disse styrer filtre, søk, spillelister, slektstre-koblinger. Vær konservativ.
- **`undersjangre`** = frie tags. Brukes til mer spesifikke uttrykk (*Delta blues, Hard bop, Cool jazz, Neo-soul, Acid jazz, …*) eller geografiske/kontekstuelle markører. Bruk samme stavemåte konsekvent — bruk gjerne `subgenres`-objektet til å gi dem beskrivelser.
- Hvis du er i tvil: er navnet en node i slektstreet? → `sjangre`. Hvis ikke → `undersjangre`.

### `genre` (sjanger fra slektstreet)
- Skal alltid være satt. Velges fra `GENEALOGY_GENRES`. Brukes til kvoter (`maxPerGenre`).
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
      "genre": "Blues",
      "instrument": "Vokal",
      "sjangre": ["Blues"],
      "undersjangre": ["Classic blues", "Vaudeville blues"],
      "influenceStart": 1923,
      "influenceEnd": 1937,
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
      "proposedBy": "Eirik Sørbø"
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
  "subgenres": {
    "Blues": {
      "description": "Verdslig, individuell sang om smerte og lengsel, født av work songs og spirituals i Mississippi-deltaet rundt 1900.",
      "kilder": [
        { "text": "Wald, E. Escaping the Delta. Amistad, 2004." }
      ]
    },
    "Classic blues": {
      "description": "Den tidlige innspilte bluesen sunget av kvinner — vaudeville-skolert, teatralsk og storband-akkompagnert. Mamie Smith, Ma Rainey og Bessie Smith definerte sjangeren på 1920-tallet.",
      "kilder": [
        { "text": "Davis, A. Blues Legacies and Black Feminism. Pantheon, 1998." }
      ]
    }
  }
}
```

---

## Import-/eksport-flyt

1. **Eksport** (lærersiden → «Eksporter»): `musikkhistorie-YYYY-MM-DD.json` med alle tre seksjoner.
2. **Import** (lærersiden → «Importer»): velg fil. Får valget *Erstatt* eller *Slå sammen*.
3. **Slå sammen**: artister matches på navn (case-insensitive). Tomme felter fylles automatisk fra importfilen. Konflikter løses interaktivt eller med *Behold alle*/*Importer alle*.
4. **Tiår + sjangerbeskrivelser** importeres alltid (overskriver eksisterende verdier).

### Bakoverkompatibilitet
- Gammel modell med `subgenres` (blandet array) og `keyWorks` (komma­separert streng) leses fortsatt — konverteres automatisk på lesetid.
- Gammelt `links`-felt konverteres automatisk til `musicExamples` på lesetid (`normalizeArtist`).
- `recordingYear` i `keyWorks` er fjernet (v1.68). Eksisterende verdier ignoreres.
- Når en lærer redigerer og lagrer, skrives det alltid i nytt format.
- Etter en runde med redigering er all data konvertert.

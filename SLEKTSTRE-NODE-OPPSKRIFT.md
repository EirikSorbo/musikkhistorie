# Oppskrift: legge til (eller endre) en node i slektstreet

Dette dokumentet er skrevet for å bli lest av Claude i en ny chat — og av Eirik når
han skal bestille en ny sjanger. Det sier hva en ny node faktisk innebærer, hva som
skjer av seg selv, hva som må gjøres for hånd, og hvilke feller som finnes.

Kilden til sannhet for gyldige `mainGenre`/`metaGenre` er `GENEALOGY` i
`js/genealogy.js` (noder med `g !== null`). Alt annet leser derfra.

---

## 0. Slik bestiller du en ny node (den effektive veien)

Gi meg **én blokk per sjanger** med dette — resten fyller jeg ut:

```
Navn:        Punk                      # kort etikett = det artistene tagges med
Fullt navn:  Punk rock                 # tittelen i node-panelet (kan være lik)
Metasjanger: Rock                     # én av: Blues, Jazz, Country, Pop, Rock,
                                       #        Gospel, R&B, Klubbmusikk
                                       #        (nytt navn = ny kolonne i varmekartet)
Oppsto:      1970-tallet               # tiåret = raden i treet
Vokste ut av: Rock, Garage             # foreldre — skriv navn, jeg finner id-ene
Motreaksjon mot: Progrock              # valgfritt (gir stiplet strek)
Familiefarge: samme som Rock           # eller «ny farge, mørk grønn»
Epoke-tekst: 1976                      # kort tekst øverst i panelet
Låteksempler: Anarchy in the UK – Sex Pistols (1976), Blitzkrieg Bop – Ramones (1976)
Beskrivelse: <prosa, eller «skriv et utkast»>
Varmekart:   1970-t: 3, 1980-t: 4, 1990-t: 2   # valgfritt, 0–5 per tiår
```

Du trenger **ikke** oppgi `cx`/`r`/`id`/koordinater — jeg plasserer noden, sjekker at
den ikke kolliderer med naboene, og viser deg et skjermbilde av treet før jeg pusher.

Skal du legge inn flere noder samtidig: send alle blokkene i én melding. Da får jeg
plassert dem i forhold til hverandre i én omgang, i stedet for å skyve på dem etterpå.

**Grovskisse funker også.** «Punk: motreaksjon mot progrock, 1970-tallet, rock-familien»
er nok til at jeg kan foreslå resten — du får se forslaget før noe pushes.

---

## 1. Hva som skjer HELT AUTOMATISK når noden er i `GENEALOGY`

Ikke rør disse — de leser treet, og en ny node dukker opp av seg selv:

| Sted | Hva som utledes |
|---|---|
| `GENEALOGY_MAIN_GENRES` | `l` blir en gyldig **mainGenre** (sjangerfilter, artist-tagging, validering ved import) |
| `GENEALOGY_META_GENRES` | `g` blir en gyldig **metaGenre** (metasjanger; ny verdi = ny gruppe i varmekart/himmel) |
| `GENEALOGY_EDGES` | Én kobling per `p` og `rx` — brukes av trykkbanene i treet, lærer-oversikten og eksport |
| `MAIN_GENRE_INFO` | Sjangerens metaGenre + familiefarge (varmekart, sjangerhimmel) |
| Slektstreet (`tre.html`) | Node, streker, panel, «Vokste ut av»/«Førte videre til» |
| Sjangerhimmelen (`constellation.js`) | Stjerne i treets rekkefølge og familiefarge |
| Varmekartet | **Rad** (men ikke tallene — se steg 5) |
| Skrivebordet/Oversikten | Nye hull: manglende sjangerbeskrivelse + manglende koblingsbeskrivelser |

---

## 2. Legg til noden i `GENEALOGY` (`js/genealogy.js`)

```js
{ id: "punk", l: "Punk", f: "Punk rock",
  fam: "rock", cx: 445, r: 8,
  p: ["rock"],            // avstamning/påvirkning → heltrukken strek
  rx: ["progrock"],       // valgfritt: motreaksjon → stiplet strek
  g: "Rock",              // metaGenre. null = bro-/rot-node, ikke en ekte sjanger
  era: "1976",
  t: ["Anarchy in the UK – Sex Pistols (1976)"] },
```

**Feltene:**

- `id` — intern nøkkel. Brukes i `p`/`rx` og i koblings-dokument-ID-ene
  (`edgeKey(fra, til)` = `"fra__til"`). **Endres aldri i ettertid** uten migrering:
  gamle `edgeDescriptions`-dokumenter peker på den gamle id-en.
- `l` — kort etikett. Dette er nøkkelen **overalt ellers**: artistenes `mainGenre`,
  varmekartets rader, `genreDescriptions`-dokument-ID. Case-sensitivt.
- `f` — fullt navn (paneltittel). Både `l` og `f` treffer sjangeroppslag.
- `fam` — familiefarge (se steg 3).
- `r` — rad = tiåret sjangeren oppsto. Fast mapping i `genealogy.js` (`RY`/`DEC`):

  | r | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
  |---|---|---|---|---|---|---|---|---|---|----|----|----|----|
  | tiår | Røtter | 1900 | 1910 | 1920 | 1930 | 1940 | 1950 | 1960 | 1970 | 1980 | 1990 | 2000 | 2010 |

  Foreldre bør ligge på **lavere** `r` (over) — ellers går strekene oppover og ser rare ut.
  Noen noder står bevisst på tiåret sjangeren PREGET, ikke året den oppsto (R&B på
  50-tallet, Soul på 60-tallet, brukervalg 2026-08-04) — `era` er fasiten for årstallet,
  og sjangertidslinjen leser den, ikke raden. Ikke «rett» dem tilbake.
- `yOffset` — valgfri brøkdel av en rad som flytter noden opp (negativ) eller ned
  (positiv) INNENFOR tiårsbåndet sitt. Brukes når forelder og barn står i samme tiår
  (Soul → Funk, Cool → Modal), så forelderen ligger synlig over barnet. Står de i samme
  kolonne (`cx`), tegnes streken rett ned; ellers som en bue under begge.
- `cx` — vannrett senter, 70–1510 (lerretet er 1660 bredt, noden 116 px).
  Hold **minst ~120 px** til andre noder på samme `r`. Sjangre i samme familie står
  i samme kolonneområde — det er dette som gjør kartet lesbart.
- `p` — foreldre (array av `id`-er). Tom for rot-noder.
- `rx` — motreaksjon (valgfritt). Kan peke på samme node som `p` (jf. bebop → swing).
- `g` — metaGenre, eller `null` for bro-/rot-noder (Work songs, Spirituals …).
  `null` betyr: ingen mainGenre, ingen varmekart-rad, ingen artist-tagging.
- `era` — kort tekst øverst i panelet.
- `t` — låteksempler i panelets spilleliste.

---

## 3. BARE hvis noden bruker en ny familiefarge (`fam`)

Tre steder, ellers hopp over hele steget:

1. `js/genealogy.js` → `FAMILIES`: `punk: { stroke: "#ea580c", label: "Punk" }`
   (rekkefølgen her styrer fargeforklaringen)
2. `css/styles.css` (ved de andre `.gx-f-*`, ca. linje 1432):
   `.gx-f-punk rect { fill: <lys>; stroke: <farge>; } .gx-f-punk text { fill: <mørk>; }`
3. `css/styles.css` (ved `.gx-sw.gx-f-*`, fargeforklaringen):
   `.gx-sw.gx-f-punk { background: <lys>; border-color: <farge>; }`

Mangler familien i `FAMILIES`, varsler `renderGenealogy` i konsollen og tegner noden
uten farge. Mangler CSS-regelen, blir noden hvit med svart tekst.

---

## 4. Kode-rutinen (det jeg alltid gjør til slutt)

```bash
# 1) bump tallet i js/version.js (f.eks. 3.38 → 3.39)
./bump.sh                    # setter ?v= på ALLE lokale css/js-referanser
node --check js/genealogy.js # syntaks
npm test                     # genealogy-edges + content-gaps m.fl.
```

Så: åpne `tre.html` lokalt og sjekk **konsollen** (den er fasiten):

- «mangler rad i content/varmekart» → forventet til steg 5 er gjort
- «ukjent familie» → steg 3 er glemt
- noden står på rett tiår, kolliderer ikke, har rett farge, strekene går nedover

Til slutt: commit + push (repoet er auto-push-autorisert; Pages deployer selv).

### 4b. Mål kollisjonene — ikke stol på øyemål

Et nedskalert skjermbilde skjuler akkurat det som gjør kartet rotete. Strekene er
bezier-kurver som **forlater forelderen loddrett** og først bøyer av på halve veien
(`M x1,y1 C x1,ym x2,ym x2,y2`), så en ny node kan lande midt oppå en strek som
ikke har noe med den å gjøre. Kjør dette i konsollen på `tre.html`:

```js
(() => {
  const NY = ['minNyeId'];                       // ← id-ene du nettopp la inn
  const boxes = [...document.querySelectorAll('.gx-node')].map(n => {
    const r = n.querySelector('rect');
    return { id: n.dataset.id, x: +r.getAttribute('x'), y: +r.getAttribute('y'),
             w: +r.getAttribute('width'), h: +r.getAttribute('height') };
  });
  const funn = [];
  for (const p of document.querySelectorAll('path.gx-edge')) {
    const { p: from, c: to } = p.dataset, L = p.getTotalLength();
    for (const b of boxes) {
      if (b.id === from || b.id === to) continue;
      let minD = Infinity, inni = false;
      for (let i = 0; i <= 200; i++) {
        const pt = p.getPointAtLength(L * i / 200);
        if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) { inni = true; break; }
        minD = Math.min(minD, Math.hypot(
          Math.max(b.x - pt.x, 0, pt.x - (b.x + b.w)),
          Math.max(b.y - pt.y, 0, pt.y - (b.y + b.h))));
      }
      if (inni) funn.push(`GJENNOM ${from}→${to} bak ${b.id}`);
      else if (minD < 14) funn.push(`NÆR ${minD.toFixed(0)}px ${from}→${to} ved ${b.id}`);
    }
  }
  return funn;
})()
```

**Les resultatet riktig — dette er viktig:**

- **Kjør skriptet FØR du legger inn noden også**, og sammenlign. Treet har rundt 20
  «GJENNOM»-tilfeller fra før (`jazz→fusion` går bak fire noder) og grazes helt ned
  i 2 px (`rnb→pop` ved `rocknroll`). Det er normalen her, ikke feil du har innført.
- **«GJENNOM» er som regel greit.** Nodene har fyll og tegnes ETTER strekene, så en
  strek bak en node ser ut som den går bak den. Det er «NÆR 2–3 px» som ser ut som
  en renderingsfeil, fordi streken da løper synlig langs kanten.
- **Node/node-overlapp er alltid feil.** Sjekk det separat ved å teste boksene mot
  hverandre — det skal alltid gi tom liste.
- Etiketter bredere enn `NW` (116 px) utvider boksen (`getComputedTextLength`), så
  en lang `l` spiser plass du trodde du hadde. «British invasion» (16 tegn → 164 px)
  er den bredeste som finnes; ligger du der, har du ikke mer å gå på.

Finner du en ekte kollisjon, er **færre foreldre** ofte den beste fiksen — se fella
om doble ruter i steg 6.

---

## 5. Innholdet — bor i Firestore, ikke i koden

Dette kan **jeg ikke gjøre for deg**: skriving krever lærer-innlogging med Google.
Det finnes ingen reservetekster i koden — mangler teksten, sier appen tydelig ifra.
Du har to veier:

**A) Klikke det inn i lærersiden** (best for én node)

- **Sjangerbeskrivelse:** åpne sjangeren → «Rediger». Lagres i `genreDescriptions`
  på nivå `main`, dokument-ID = `l`.
- **Koblingsbeskrivelser:** hver nye strek er et nytt hull. Klikk streken i
  slektstreet → «Rediger». Dokument-ID = `fra__til`. En node med to foreldre og
  én motreaksjon gir **tre** nye koblinger som må skrives.
- **Varmekart:** klikk cellene i den nye raden og velg nivå 0–5 (eller «ingen data»)
  for hvert av de 13 tiårene.
- **Artister:** sett `mainGenre` (og `metaGenre`) nøyaktig lik `l`/`g` — via
  artistredigering eller import.

**B) Importere en innholdspakke** (best for flere noder / mye tekst)

Jeg kan skrive en JSON-fil du importerer på lærersiden (Data → Importer). Alle tre
nøklene skriver **kun det som ligger i fila** og lar resten stå:

- `genreDescriptions` og `edgeDescriptions` — ett dokument per sjanger/kobling.
- `varmekart.heat` — flettes rad for rad (`mergeVarmekartRows`, v3.39). En fil med
  bare den nye sjangerens rad er trygg; sjangrene fila ikke nevner, beholder tallene.
  Kvitteringen sier «N rad(er) oppdatert, M beholdt».

Fram til v3.39 skrev varmekart-importen hele dokumentet rått over, så en delvis fil
slettet alle de andre radene. Det er nå fikset i koden og låst med enhetstester
(`mergeHeatRows` i `import-format.js`) — men merk at **en gammel full eksport
fortsatt overskriver alt den inneholder**. Bruk en fersk eksport, eller en liten fil
med bare det nye.

---

## 6. Feller (lært den harde veien)

- **`l` er identiteten.** Endrer du etiketten senere, blir varmekart-rader,
  `genreDescriptions`-dokumenter og artistenes `mainGenre` foreldreløse samtidig.
  Rename = migrering, ikke en tekstendring. Bestem navnet før du pusher.
- **`id` er koblingenes identitet.** Samme sak for `edgeDescriptions`.
- **Nytt `g` = ny metasjanger** i hele appen (varmekart, sjangerhimmel, filtre,
  lærer-sjekklister). Bruk en eksisterende med mindre du faktisk mener å lage en ny.
- **Undersjanger med samme navn som en sjanger skygger for den** i
  `genre-descriptions.js` (sub slår main ved likt navn). Ikke gjenbruk navn.
- **Rot-noder (`g: null`) trenger også beskrivelse** — Skrivebordet teller dem som hull.
- **Færre foreldre er ofte riktigere.** Er en forelder allerede forelder til en av
  nodens andre foreldre, arves den — tegnes den på nytt, går den nye streken bak de
  samme nodene langs nøyaktig samme rute som den gamle, og ser ut som en dobbel
  strek. Konkret (v3.73): `Neotrad. country` fikk KUN `outlaw`, ikke `honkytonk` og
  ikke `rx: nashville`, selv om begge er musikkfaglig sanne — Outlaw har begge fra
  før. Musikkfaglig riktig ≠ verdt en egen strek.
- **Ny node = flere hull, ikke færre.** Skrivebordets tall går opp med én
  sjangerbeskrivelse + én per ny kobling. Det er meningen.
- **`saveVarmekart` skriver HELE kartet.** Den er kun for celleredigeringen, som
  sitter på hele heat-objektet fra før. Skal kode/skript skrive et utvalg rader,
  skal det gå gjennom `mergeVarmekartRows` — ellers er datatapet tilbake.

---

### Kortversjon

1. Node i `GENEALOGY` (`js/genealogy.js`) — gir main + meta + koblinger + himmel automatisk
2. Ny `fam`? → `FAMILIES` + 2 CSS-regler i `styles.css`
3. Bump `js/version.js` + `./bump.sh`
4. `node --check` + `npm test` + sjekk konsollen i `tre.html`
5. Commit + push
6. Lærer: sjangerbeskrivelse, koblingsbeskrivelse per ny strek, varmekart-rad, artist-tagger

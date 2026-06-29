# Oppskrift: legge til (eller endre) en node i slektstreet

Sjekkliste for hva som må gjøres hver gang en ny sjanger-node legges til i treet,
så ingenting glemmes. Kilden til sannhet for gyldige `mainGenre`/`metaGenre` er
`GENEALOGY` i `js/genealogy.js` (noder med `g !== null`).

## 1. Legg til noden i `GENEALOGY` (`js/genealogy.js`)
Legg til ett objekt i `GENEALOGY`-arrayet:

```js
{ id: "<unik-id>", l: "<mainGenre-navn>", f: "<fullt navn i panelet>",
  fam: "<familienøkkel>", cx: <x 70–1510>, r: <rad/tiår 0–12>,
  p: ["<forelder-id>", ...],        // avstamning/påvirkning (heltrukne linjer)
  rx: ["<id>"],                     // valgfritt: motreaksjon (stiplet linje)
  g: "<metaGenre>",                 // null = ikke en mainGenre (kun bro-node)
  era: "<kort tekst>", t: ["<låt – artist (år)>", ...] },
```

- `l` blir automatisk en gyldig **mainGenre** (via `GENEALOGY_MAIN_GENRES`).
  Skriv den **nøyaktig** slik artistenes `mainGenre` skal staves (case-sensitivt).
- `g` blir automatisk en gyldig **metaGenre** (via `GENEALOGY_META_GENRES`).
  En *ny* `g`-verdi lager en ny supersjanger-kolonne i varmekartet.
- `r` = tiår-rad. Forelder bør ligge på lavere `r` (over) for pene linjer.
- `cx` = vannrett plassering. Sjekk at den ikke kolliderer med andre noder på
  samme `r` (nodebredde ≈ 116 px, så hold ~120 px avstand i cx).

## 2. Hvis noden bruker en NY familiefarge (`fam`)
Bare nødvendig hvis `fam` ikke finnes fra før. Tre steder:

1. `js/genealogy.js` → `FAMILIES`: `pop: { stroke: "#c026d3", label: "Pop" }`
2. `css/styles.css` (ved de andre `.gx-f-*`):
   `.gx-f-pop rect { fill: <lys>; stroke: <farge>; } .gx-f-pop text { fill: <mørk>; }`
3. `css/styles.css` (ved `.gx-sw.gx-f-*`, fargeforklaringen):
   `.gx-sw.gx-f-pop { background: <lys>; border-color: <farge>; }`

Bruker du en eksisterende `fam` (f.eks. `rock`, `purple`), hopp over hele steg 2.

## 3. Legg til varmekart-rad (`js/explore.js` → `VK_HEAT`)
Varmen er redaksjonell og kan ikke utledes fra treet. Uten en rad vises noden
som «ingen data» og gir en konsoll-advarsel.

```js
"Pop": [0, 0, 0, 0, 0, 1, 4, 3, 4, 5, 5, 5, 5],
```

13 tall (0–5) for tiårene `[1900,1910,1920,1930,1940,1950,1960,1970,1980,1990,2000,2010,2020]`.
Nøkkelen må være **identisk** med `l` fra steg 1.

## 4. (Valgfritt) Sjangerbeskrivelse
Tekst i node-panelet kan overstyres fra Firestore (`genreDescriptions`-samlingen)
via «Rediger» i appen. Ikke nødvendig for at noden skal fungere.

## 5. Cache-bust
```bash
# bump tallet i js/version.js (f.eks. 2.64 -> 2.65), så:
./bump.sh
```
Setter `?v=` på ALLE lokale css/js-referanser i `js/*.js` og `*.html`.

## 6. Verifiser
```bash
node --check js/genealogy.js          # syntaks
```
Last `tre.html` i nettleser og sjekk:
- Ingen konsoll-advarsel «mangler VK_HEAT-rad».
- Noden står på rett plass med rett farge (ikke svart tekst = familiefarge mangler i CSS).
- `GENEALOGY_MAIN_GENRES`/`GENEALOGY_META_GENRES` inneholder den nye verdien.

## 7. Commit + push
Repoet er auto-push-autorisert. Commit til `main` og `git push` (Pages deployer).

## 8. Hvis artister skal flyttes til den nye sjangeren
Artistdata ligger i arbeidsfila `json files/Alt #03.json` (gitignorert) og
importeres til Firestore via lærer-import. Sett `mainGenre` (og `metaGenre` hvis
noden har ny `g`) nøyaktig lik tre-verdiene. Verktøyet i `json files/genre-review/`
validerer mot treet og lager backup før skriving.

---

### Kortversjon
1. Node i `GENEALOGY` (genealogy.js) — gir main+meta automatisk
2. Ny `fam`? → `FAMILIES` + 2 CSS-regler (styles.css)
3. `VK_HEAT`-rad (explore.js)
4. bump `version.js` + `./bump.sh`
5. `node --check` + sjekk `tre.html` (ingen advarsler, rett farge)
6. commit + push

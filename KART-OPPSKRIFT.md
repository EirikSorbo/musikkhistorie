# Oppskrift: kartet (musikkens geografi)

Kartet ble fjernet i **v4.39** da Referanser-kortet tok plassen dets i «Det store
bildet». Ingenting i dataene er rørt: `geography`-feltet står som før på hvert
artistkort. Denne oppskriften er alt som trengs for å bygge funksjonen opp igjen.

Siste versjon med kartet i drift: **v4.38**, commit `c02ecb6`.

## Hva det gjorde

Én modal, «Musikkens geografi»: et Nord-Amerika-kart med én prikk per sted der
artistene virket. Prikkens areal vokste med antall artister, og en tiårsstripe
øverst filtrerte utvalget, slik at tyngdepunktet flyttet seg synlig fra Delta og
New Orleans på 1920-tallet til Chicago, Detroit og New York senere. Steder utenfor
utsnittet (Oslo, London, Kingston) lå som klikkbare chips over kartet, og artister
uten plasserbart sted ble talt opp ærlig i en egen knapp under. Klikk på prikk,
chip eller opptellingen åpnet den vanlige artistlista.

## Slik hentes koden tilbake

De tre filene lar seg ikke skrive om fra prosa: `geo-map-data.js` er ~68 KB
maskingenerert path-data. Hent dem fra git:

```bash
git show c02ecb6:js/explore-kart.js  > js/explore-kart.js
git show c02ecb6:js/geo-map-data.js  > js/geo-map-data.js
git show c02ecb6:js/geo-places.js    > js/geo-places.js
git show c02ecb6:tests/unit/geo-places.test.js > tests/unit/geo-places.test.js
```

Modalens markup ligger i samme commit i `js/explore-modals.js` (søk etter
`modal-kart`), og hub-kortet like nedenfor (`sb-kart`).

## Slik kobles den inn igjen

1. **Modal-markup** i `js/explore-modals.js`: `<div class="modal-backdrop" id="modal-kart">`
   med `#kart-decades` (tiårsstripe), `#kart-abroad` (chips), `#kart-unplaced-row`
   og `#kart-svg`. Chips og opptelling står OVER kartet med vilje: under det havnet
   de under skjermkanten på mobil.
2. **Hub-kort** i samme fil: en `.dash-card` med id `sb-kart`, stedsnål-ikon
   (`stroke="#0d9488"`), tittel «Kart» og undertekst «Musikkens geografi gjennom
   ulike tiår».
3. **Wiring** i `js/explore.js`: importer `openKart`, legg `"modal-kart"` i lista i
   `wireModals()`, og koble `#sb-kart` til `openKart`.
4. **Tiårsstripa** i `js/ui-timeline.js`: kartet var eneste bruker av
   «Alle»-prikken. Den ble fjernet sammen med kartet, så `renderDecadeRibbon` må
   få tilbake `{ all = false, allLabel = "Alle" }`, `--dr-line-start`-variabelen
   og `dr-all`-knappen (se commit `c02ecb6`), pluss `.dr-all`-reglene i
   `css/styles.css` (lilla prikk, så «Alle» ikke leses som et årstall).
5. **Cache-busting**: bump `VERSION` i `js/version.js` og kjør `./bump.sh`.

## Hvordan det var bygget

- **Omrisset** (`geo-map-data.js`) er generert fra Natural Earth 50m (public
  domain, `nvkelso/natural-earth-vector`), Web Mercator klippet til lat 16,5–52,5
  og lng −128,5 til −63,5. `MAP_VIEW` er 1000 × 694,9. Path-ene skal **ikke**
  håndredigeres: skal utsnittet endres, regenereres de med samme klipp og
  projeksjon. `projectPoint(lat, lng)` speiler nøyaktig samme projeksjon, slik at
  prikkene treffer landet.
- **Stedstabellen** (`geo-places.js`) kobler artistenes `geography`-tekst til
  koordinater. `parseGeography` splitter på `;`, og hver del slås opp i `PLACES`
  med små bokstaver. Tre typer oppføringer: by på kartet (`{ label, lat, lng }`),
  diffust område (`region: true`, tegnet som stiplet ring) og utenfor utsnittet
  (`{ label, abroad: "Land" }`). Storbyområder er slått sammen med vilje: alle
  bydeler i New York, og Compton og Inglewood til Los Angeles. Scenen er poenget,
  ikke postadressen.
- **Aggregeringen** (`aggregatePlaces`) grupperer artister per sted, filtrert på
  tiår via `decadesForArtist`. En artist telles maks én gang per sted, men kan stå
  flere steder: migrasjonen fra sør til nord er hele poenget med kartet.
- **Tegningen** (`explore-kart.js`) skriver det statiske omrisset ÉN gang og lar
  `renderKartDots()` bare bytte prikk-laget ved tiårsbytte. Merkbart på svak mobil,
  siden omrisset er 68 KB path-data. Radius er `min(3 + 2,1·√n, 17)`, store prikker
  tegnes først så små forblir klikkbare, og steder med seks eller flere artister
  får navnet skrevet ved siden av.
- **Ærlighet om hull**: `unknownPlaces()` logger steder som mangler i `PLACES` ved
  hver åpning, og artister uten plasserbart sted telles opp i en klikkbar knapp.
  Skal kartet i drift igjen, er den knappen arbeidslista.

## Hvis det bygges opp igjen

Vurder om det fortsatt skal ligge i «Det store bildet»-huben, som nå har ni kort.
Alternativt kan kartet nås fra tiårsmodalen, der geografien uansett er tema.

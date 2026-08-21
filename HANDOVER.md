# Handover — pensum-appen, status 21. august 2026

Skrevet ved kontekstbytte, oppdatert samme dag etter v4.62, v4.63 og v4.64.
Appen er **v4.64**, utrullet på [historieappen.no](https://historieappen.no), 248 tester grønne.

---

## 1. Hva som er gjort i dette løpet

To store ting, i rekkefølge:

**A. Én delt datarot (v4.47).** Forsiden, lærersiden og slektstresiden koblet opp de
samme komponentene hver for seg, fra hver sin datarot. Det ga feil som «samme kort,
ulikt innhold avhengig av inngang». Nå går alt gjennom `js/shared-data.js`.

**B. Sjangertreet er flyttet fra kode til Firestore, i fire faser.** Målet var at
læreren skal kunne opprette, endre og slette sjangre uten utvikler. Alle fire faser er
ferdige, pushet og live.

| Fase | Versjon | Hva |
|---|---|---|
| 0 | v4.48 | Avledningene samlet i `js/genre-model.js`; rådata skilt ut som frø |
| 1 | v4.51 | Treet leses fra `content/genealogy` i Firestore; ingen kopi i koden |
| 2 | v4.58 | Bundlede bånd ER treet; kolonnene regnes ut; `cx` slettet |
| 3 | v4.60 | Lærer-editor med migreringsplan og blokkert sletting |

Underveis ble seks ekte feil funnet og rettet (se §6).

---

## 2. Arkitekturen nå

### Datalaget

```
content/genealogy   ← HELE sjangertreet, ett dokument, version 2
  { version, nodes[], metaGenres[], families{}, metaOrderHint[] }
```

- **`js/shared-data.js`** — ENESTE vei til de syv delte samlingene (artists,
  genreDescs, edgeDescs, tech, content, decades, podcasts). Alle sider kaller
  `sharedStateDefaults()` + `subscribeSharedData(state, hooks)`. Treet rir på det
  eksisterende `content`-abonnementet, så det koster null ekstra lesinger.
- **`js/genealogy-data.js`** — FRØET. Brukes kun av seed-generatoren og testene.
  **Ingen runtime-modul importerer den** — appen har med vilje ingen kopi av
  pensumet i koden.
- **`js/genre-model.js`** — alle avledninger (vokabular, kanter, farger, tiårsakse).
  Eksportene er `let` som `rebuild()` tilordner på nytt; ES-modulenes live bindings
  gjør at ~20 lesere ser ferske verdier. **Fang aldri en avledet verdi i en
  modulnivå-konstant** — det er den vanligste feilen i denne kodebasen.
- **`js/genre-validate.js`** — sykler, duplikater, manglende foreldre, «/» i etikett.
  Importen avviser et ugyldig tre i stedet for å skrive det.

### Visningen

- **`js/genre-layout.js`** — regner ut x fra metasjangerens `column`, slektskapet og
  plassbehov. Erstattet de håndsatte `cx`-koordinatene.
- **`js/genealogy-bundled.js`** — slektstreet (bundlede bånd). Foreldrene til en
  sjanger samles i ett bånd i BARNETS farge, så en sammensmeltning leser som
  likestilte foreldre.
- **`js/gx-camera.js`** — panorering/zoom/pinch, delt.
- **`js/genealogy.js`** — nå KUN sjanger- og koblingskortene (popupene). Det gamle
  pakkede kartet er slettet.
- **`js/constellation.js`** — Sjangerhimmelen, deler nå treets utregnede layout.
- **`js/tre-page.js`** — delt oppstart for slektstresiden.

### Lærer-editoren

- **`js/teacher-genres.js`** — UI (liste, skjema, plan-dialog).
- **`js/genre-migrate.js`** — REN planlegger. Skriver ingenting, returnerer en plan.
- **`store.js: runMigrationPlan(ops)`** — utfører planen i ÉN atomisk batch.

---

## 3. Det bærende designvalget i editoren

**Trygge endringer** (fullt navn, epoke, metasjanger, tiår, foreldre, farge, ny
sjanger) skrives rett. Ingen andre peker på dem.

**Identitetsbytter** (etiketten, og sletting) går ALLTID via en plan som vises for
læreren og utføres atomisk. Grunnen: etiketten er en identitet **syv** steder:

1. `content/genealogy` — nodens `l`
2. `genreDescriptions` — DOKUMENT-ID-en er etiketten
3. `artists[].mainGenre` — taggene
4. `artists[].musicExamples[].genre` — sjanger per lytteeksempel
5. `content/varmekart` — heat-radene er nøklet på etiketten
6. `config/teacherChecks.genres` — navneliste
7. `pendingEdits` — `entityId` for et sjangerforslag ER etiketten

For metasjangre kommer i tillegg `story`-feltet (sjangerhistoriene bor på
metasjangerens `genreDescriptions`-dokument) og `metaOrderHint`.

**Node-ID-er endres ALDRI.** `edgeDescriptions` har `fra__til` som dokument-ID.

**Sletting blokkeres** av artister som er tagget og av barn som ville mistet
slektskapet, med liste over hva som må ryddes først.

**Frie undersjangre med samme navn røres bevisst ikke** — det er et annet vokabular
(shadowing-fella). Læreren varsles i stedet.

---

## 4. Åpne punkter

1. **App Check** er fortsatt utsatt (fra tidligere). Firestore har `allow read: if
   true`, så REST-skraping er mulig. Bør på plass før appen deles bredt med
   studentene.
2. **`metaGenres[].order` skrives, men leses ingen steder** (se punkt 3 under —
   dette er den eneste reelle resten).
3. **`metaGenres[].order` skrives, men leses ingen steder.** Seed-generatoren
   setter den, og kommentaren der sier at varmekartet og tidslinjen leser den.
   Det gjør de ikke: de leser `metaOrderHint`. Feltet er altså dødt, men står
   igjen i data. Enten ta det i bruk eller fjern det.

### Alle fire faser er nå i drift

Sjangertreet er fullt datadrevet, `content/genealogy` er rent strukturelt, og
læreren kan opprette, endre og slette sjangre og metasjangre uten utvikler.

### Lukket i v4.62, v4.63 og v4.64

- Første ekte navnebytte er kjørt mot live Firestore av Eirik. Navnet byttet i
  treet og artistenes sjangertilknytning fulgte med, slik planen sa.
  Migreringsmaskineriet er dermed bekreftet i drift.
- `prompt()` i metasjanger-editoren er erstattet med et skjema som node-editorens.
- Sletting av metasjanger finnes nå (`planMetaDelete`), med blokkering.
- `planTreeUpdate` er fjernet — den var aldri tatt i bruk.
- Importlista er ren. **Merk hvorfor det tok tid:** fem av de sju «ubrukte»
  importene var i høyst levende bruk. Se §6.
- Fase 4 er kjørt og verifisert mot live: `era` og `t` er ute av treet og bor
  i `genreDescriptions[etikett].main` som `era` og `lytt`. 54 epoker og 105
  lytteforslag flyttet. Ingenting tapt (43 activeFrom og 50 beskrivelser både
  før og etter), og shadowing holdt: 15 dokumenter har både main og sub, og
  sub-nivået er urørt i alle 15. De kuraterte lytteforslagene som ingenting
  leste, vises nå som «Hør etter» på sjangerkortet.

## 5. Arbeidsrutiner du MÅ følge

**Versjonsbump ved hver endring:**
```bash
cd "/Users/eiriks05/Documents/Eiriks Script/pensum"
printf 'export const VERSION = "4.64";\n' > js/version.js && ./bump.sh
```
`bump.sh` setter `?v=` i alle `js/*.js`, `*.html` og `tests/*/*.js`. Uten dette får
brukerne stale moduler. **Og under lokal verifisering rammer det deg selv:**
redigerer du en fil uten å bumpe, serverer nettleseren fortsatt den forrige
utgaven bak samme `?v=`. Det skjedde to ganger i v4.63-runden, én gang for en
modul og én gang for stilarket, og så ut som om koden ikke virket. Bump, eller
hent fila med en engangsparameter når du måler. **Merk:** gjør aldri søk-og-erstatt mot et `?v=`-mønster før
du vet hvilken versjon fila faktisk står på — det var rotårsaken til at hele
lærersiden døde i v4.60.

**Kontroller før commit:**
```bash
npm test                        # 225 tester
node tools/check-imports.js     # brutte + ubrukte + brukt-uten-import
node tools/find-stale-refs.js   # referanser til fjernede navn
```

**Seed-fila regenereres:**
```bash
node tools/seed-genealogy.js    # → "json files/genealogy-seed.json" (gitignored)
```
Importeres av læreren i Innholdspakke-flyten. Formen MÅ være
`{ formatVersion, genealogy: {...} }` med `genealogy` på toppnivå.

**Lokal verifisering** (sandkassen blokkerer socket-binding, så serveren må kjøres
utenfor den):
```bash
python3 -m http.server 8788 --bind 127.0.0.1
```
Så `http://127.0.0.1:8788/tre.html?kode=MUR114`. Klassekoden er `MUR114`.

**Push:** auto-push er avtalt. `git push` krever nøkkelringen, altså utenfor
sandkassen.

---

## 6. Feller som har kostet tid (les disse)

**grep er UPÅLITELIG i dette repoet.** Flere kildefiler leses som binære og hoppes
STILLE over uten `-a`. Det skjulte at `explore-tidslinje.js` fortsatt brukte
`canonMain`, og feilen dukket først opp som en ReferenceError i nettleseren. Bruk
`tools/`-verktøyene eller node/python til å lese filer.

**Lærersiden kan ikke verifiseres fra innloggingsskjermen.** `startApp()` kjører
først etter Google-innlogging og setter `state.started = true` som første linje.
Kaster den etterpå, blir alt etter ukoblet, den prøver aldri igjen, og siden ser helt
normal ut. Dette drepte hele lærersiden i v4.60.

**Lyttere overlever omtegning.** `#gx-stage`, zoom-knappene og `.gx-card` består når
kartet tegnes på nytt (bare `#gx-cam` tømmes). Alt må gjennom kameraets opprydding.
Skjedde i v4.58: kartet panorerte etter musepekeren uten at noen knapp var nede.
Diagnose-triks: mål zoom per knappetrykk — er den 1,5625 i stedet for 1,25, er det to
kameraer i live.

**Test med TØMT localStorage-speil.** `localStorage.removeItem("pensum_cache_genealogy_v1")`.
Speilet skjuler at vokabularet er asynkront. To feil nådde live fordi jeg testet med
varmt speil.

**Gå den EKTE veien.** Jeg verifiserte fase 1 ved å injisere treet i speilet, ikke
gjennom importen. Importen var brutt, og det oppdaget brukeren, ikke jeg.

**check-imports.js var blind for maler (rettet i v4.63).** Den blanket
anførselstegn uten å skille vanlig streng fra MAL. I `title="${escapeHtml(t)}"`
parer de to anførselstegnene seg rundt uttrykket, så symbolet forsvant før bruk
ble målt. Fem av sju «ubrukte importer» var derfor i bruk — INSTRUMENT_COLOR,
HEAT_NODATA, escapeHtml, pct, PRIO_LABELS. Hadde man ryddet etter lista, ville
fem filer brutt. Verifiser alltid en «ubrukt»-melding manuelt før du sletter.

**Klasser som ikke finnes i CSS-en feiler ikke.** `.form-grid` ble tatt i bruk av
node-editoren i v4.60 uten å eksistere, og skjemaet fløt på rad i tre versjoner
uten at noe så ødelagt ut. Det samme gjaldt `dash-sub`. Sjekk at klassen finnes
når du skriver ny markup.

**Merge kan ikke fjerne en nøkkel.** Firestore dyp-fletter map-felter. Varmekartet må
skrives med `doc.replace`, ellers blir den gamle heat-nøkkelen liggende.

**Shadowing:** ett `genreDescriptions`-dokument kan holde både `main` (tre-sjanger) og
`sub` (fri undersjanger) for samme navn. Et navnebytte skal flytte kun `main`.

---

## 7. Neste steg, forslagsvis

1. Avgjør hva `metaGenres[].order` skal være — i bruk eller borte.
2. App Check før studentene får appen bredt. Dette er nå det største
   gjenstående punktet.
3. Fyll inn epoke og lytteforslag der de mangler: 11 sjangre har ennå ikke
   `activeFrom` (de åtte rot-nodene pluss Urban music, Rock'n'roll og Rock), og
   to sjangre har ingen lytteforslag. Begge redigeres nå samme sted som
   beskrivelsen.

## 8. Minnefiler

Konteksten ligger i `~/.claude/projects/-Users-eiriks05-Documents-Eiriks-Script/memory/`.
Mest relevante nå:

- `pensum-dynamiske-sjangre-plan.md` — de fem låste beslutningene og status per fase
- `pensum-delt-datarot.md` — den ene datarota
- `pensum-slektstre-prototype.md` — bundlede bånd, og hvorfor de vant
- `pensum-grep-er-upaalitelig.md`
- `pensum-laerersiden-testes-etter-innlogging.md`
- `pensum-lyttere-overlever-omtegning.md`
- `pensum-cache-busting.md` — bump-regelen

**Fem låste beslutninger fra 20.08** (ikke ta dem opp igjen uten grunn):
bundlede bånd er treet · studenter kan IKKE foreslå strukturendringer · fargen eies av
metasjangeren med unntak per node · sletting blokkeres · ambisjonen er «samme app,
annet innhold», ikke en flerfags-plattform.

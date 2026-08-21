# Handover — pensum-appen, status 21. august 2026

Skrevet ved kontekstbytte. Alt her er verifisert mot koden og mot live samme dag.
Appen er **v4.61**, utrullet på [historieappen.no](https://historieappen.no), 225 tester grønne.

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

1. **Skrivestien i editoren er ALDRI kjørt mot Firestore.** Den krever
   lærerinnlogging. Planlegging, validering, blokkering og UI er verifisert i
   nettleseren med ekte tre og påfylt tilstand, uten skriving. **Første ekte
   navnebytte bør gjøres på noe lite, med fersk Innholdspakke-eksport i bakhånd.**
   (Eirik tok en eksport 21.08 etter at v4.61 var oppe.)
2. **Metasjanger-editoren bruker `prompt()`** for navn. Fungerer, men er ikke husets
   uttrykk. Bør bli et skjema som node-editoren.
3. **Sletting av metasjanger er ikke implementert** — bare navnebytte og opprettelse.
4. **`planTreeUpdate` i genre-migrate.js er ubrukt** (editoren skriver treet direkte
   via `saveGenealogyTree`). Enten ta den i bruk eller fjern den.
5. **Ti ubrukte importer** rapporteres av `check-imports.js`, de fleste
   pre-eksisterende. Ufarlig, men kan ryddes.
6. **App Check** er fortsatt utsatt (fra tidligere). Firestore har `allow read: if
   true`, så REST-skraping er mulig.

---

## 5. Arbeidsrutiner du MÅ følge

**Versjonsbump ved hver endring:**
```bash
cd "/Users/eiriks05/Documents/Eiriks Script/pensum"
printf 'export const VERSION = "4.62";\n' > js/version.js && ./bump.sh
```
`bump.sh` setter `?v=` i alle `js/*.js`, `*.html` og `tests/*/*.js`. Uten dette får
brukerne stale moduler. **Merk:** gjør aldri søk-og-erstatt mot et `?v=`-mønster før
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

**Merge kan ikke fjerne en nøkkel.** Firestore dyp-fletter map-felter. Varmekartet må
skrives med `doc.replace`, ellers blir den gamle heat-nøkkelen liggende.

**Shadowing:** ett `genreDescriptions`-dokument kan holde både `main` (tre-sjanger) og
`sub` (fri undersjanger) for samme navn. Et navnebytte skal flytte kun `main`.

---

## 7. Neste steg, forslagsvis

1. Gjør det første ekte navnebyttet i editoren, på noe lite. Bekreft at planen stemmer
   med det som faktisk skjer.
2. Rydd punkt 2–5 i §4 (prompt→skjema, meta-sletting, ubrukt kode).
3. Vurder fase 4 fra den opprinnelige planen: flytt lytteeksempler og epoke fra treet
   til `genreDescriptions`, så strukturdokumentet blir rent strukturelt.
4. App Check før studentene får appen bredt.

---

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

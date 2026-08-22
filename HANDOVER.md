# Handover — pensum-appen, status 22. august 2026

Skrevet ved kontekstbytte 21.08; oppdatert 22.08 etter den store gjennomgangen
(v4.65 bugfikser + v4.66 sletterunde + v4.67 tester/verktøy/dokumentasjon).
Appen er **v4.67**, utrullet på [historieappen.no](https://historieappen.no),
253 tester grønne (0 hoppet over).

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

## 4. Åpne punkter (etter gjennomgangen 22.08)

1. **Publiser firestore.rules.** v4.65 la størrelses-/antallstak på
   artists-create (metaGenre/mainGenre/subGenre/geography/recordLabel m.fl.).
   Fila i repoet er oppdatert; konsollen må ha samme innhold
   (Firebase Console → Firestore → Rules → Publish).
2. **App Check** er fortsatt utsatt (fra tidligere). Firestore har `allow
   read: if true`, så REST-skraping er mulig. Bør på plass før appen deles
   bredt. (Regel-nivå kan heller ikke begrense ANTALL pending-dokumenter per
   anonym uid — kjent begrensning, også et App Check-argument.)
3. **To foreldreløse varmekart-rader i live-data:** «Gullalder-hip-hop» og
   «Country» (rester etter navnebyttene i v4.38 — fikspakken fra juli som
   aldri ble kjørt). Ufarlige (visningen ignorerer dem), flagges som
   diagnostikk av innholdspakke-testen. Ryddes med en varmekart-import uten
   radene, eller en liten fikspakke ved lærer-innlogging.
4. **Pop- og Rock-historiene er skrevet, men var usynlige.** Databasen har
   `story` på alle NI metasjangre, mens den kuraterte lista (STORY_ORDER)
   bare viser sju. Fra v4.65 leser visningene `storyOrder()`, som OGSÅ tar
   med metasjangre som har historie — så Pop og Rock vises nå (bakerst).
   Er det uønsket: slett story-feltet på Pop/Rock, eller si fra så legges
   en eksplisitt utelukkelse inn.
5. **«Hør etter»-feltet på musikkeksempler redigeres, men vises aldri.**
   Visningen ble fjernet i v3.71; redigeringsfeltet ble stående. Avgjør:
   gjeninnfør visningen (liten jobb) eller fjern feltet fra editorene.
   Se NB-en i HOR-ETTER-PROMPT.md. (Sjangernivåets «Hør etter» vises.)
6. **Ta en fersk eksport.** Nyeste musikkhistorie-JSON er fra 18.08 — FØR
   treet kom til Firestore og FØR navnebyttet som er kjørt live. Gamle
   backuper er gift (import ruller tilbake); seed-generatoren advarer nå
   om det samme.
7. **metaGenres[].order er avviklet i koden** (ingenting leste det, skrives
   ikke lenger). Feltet kan bli liggende i eksisterende dokumenter — helt
   ufarlig, forsvinner ved neste tre-skriving via editoren/importen.

### Alle fire faser er i drift, og hele appen er gjennomgått (22.08)

Sjangertreet er fullt datadrevet, `content/genealogy` er rent strukturelt, og
læreren kan opprette, endre og slette sjangre og metasjangre uten utvikler.

**Gjennomgangen 22.08** (127 verifiserte funn → v4.65–v4.67) fikset bl.a.:
kilde-editorene som strøk kategori/forfatter/år ved lagring; rebuild-
rekkefølgen som ga grått kart ved kald start; varmestripa som ignorerte
fargearven; student-skjemaet som ble nullstilt av content-snapshots;
migreringens doc.delete som utslettet meta/story (sjangerhistorien!) for
etiketter som deler navn med en metasjanger; STORY_ORDER som åttende
identitetsbærer (visningene leser nå storyOrder()); merge-import av treet;
«Utfør» som kastet planen ved feil og aldri fersk-sjekket den; confused
deputy i approvePendingEdit; ~50 tankestrek-brudd i apptekst; og en
sletterunde (død JS/CSS/markup, 862 KB ubrukt bilde, to utdaterte
MD-dokumenter). Testene kjører nå v2-formen av treet (samme transformasjon
som seed-generatoren, tools/build-genealogy-doc.js), fasiten regenereres med
tools/dump-genre-fixture.js, og pre-push kjører testene + verktøyene +
manglende-?v=-sjekk.

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

**Kontroller før commit** (pre-push kjører alle tre automatisk):
```bash
npm test                        # 253 tester
node tools/check-imports.js     # brutte/ubrukte importer + foreldreløse moduler + genealogy-data-regelen
node tools/find-stale-refs.js   # referanser til fjernede navn
```

**Seed-fila regenereres:**
```bash
node tools/seed-genealogy.js    # → "json files/genealogy-seed.json" (gitignored)
```
NB: den bygger fra KODEFRØET (v4.47-treet) og advarer selv om at import av
den ruller tilbake lærer-endringer gjort i tre-editoren. Testfasiten
regenereres BEVISST med `node tools/dump-genre-fixture.js`.
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

1. Publiser firestore.rules (se Åpne punkter, punkt 1).
2. App Check før studentene får appen bredt.
3. Fyll inn epoke og lytteforslag der de mangler: 11 sjangre har ennå ikke
   `activeFrom` (de åtte rot-nodene pluss Urban music, Rock'n'roll og Rock), og
   to sjangre har ingen lytteforslag. Begge redigeres nå samme sted som
   beskrivelsen.
4. Rydd de to foreldreløse varmekart-radene og avgjør Pop/Rock-historiene og
   «Hør etter»-feltet (Åpne punkter 3–5).

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

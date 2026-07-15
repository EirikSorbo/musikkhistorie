# Populærmusikkhistorie – pensum-app

En webapp for et kuratert musikkhistorie-pensum (MUR114). Læreren bygger og
vedlikeholder innholdet; klassen utforsker det, og kan *justere* det ved å
stemme frem de viktigste artistene og foreslå det de mener mangler.

Ingen innlogging for studentene – de åpner bare lenken og bidrar.

---

## Funksjoner

- **Utforsk pensumet** — «Det store bildet» samler inngangene:
  - **Slektstre** («Carta» i musicmap-stil): sjangrene fra røtter til i dag,
    med klikkbare *koblinger* mellom dem (hvordan én sjanger påvirket den neste).
  - **Sjangerhistorier**, **sjangerbeskrivelser** i tre nivåer (meta/main/sub)
    og **koblingsbeskrivelser** for hver strek i treet.
  - **Tidslinje**, **varmekart**, **geografisk kart** og **sjangerhimmel**
    (stjernekart), pluss tiårskontekst (samfunn + teknologi) og teknologikort.
- **Finn artister**: søk og filtrer på sjanger, hovedsjanger, tiår og instrument;
  «dagens artist».
- **Foreslå artist / innovasjon** (justering av pensumet) med navn, årstall,
  kjønn, sjanger, instrument, geografi, begrunnelse, verk, musikkeksempler,
  bilde og kilder. Nye forslag venter på lærergodkjenning.
- **Endringsforslag**: studenter kan foreslå endringer på eksisterende artist-,
  teknologi-, sjanger- og tiårskort; læreren godkjenner/avviser felt for felt.
- **Stem frem**: studenter markerer forslag som «svært relevant».
- **Sanntid**: alle ser endringer umiddelbart (Firebase Firestore).
- **Lærermodus** (Google-innlogging): Skrivebord med arbeidsflyt-innboks og
  sjekk-fremdrift per innholdskategori, Oversikt over pensumets form og hull,
  innholdsredigering (beskrivelser/historier/koblinger/varmekart), godkjenn/
  avvis/prioriter/skjul/rediger, import/eksport (JSON) og instrument-vokabular.

---

## Arkitektur

Fire sider med felles datalag. Rene HTML/JS ES-moduler uten byggesteg.

```
index.html            Forside: Det store bildet, Finn artister, dagens artist
student.html          Studentside: foreslå artist
teacher.html          Lærerside (Google-innlogging): Skrivebord, Oversikt, admin
tre.html              Slektstre-siden (sjangerkart i musicmap-stil)
css/styles.css        Styling (lyst, moderne tema)
js/
  firebase-config.js  Firebase-nøkler + lærer-e-poster  ← DU FYLLER INN
  shared.js           Delte hjelpere (oppsett-sjekk, banner, $)
  util.js             Avhengighetsfrie hjelpere (escapeHtml, safeUrl, debounce)
  store.js            Datalag mot Firestore (sanntid, CRUD, stemming)
  artist-schema.js    ÉN sannhetskilde for artistfeltene (nøkler/etiketter/typer)
  artist-normalize.js Normalisering av artistdata (ren, enhetstestbar)
  config-normalize.js Config-normalisering (instrument-vokabular)
  import-format.js    Parselogikk for import-JSON (ren, enhetstestbar)
  limits.js           Instrument-standard, DECADES, telling, isVisible, statistikk
  genealogy.js        Slektstreet — sannhetskilde for sjangre + koblinger (edges)
  genre-descriptions.js  Nivådelte sjangerbeskrivelser (meta/main/sub)
  constellation.js    Sjangerhimmelen (stjernekart)
  geo-places.js / geo-map-data.js   Geografisk kart
  linkify.js          Auto-lenking av artist-/tech-/sjangernavn i tekst
  ui.js               Rendering + re-eksport-knutepunkt for ui-*-modulene
  ui-*.js             Hjelpere, modaler, tidslinjer, tech, dashboard, diff
  explore.js          Utforsk — orkestrator (injiserer/wirer modalene, initExplore)
  explore-*.js        Utforsk-featurene: context (delt kjerne + gjenbrukshjelpere),
                      modals, varmekart, tidslinje, tech, decade, kart, sjanger, innhold
  proposals.js        Endringsforslag-editoren (student)
  landing.js / student.js / tre.js   Side-logikk
  teacher.js + teacher-*.js          Lærer-logikk (kjerne + feature-moduler)
tests/                Enhetstester (node --test) + regeltester (emulator)
firestore.rules       Sikkerhetsregler for databasen
bump.sh               Setter ?v=… (cache-busting) fra js/version.js
```

**Datamodell (Firestore):** samlingene `artists`, `config` (instrument-
vokabular + `teacherChecks`), `decades`, `genreDescriptions`,
`edgeDescriptions` (koblingstekster), `content` (innholdssider + varmekart),
`tech`, `podcasts` og `pendingEdits`. Alt pensuminnhold bor i Firestore — ingen
fallback-tekster i koden. Artistfeltene er definert i `js/artist-schema.js`.
Bare forslag med `status: "active"` som ikke er lærer-skjult (`priority: -1`)
vises for studenter.

---

## Oppsett av Firebase (ca. 5 minutter)

1. Gå til <https://console.firebase.google.com> og logg inn med Google-konto.
2. **Add project** → gi det et navn (f.eks. `pensum-musikkhistorie`) →
   du trenger ikke Google Analytics. Opprett.
3. I prosjektet: **Build → Firestore Database → Create database**.
   - Velg **Start in production mode** (vi legger inn egne regler).
   - Velg en region nær deg (f.eks. `eur3 (europe-west)`).
4. Hent web-nøklene: **Project settings (tannhjulet) → General →**
   **Your apps → Web (`</>`)**. Registrer en app (kallenavn, f.eks. `pensum`).
   Kopier verdiene fra `firebaseConfig`-objektet du får.
5. Lim dem inn i `js/firebase-config.js` (erstatt `DIN_API_KEY` osv.).

### Innlogging (Google for lærer + anonym for stemming)

6. Slå på Google-innlogging: **Build → Authentication → Get started →**
   **Sign-in method → Google → Enable**. Velg et støtte-e-postnavn og lagre.
   Slå samtidig på **Anonymous → Enable** i samme liste — appen logger hver
   student-nettleser inn anonymt (usynlig) og bruker uid-en som
   stemme-identitet. Uten Anonymous aktivert feiler stemming og innsending.
7. Sett din lærer-e-post **to steder** (samme adresse begge steder):
   - `js/firebase-config.js` → `TEACHER_EMAILS`
   - `firestore.rules` → funksjonen `isTeacher()`
8. Legg inn sikkerhetsreglene: **Firestore → Rules**, lim inn innholdet fra
   `firestore.rules`, og trykk **Publish**. VIKTIG: gjenta dette hver gang
   `firestore.rules` endres i repoet — fila og konsollen må være i synk.
9. Når appen ligger på en nettadresse (f.eks. GitHub Pages), legg domenet til
   under **Authentication → Settings → Authorized domains** (f.eks.
   `ditt-brukernavn.github.io`). `localhost` er godkjent fra før.

Appen er nå klar. Innhold legges inn i lærermodus eller importeres via en
innholdspakke-JSON (Innstillinger → Importer).

---

## Publisering (så klassen får en lenke)

Appen er ren HTML/JS uten byggesteg, så enhver statisk webhost funker.

**GitHub Pages:** push mappa til et GitHub-repo, gå til **Settings → Pages**,
velg `main`-branchen og rot-mappa. Du får en URL som
`https://ditt-brukernavn.github.io/repo-navn/`. Husk å legge dette domenet til
under Authentication → Authorized domains (se punkt 9 over).

**Cache-busting:** ved hver endring, bump `VERSION` i `js/version.js` og kjør
`./bump.sh` (oppdaterer alle `?v=`-referanser). En pre-push-hook
(`.githooks/pre-push`, aktiveres med `git config core.hooksPath .githooks`)
nekter push hvis versjonene er i utakt.

---

## Testing

- **Enhetstester** (ingen avhengigheter): `npm test` — kjører `node --test`
  på ren logikk (normalisering, diff, grenser, linkify, importformat).
- **Regeltester** (Firestore-emulator): `npm run test:rules` — krever
  `npm install` (henter `firebase-tools` og `@firebase/rules-unit-testing`)
  og Java. Verifiserer at `firestore.rules` tillater/avviser riktig.

---

## Vokabular og strukturakser

- **Hovedsjangre** utledes fra slektstreet (`js/genealogy.js`).
- **Tiår** (1900–2020) er `DECADES`-konstanten i `js/limits.js`.
- **Instrumenter** er den eneste redigerbare lista i innstillingene (styrer
  nedtrekksmenyene i forslagsskjema og filtre).

---

## Sikkerhet – det du bør vite

- Studenter trenger ikke synlig innlogging: appen logger nettleseren inn
  **anonymt** (Firebase Auth) i bakgrunnen. Alle med lenken kan lese, foreslå
  og stemme.
- **Stemmene er uid-beskyttet:** Firestore-reglene tillater kun å legge til
  eller fjerne *sin egen* uid i stemmelista. Ingen kan røre andres stemmer
  eller fylle på falske. (Én person kan fortsatt stemme fra flere
  nettlesere/inkognito — «én stemme per person» krever ekte innlogging.)
- Lærerfunksjoner (godkjenn, skjul, slett, endre grenser) krever innlogging
  med en godkjent Google-konto. Sikkerheten ligger i `firestore.rules`, ikke i
  nettleseren – en student kan ikke utføre lærerhandlinger selv om de finner
  lærersiden, fordi databasen avviser det uten en godkjent konto.
- Alle studentleverte URL-er vaskes (kun `http/https`) før de settes inn som
  lenker/bilder, så `javascript:`-lenker ikke kan kjøre skript.
- Personvern: den anonyme uid-en er en pseudonym identifikator (ingen navn,
  e-post eller lignende). Navnefeltet i skjemaene er valgfritt og kan stå som
  «Anonym». Firestore-data lagres i EU-region.
- `firebaseConfig`-nøklene er ikke hemmelige (de ligger uansett i nettleseren),
  så det er trygt å legge prosjektet i et offentlig GitHub-repo.

---

## Utforske uten Firebase

Hvis `firebase-config.js` ikke er fylt ut, starter appen i **oppsettmodus**:
grensesnittet vises med standardoppsett så du kan se hvordan det ser ut, men
ingenting lagres før databasen er koblet til.

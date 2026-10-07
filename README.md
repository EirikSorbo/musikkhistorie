# Populærmusikkhistorie – pensum-app

En webapp for et kuratert musikkhistorie-pensum (MUR114). Læreren bygger og
vedlikeholder innholdet; klassen utforsker det, og kan *justere* det ved å
stemme frem de viktigste artistene og foreslå det de mener mangler.

Ingen innlogging for studentene – de åpner bare lenken og bidrar.

---

## Funksjoner

- **Utforsk pensumet** — «Det store bildet» samler inngangene:
  - **Slektstre** (bundlede bånd): sjangrene fra røtter til i dag på tiårslinjer,
    med klikkbare *koblinger* mellom dem (hvordan én sjanger påvirket den neste).
    Treet bor i Firestore og redigeres av læreren i tre-editoren.
  - **Sjangerhistorier**, **sjangerbeskrivelser** i tre nivåer (meta/main/sub)
    og **koblingsbeskrivelser** for hver strek i treet.
  - **Tidslinje**, **varmekart** og **sjangerhimmel** (stjernekart), pluss
    tiårskontekst (samfunn + teknologi) og teknologikort.
  - **Referanser**: alle kildene appen bygger på, samlet og gruppert etter
    hovedkilde (utledet av dataene, ikke vedlikeholdt for hånd).
- **Finn artister**: søk og filtrer på sjanger, metasjanger, tiår og instrument;
  «dagens artist».
- **Foreslå artist / innovasjon** (justering av pensumet) med navn, årstall,
  kjønn, sjanger, instrument, geografi, begrunnelse, verk, musikkeksempler,
  bilde og kilder. Nye forslag venter på lærergodkjenning.
- **Endringsforslag**: studenter kan foreslå endringer på eksisterende artist-,
  teknologi-, sjanger- og tiårskort; læreren godkjenner/avviser felt for felt.
- **Stem frem**: studenter markerer forslag som «svært relevant».
- **Visning**: presentasjonsmodus for lerretet (nivåer, hurtigtaster,
  YouTube-avspilling) og **kjøreplaner**: lagrede rekker av stopp som spilles
  fra et oversiktskort, med «neste», klokke og «spill alle lytteeksemplene».
  Læreren bygger en plan ved å velge «Bygg på» i Visning-vinduet: så legger
  visningsknappen på kortene, plussknappen på radene og tasten + kortet rett
  inn med ett klikk (pille nede til venstre viser planen, Ferdig avslutter).
  **Lerret på annen skjerm** (skjermknappen i verktøylinja, v6.50): et eget
  lerretvindu på prosjektoren følger lærerens vindu over en BroadcastChannel
  (kort, nivå, rulling, svart skjerm; lyden fra lerretet). Slektstreet vises
  i en ramme på lerretets forside (beholder fullskjermen), med samme utsnitt. **Private notater**
  (tasten P) til artist-, sjanger-, innovasjons- og tiårskort vises bare i
  lærerens vindu og lagres i samlingen `notater`, som bare læreren leser.
  «Ta opp» logger alt læreren åpner. Editoren har søk, dra og slipp og
  «Husk visningen» per stopp. Tasten N i visningen åpner «Navn fra timen»:
  en artist som kom opp, og hvem som foreslo den, lagres til oppfølging på
  Skrivebordet på lærersiden (samlingen `timeforslag`, bare læreren).
- **Lytteeksempler** spilles i appens egen spiller overalt (ikke i ny fane),
  med starttidspunkt, «Kopier lenke» og knappene for kjøreplan og utskrift;
  «Åpne på YouTube» står som reserve for videoer som ikke kan bygges inn.
  «Spill alle» i spillelistene spilles som kø i samme spiller. Tasten L
  spiller det første lytteeksempelet til artisten som vises; S åpner søket.
  Starttiden settes i feltet «Start» i lytteeksempel-raden (redigering og
  forslag) og lagres i selve YouTube-lenka som `t=…s`.
- **Utskrift**: studentene velger kort (artister, sjangre, tiår, innovasjoner …)
  med skriverikonet i kortenes tittellinje, eller tar en hel kjøreplan eller
  en hel metasjanger (sjangrene, artistene og tiårene følger med, og kan hukes
  bort én og én), eller tar med enkelte lytteeksempler fra spilleren, og får
  et hefte i A4 med forside, innholdsfortegnelse, tidslinje og lytteliste
  med QR-kode, som nettleseren lagrer som PDF.
  Skriverikonet i toppmenyen viser utvalget som en liste (ta ut, dra for
  rekkefølgen, tøm). Utvalget bor i nettleseren og kan sendes til en annen
  enhet som lenke eller QR-kode. (Midlertidig skjult for studentrollen,
  bryteren `utskrift` i `js/felles/feature-flags.js`.)
- **Sanntid**: alle ser endringer umiddelbart (Firebase Firestore).
- **Lærermodus** (Google-innlogging): Skrivebord med arbeidsflyt-innboks og
  sjekk-fremdrift per innholdskategori, Oversikt over pensumets form og hull,
  sjangertre-editor (opprette/endre/slette sjangre og metasjangre — navnebytter
  og slettinger planlegges og skrives atomisk), innholdsredigering
  (beskrivelser/historier/koblinger/varmekart), godkjenn/avvis/prioriter/
  skjul/rediger og import/eksport (JSON).

---

## Arkitektur

Fem sider med felles datalag. Rene HTML/JS ES-moduler uten byggesteg.

```
index.html            Forside: Det store bildet, Finn artister, dagens artist
student.html          Studentside: foreslå artist
teacher.html          Lærerside (Google-innlogging): Skrivebord, Oversikt, admin
tre.html              Slektstre-siden (bundlede bånd)
utskrift.html         Utskrift: studentens eget hefte av valgte kort (PDF via nettleseren)
css/styles.css        Styling (lyst, moderne tema)
css/utskrift.css      Heftet på skjerm og papir (@page, sidebrytinger)
js/                   Modulene, i mapper etter område (alle filene: MODULKART.md)
  landing.js …        Én fil per side rett i js/, pluss gate, load-guard og version
  firebase-config.js  Firebase-nøkler + lærer-e-poster  ← DU FYLLER INN
  utforsk/            Utforsk: Det store bildet, tiår, sjangre, varmekart, søk …
  sjangre/            Sjangermodellen, sjangerkortet og slektstreet
  visning/            Presentasjonsvisningen og kjøreplanene
  laerer/             Lærersiden
  forslag/            Endringsforslagene
  utskrift/           Heftet
  ui/                 Byggeklosser for skjermen (kort, lister, modaler, spilleren)
  data/               Firestore, den delte dataroten og appens tilstand
  felles/             Hjelpere og vokabular som flere deler av appen bruker
  vendor/             Tredjepartskode (QR-koder)
MODULKART.md          Alle filene i js/, én linje hver, laget av tools/modulkart.js
tests/                Enhetstester (node --test) + regeltester (emulator)
tools/                check-imports, find-stale-refs, importkart, modulkart,
                      check-versjon, seed-genealogy, build-genealogy-doc, dump-genre-fixture
firestore.rules       Sikkerhetsregler for databasen
bump.sh               Setter ?v=…, importkartet og modulkartet fra js/version.js
```

Modulkartet ([MODULKART.md](MODULKART.md)) viser hver fil med tittellinjen fra
innledningen øverst i fila, og reglene koden holder seg til. Det lages av
`tools/modulkart.js` (kjøres av `./bump.sh`), og pre-push-kroken og GitHub
stopper et kart som ikke stemmer med filene, så det kan ikke gå ut på dato.

**Datamodell (Firestore):** samlingene `artists`, `config` (`teacherChecks`),
`decades`, `genreDescriptions` (nivåfeltene meta/main/sub + `story` =
sjangerhistorien), `edgeDescriptions` (koblingstekster, doc-ID `fra__til`),
`content` (innholdssider + varmekart + **`content/genealogy` = hele
sjangertreet**, ett dokument), `tech`, `podcasts` og `pendingEdits`. Alt
pensuminnhold bor i Firestore — ingen fallback-tekster i koden, og heller ingen
kopi av sjangertreet: `js/sjangre/genre-model.js` leser `content/genealogy` og avleder
vokabularet. Artistfeltene er definert i `js/data/artist-schema.js`. Bare forslag
med `status: "active"` som ikke er lærer-skjult (`priority: -1`) vises for
studenter.

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
9. Når appen ligger på en nettadresse (f.eks. GitHub Pages eller et eget
   domene), legg domenet til under **Authentication → Settings → Authorized
   domains** (f.eks. `historieappen.no`). `localhost` er godkjent fra før.

Appen er nå klar. Innhold legges inn i lærermodus eller importeres via en
innholdspakke-JSON (Innstillinger → Importer).

---

## Publisering (så klassen får en lenke)

Appen er ren HTML/JS uten byggesteg, så enhver statisk webhost funker.

**GitHub Pages:** push mappa til et GitHub-repo, gå til **Settings → Pages**,
velg `main`-branchen og rot-mappa. Du får en URL som
`https://ditt-brukernavn.github.io/repo-navn/`, eller et eget domene
(f.eks. `historieappen.no`) satt opp under **Settings → Pages → Custom
domain**. Husk å legge domenet til under Authentication → Authorized domains
(se punkt 9 over).

**Cache-busting:** ved hver endring, bump `VERSION` i `js/version.js` og kjør
`./bump.sh`. Den setter `?v=` på skript og stilark i HTML-sidene og skriver
*importkartet* (`tools/importkart.js`): én linje i hver side som gir hver modul
`?v=`. Importlinjene i `js/` står derfor uten versjon (`from "./ui.js"`), og en
ny versjon endrer bare HTML-sidene og `js/version.js`, ikke alle modulene. En
pre-push-hook (`.githooks/pre-push`, aktiveres med
`git config core.hooksPath .githooks`) nekter push hvis versjonene er i utakt,
hvis et importkart er utdatert, eller hvis en import har fått `?v=`.

---

## Klassekode (js/gate.js)

Alle fire sidene ligger bak en delt klassekode. Studenten skriver den inn én
gang per nettleser, eller åpner en lenke med koden i:
`https://historieappen.no/?kode=DEN-KODEN`. Koden fjernes fra adressefeltet
etterpå. Er koden godtatt, lagres det i `localStorage` under `pensum-klasse`.

**Hva dette er og ikke er.** Sperren holder nysgjerrige mennesker ute av
grensesnittet. Den beskytter *ikke* dataene: innholdet ligger fortsatt åpent i
Firestore (`allow read: if true`) for den som kjenner prosjekt-ID-en, og den
kan omgås av alle som kan bruke utviklerverktøy. Ekte tilgangskontroll krever
innlogging håndhevet i `firestore.rules`, eller App Check.

Sperren **feiler åpent** med vilje: `js/gate.js` legger til klassen
`pensum-locked`, og CSS skjuler innholdet av den. Lastes ikke fila, vises appen
som før. En lekkasje er å foretrekke framfor at klassen står låst ute i en time.

**Bytte kode** (generer nytt salt og hash, og øk `version` med 1 så alle må
skrive inn på nytt):

```bash
python3 - <<'EOF'
import hashlib, base64, secrets, unicodedata, re
passord = "tre-urelaterte-ord"          # ← sett inn den nye koden
norm = lambda s: re.sub(r"[^a-z0-9æøå]", "", unicodedata.normalize("NFC", s).lower())
salt = secrets.token_bytes(16)
print("salt:", base64.b64encode(salt).decode())
print("hash:", hashlib.pbkdf2_hmac("sha256", norm(passord).encode(), salt, 150000, 32).hex())
EOF
```

Lim `salt` og `hash` inn i `GATE`-objektet øverst i `js/gate.js`, øk
`GATE.version`, bump `VERSION` + kjør `./bump.sh`, og push. Hashen er offentlig
(repoet er offentlig), derfor 150 000 PBKDF2-iterasjoner — men frasen betyr
mest: bruk tre urelaterte ord, aldri et passord du bruker andre steder.

---

## Testing

- **Enhetstester** (ingen avhengigheter): `npm test` — kjører `node --test`
  på ren logikk (normalisering, diff, grenser, linkify, importformat).
- **Regeltester** (Firestore-emulator): `npm run test:rules` — krever
  `npm install` (henter `firebase-tools` og `@firebase/rules-unit-testing`)
  og Java. Verifiserer at `firestore.rules` tillater/avviser riktig.
- **Importsjekken**: `node tools/check-imports.js` finner brutte, ukjente og
  ubrukte importer, foreldreløse moduler, importringer (filer som importerer
  hverandre i ring) og videresending (en modul som eksporterer noe den selv
  har importert). Den kjører i pre-push-kroken og på GitHub sammen med
  testene.

---

## Vokabular og strukturakser

- **Sjangre og metasjangre** kommer fra sjangertreet i Firestore
  (`content/genealogy`, avledet i `js/sjangre/genre-model.js`) og redigeres av læreren
  i tre-editoren.
- **Tiår** (1900–2020) er `DECADES`-konstanten i `js/felles/limits.js`; treets egen
  akse utvides av seg selv når en sjanger settes på en ny rad.
- **Instrumenter** er `INSTRUMENT_GROUPS`/`INSTRUMENTS` i `js/felles/limits.js`
  (fast liste i koden — styrer nedtrekksmenyene i forslagsskjema og filtre).

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

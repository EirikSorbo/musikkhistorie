# Pensumforslag – Populærmusikkhistorie

En liten webapp der studentene i klassen kan foreslå artister/musikere til
pensum, legge inn relevant informasjon og musikklenker, se kjønnsfordeling, og
stemme ut forslag de mener ikke hører hjemme. Læreren har egne adminfunksjoner.

Ingen innlogging for studentene – de åpner bare lenken og bidrar.

---

## Funksjoner

- **Foreslå artist** med navn, fødselsår, kjønn, sjanger, tiår, geografi,
  begrunnelse, sentrale verk og lenker til musikkeksempler.
- **Grenser** på antall: totalt, per tiår og per sjanger. Et forslag avvises
  automatisk hvis en grense er nådd.
- **Sanntid**: alle ser nye forslag umiddelbart (Firebase Firestore).
- **Kjønnsfordeling** vist som stolpe + tall/prosent.
- **Fyllingsgrad** per tiår og sjanger.
- **Stem ut**: studenter markerer «ikke relevant». Når nok stemmer er samlet,
  fjernes forslaget automatisk.
- **Lærermodus** (Google-innlogging): veto/fjern, gjenopprett (med beskyttelse
  mot ny utstemming), slett permanent, og juster alle grenser/sjangre/tiår.

---

## Arkitektur

Tre sider med felles datalag:

```
index.html            Forside: live oversikt + inngang til student/lærer
student.html          Studentside: foreslå artist, se liste, stemme
teacher.html          Lærerside (Google-innlogging): admin, veto, grenser
css/styles.css        Styling (lyst, moderne tema)
js/
  firebase-config.js  Firebase-nøkler + lærer-e-poster  ← DU FYLLER INN
  shared.js           Delte hjelpere (oppsett-sjekk, banner)
  store.js            Datalag mot Firestore (sanntid, CRUD, stemming)
  limits.js           Grenser, standardkonfig, telling, kjønnsstatistikk
  ui.js               Rendering (rene funksjoner)
  landing.js          Forside-logikk
  student.js          Studentside-logikk (skjema, filtre, stemming)
  teacher.js          Lærerside-logikk (innlogging, admin, veto)
firestore.rules       Sikkerhetsregler for databasen
```

Alle sidene deler `store.js`, `limits.js` og `ui.js`, så datamodell og
grenselogikk finnes kun ett sted.

**Datamodell (Firestore):**

- Samling `artists` – ett dokument per forslag:
  `name, birthYear, gender, genre, decade, description, keyWorks, geography,
  links[], proposedBy, status (active|removed), removedBy, teacherProtected,
  votedOutBy[], createdAt`
- Samling `config`, dokument `settings`:
  `maxTotal, maxPerDecade, maxPerGenre, voteOutThreshold, genres[], decades[]`

Bare forslag med `status: "active"` teller mot grensene – utstemte/fjernede
frigjør plass igjen.

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

### Lærer-innlogging (Google)

6. Slå på Google-innlogging: **Build → Authentication → Get started →**
   **Sign-in method → Google → Enable**. Velg et støtte-e-postnavn og lagre.
7. Sett din lærer-e-post **to steder** (samme adresse begge steder):
   - `js/firebase-config.js` → `TEACHER_EMAILS`
   - `firestore.rules` → funksjonen `isTeacher()`
8. Legg inn sikkerhetsreglene: **Firestore → Rules**, lim inn innholdet fra
   `firestore.rules`, og trykk **Publish**.
9. Når appen ligger på en nettadresse (f.eks. GitHub Pages), legg domenet til
   under **Authentication → Settings → Authorized domains** (f.eks.
   `ditt-brukernavn.github.io`). `localhost` er godkjent fra før.

Appen er nå klar. Inntil læreren lagrer egne grenser brukes standardverdiene.

---

## Publisering (så klassen får en lenke)

Appen er ren HTML/JS uten byggesteg, så enhver statisk webhost funker.

**GitHub Pages:** push mappa til et GitHub-repo, gå til **Settings → Pages**,
velg `main`-branchen og rot-mappa. Du får en URL som
`https://ditt-brukernavn.github.io/repo-navn/`. Husk å legge dette domenet til
under Authentication → Authorized domains (se punkt 9 over).

**Firebase Hosting** (alternativ): `npm install -g firebase-tools`,
`firebase login`, `firebase init hosting` (public-mappe `.`, ikke SPA-rewrite),
`firebase deploy`.

---

## Standardgrenser (kan endres i lærermodus)

| Innstilling            | Standard |
|------------------------|----------|
| Maks totalt            | 80       |
| Maks per tiår          | 8        |
| Maks per sjanger       | 16       |
| Stemmer for utstemming | 8        |

Sjangre: Blues · Country · Jazz · Afroamerikansk populærmusikk · Elektronisk musikk
Tiår: 1900–2020

---

## Sikkerhet – det du bør vite

- Studenter trenger ikke innlogging: alle med lenken kan lese, foreslå og stemme.
- Lærerfunksjoner (veto, gjenopprett, slett, endre grenser) krever innlogging
  med en godkjent Google-konto. Sikkerheten ligger i `firestore.rules`, ikke i
  nettleseren – en student kan ikke utføre lærerhandlinger selv om de finner
  lærersiden, fordi databasen avviser det uten en godkjent konto.
- `firebaseConfig`-nøklene er ikke hemmelige (de ligger uansett i nettleseren),
  så det er trygt å legge prosjektet i et offentlig GitHub-repo.

---

## Utforske uten Firebase

Hvis `firebase-config.js` ikke er fylt ut, starter appen i **oppsettmodus**:
grensesnittet vises med standardgrenser så du kan se hvordan det ser ut, men
ingenting lagres før databasen er koblet til.

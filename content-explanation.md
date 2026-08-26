# Innholdet i pensum-appen: orientering for en språkgjennomgang

Skrevet 2026-08-26 for en modell som skal se over **språket** i appens innhold.
Dette dokumentet forklarer hva innholdet er, hvilken husstil det følger, hvilke
feller som finnes, og hvordan gjennomgangen er lagt opp sammen med læreren.

Datastrukturen i eksportfila er dokumentert separat i **`JSON-OPPSKRIFT.md`**.
Les den for feltnavn og formater. Dette dokumentet handler om teksten.

---

## 1. Hva appen er

Et pensumverktøy for **afroamerikansk populærmusikkhistorie** i norsk
videregående skole (emnet MUR114). Elevene bruker den til å utforske artister,
sjangre, tiår og teknologi. Læreren eier og redigerer alt innholdet.

**Leseren er en elev i videregående.** Det avgjør registeret: presist, men ikke
akademisk. Fagord skal forklares når de introduseres. Teksten skal være kort nok
til å leses på en skjerm ved siden av et bilde og en lytteliste.

Alt innhold er skrevet på norsk bokmål. Låt-, album- og sjangernavn står på
engelsk.

---

## 2. Hvor teksten ligger

All tekst ligger i **én JSON-eksport** (`musikkhistorie-ÅÅÅÅ-MM-DD.json`),
hentet fra lærersiden. Det er ingen tekst i koden: appen viser en
«mangler»-melding hvis et felt er tomt. Dette er et bevisst valg fra læreren.

Tekstbærende felter:

| Nøkkel | Felt med tekst |
|---|---|
| `artists[]` | `description` |
| `genreDescriptions.{meta,main,sub}` | `description`, og `story.body` på metasjangrene |
| `decades{}` | `society`, `tech`, `societyMore`, `techMore` |
| `tech[]` | `description` |
| `pages{}` | `body` |
| `edgeDescriptions{}` | `description` |

---

## 3. Innholdsoversikt

Tall fra eksporten 26. august 2026, etter at «les mer» og de gamle
backup-blokkene i tiårstekstene er ute.
**568 tekstfelt som skal gjennomgås, cirka 55 000 ord.**

| Teksttype | Antall | Lengde (median, spenn) |
|---|---|---|
| Artistkort | 234 synlige (+85 skjulte) | 453 tegn (188–637) |
| Metasjanger-beskrivelser | 8 | 1 655 tegn (54–2 300) |
| Sjanger-beskrivelser (tre-noder) | 50 | 1 081 tegn (61–2 070) |
| Undersjanger-beskrivelser | 90 | 203 tegn (137–842) |
| Sjangerhistorier | 9 | 6 340 tegn (4 284–11 231) |
| Tiår, samfunn | 13 | 704 tegn (364–1 260) |
| Tiår, teknologi | 13 | 1 125 tegn (695–1 408) |
| Innovasjonskort | 66 | 407 tegn (181–760) |
| Koblingsbeskrivelser | 82 | 618 tegn (332–852) |
| Innholdssider | 3 | lange |

De **85 skjulte artistkortene** (`priority: -1`) er en reservebenk som ikke
vises for elever. Ti av dem er merket «XX» i beskrivelsen eller i `proposedBy`,
lærerens egen markør. Fellestrekket er at de mangler lytteeksempel.

---

## 4. Husstil per teksttype

Formen varierer med teksttypen, og den er bevisst. Ikke harmoniser på tvers.

**Undersjangre, cirka 200 tegn, telegramform.** Tre ledd i fast rekkefølge:

> Hva det er, når og hvor. X, Y og Z sentrale. Kjennetegn: lyd.
>
> *Delta blues:* «En av de tidligste blues-stilene, fra Mississippi-deltaet,
> tidlig på 1900-tallet. Robert Johnson, Son House og Charlie Patton sentrale.
> Kjennetegn: slide-gitar, råstemt, intens sang og sparsomt akkompagnement.»

**Rot-noder i sjangertreet, cirka 780 tegn, fortellende.** De åtte opphavene
(Europeisk, Vestafrikansk, Hymner, Brassband, Work songs, Spirituals,
Vaudeville, Ragtime). Formen er narrativ prosa som alltid ender med hva som går
videre derfra, altså hvilke sjangre som vokser ut av roten.

**Tiårstekstene, én linje per tema.** Både `society` og `tech` er skrevet med
ett tema per linje, uten kulepunkt-tegn. Appen gjør dem om til punktliste ved
visning. Hver linje starter med subjektet, har konkrete forankringer (årstall,
modellnavn, personer) og ender i en konsekvens. 5 til 8 linjer per felt.

Ett unntak: **1910 har bare fire linjer**, fordi originalteksten bare hadde fire
temaer. Det er bevisst, og skal ikke fylles ut med oppdiktet stoff.

**Artistkort, cirka 450 tegn.** Hvem det er, gjennombruddet, hva som kjennetegner
uttrykket, og betydningen. Titler i anførselstegn med årstall i parentes.

**Sjangerhistoriene, 4 000 til 11 000 tegn.** Ni lange fortellinger med
mellomtitler (`### `). Egen sjanger, mer sammenhengende essayform.

---

## 5. Språkkonvensjoner (vedtatt av læreren)

Disse er avgjort og skal håndheves.

**Anførselstegn mot kursiv.** Vedtatt 2026-08-26:

| Kategori | Form | Eksempel |
|---|---|---|
| Album-, låt- og boktitler | `«…»` | «Kind of Blue» |
| Kallenavn inne i fullt navn | `«…»` | Chester «Howlin' Wolf» Burnett |
| Ord omtalt som ord | `«…»` | Begrepet «jazz» dukket opp rundt 1915 |
| Fagord som introduseres | `*kursiv*` | *old school*, *acid house*, *ska* |
| Utheving og trykk | `*kursiv*` | vi skal *ikke* bare lære om dem |
| Navn på folk, band, klubber, sjangre | ingen | Miles Davis, Jazz Messengers |

Skilletegn står **utenfor** anførselstegnet når det ikke er del av det siterte:
`«country blues».` Unntak der tegnet hører til tittelen: `«DAMN.»`

**Skrivemåter.**

- `hip-hop`. Bøyning henger direkte på (`hip-hopens`, `hip-hopere`), sammensetning
  får egen bindestrek (`hip-hop-kulturen`). Aldri «hiphop» eller «hip hop».
- `1960-tallet`, aldri «1960-tall» eller «60-tallet». «tidlig på 1900-tallet»,
  «midten av 1970-tallet», «sent på 1960- og 1970-tallet».
- `saksofon`, ikke «saxofon».
- Norske anførselstegn `« »`, aldri `" "` eller `" "`.

**Forbudt.**

- **Tankestrek omgitt av mellomrom.** Løs det ved å skrive om setningen, ikke
  ved å bytte tegn. Dette er et uttrykkelig krav fra læreren.
- **Emoji.** Ikoner i grensesnittet skal være SVG, og emoji hører ikke hjemme i
  brødteksten.

**Artistnavn i løpende tekst må stemme med kortet de lenker til.** Appen
auto-lenker på eksakt navn. Skriv `NAS`, ikke «Nas». `Notorious B.I.G.`, ikke
«The Notorious B.I.G.». `Charlie Patton`, ikke «Charley». `2Pac`, ikke «Tupac».
`Hedvig Mollestad`, ikke «Hedvig Mollestad Trio».

**Markup.** Markdown-light: `**fet**`, `*kursiv*`, `### Mellomtittel`,
`[tekst](url)`, punktlister. Se `JSON-OPPSKRIFT.md` for mekanikken.

---

## 6. Fem feller

**1. Appen auto-lenker navn, også inni formatering.** Artist-, sjanger- og
teknologinavn blir klikkbare av seg selv i all løpende tekst, og lenkingen virker
også inne i `«…»` og `*kursiv*`. Det betyr:

- Ikke formater et navn manuelt. Lenken er markeringen.
- «Dobbeltmerking» er ikke automatisk en feil. `«hillbilly»` er riktig når ordet
  omtales som datidens bransjemerkelapp.
- **Les alltid i kontekst før du fjerner formatering.** Under en tidligere
  gjennomgang ble 38 slike foreslått strippet maskinelt. Det var galt: de var
  albumtitler som kolliderer med nodenavn («Free Jazz» er Ornette Colemans album
  fra 1960), kallenavn, eller ord omtalt som ord.

**2. Kjent defekt, ikke løst.** Fire lenker peker til feil kort fordi en
albumtittel heter det samme som en node. «Free Jazz» sender eleven til sjangeren
Free jazz, «Memphis Blues» til undersjangeren. Kan bare løses i koden.

**3. `grep` er upålitelig i dette repoet.** Flere kildefiler leses som binære og
hoppes over stille. Bruk `grep -I`, `tools/check-imports.js` og
`tools/find-stale-refs.js`.

**4. Importen kan ikke tømme et felt, og kan ikke slette.** Fletting hopper over
importerte verdier som er tomme, og sjangerbeskrivelser har ingen slett-knapp.
Se `pensum-import-begrensninger` i lærerens notater. Praktisk følge: endringer
som fjerner innhold må gjøres for hånd i appen eller i Firebase Console.

**5. Noen avvik er bevisste.** Ikke «rett» disse:

- `Early hip-hop` har epoketekst «ca. 1979» mot startår 1973, og `EDM` har
  «2010-tallet» mot 2008. Begge er vurdert og beholdt.
- Varme i varmekartet før sjangeren oppsto hos Swing, Elektronika og Cont. R&B er
  vedtatte «forløpere».
- `Bluegrass` som undersjanger-tagg hos Alison Krauss, Gillian Welch og Dixie
  Chicks er villet, selv om navnet også er en tre-sjanger.
- Ti sjangre uten sluttår betyr «fortsatt aktiv», ikke manglende data.
- Seks undersjanger-beskrivelser uten artister er rot-noder i treet og skal stå.

---

## 7. Slik er gjennomgangen lagt opp

Læreren har ett ufravikelig krav: **ingenting endres på eget initiativ.** Modellen
forbereder underlaget, læreren avgjør, og først da lages importfila.

Arbeidsflyten som har fungert:

**Steg 1: mål, ikke gjett.** Kjør en deterministisk analyse over eksportfila
først, med node-skript. Tell forekomster, finn avvik, sammenlign mot
sjangertreet. Legg aldri fram en plan bygget på antakelser. Flere ganger har
tallene vist at problemet var mindre eller helt annerledes enn det så ut.

**Steg 2: skill mekanisk fra skjønn.** Tre bøtter:

- *Mekanisk*: deterministisk, null tolkning. Gale anførselstegn, feilstavinger,
  navn som ikke matcher. Legges fram samlet.
- *Kildesjekkbart*: krever oppslag mot kildehierarkiet (SNL → Britannica → LoC
  → Grove → Wikipedia). Legges fram som forslag med kilder.
- *Lærerens skjønn*: pedagogiske valg. Legges fram som få, skarpe spørsmål.

**Steg 3: gjør N saker om til ett valg der en regel gjelder.** 104 varmeceller
ble til ett spørsmål om semantikk. 41 kursiverte titler ble til ett valg. Det er
forskjellen på en gjennomgang som lar seg fullføre og en som ikke gjør det.

**Steg 4: la agenter forberede, med motprøve.** Forslag hentes av parallelle
agenter, og hvert forslag går gjennom en skeptisk kontrollør før det vises.
Motprøven har luket ut mye: 22 av 48 artistforslag, halvparten av
lytteeksemplene, og tillagte fakta i 8 av 12 tiårstekster.

**Steg 5: widget for beslutningene.** Hver sak legges fram i en interaktiv
widget med:

- **saken selv**, med det som trengs for å avgjøre den (kontekst, tidslinje,
  hvilke artister som er berørt)
- **en anbefaling**, merket «(anbefalt)», med begrunnelse
- **motprøvens innsigelse**, når den finnes, i egen ramme
- **to til tre knapper** per sak, og en «Godta alle forslag»-knapp
- **en teller** og en «Send avgjørelser»-knapp som sender valgene tilbake i chat
  via `sendPrompt`

Saker som allerede er riktige, tas ut av widgeten og nevnes i en grønn merknad
over, slik at læreren ikke bruker tid på dem.

**Steg 6: importfil, aldri direkte skriving.** Modellen skriver aldri til
databasen. Den lager en JSON-fil, viser før og etter for hver endring, og
læreren importerer selv med «Flett», som gir en konfliktdialog per felt.

**Steg 7: verifiser mot fersk eksport.** Etter import: be om ny eksport og kjør
kontrollskriptet. En tidligere runde ble verifisert med 42 sjekker, der én
avdekket at en endring ikke hadde gått gjennom flettedialogen.

**Viktig om rekkefølge:** når læreren har importert noe og tatt ny eksport, er
alle tidligere genererte filer utdaterte. Regn dem på nytt mot den ferskeste
eksporten, ellers ruller de tilbake arbeid som alt er gjort.

---

## 8. Hva som nylig er gjennomgått

Ikke gjør om igjen dette. Alt er avgjort av læreren og importert.

- **Undersjanger-beskrivelsene** er gjennomgått av en språkvask: 16 prosatekster
  skrevet om til telegramform, fem faktafeil rettet (blant annet Urban
  contemporary gospel datert 20 år for sent), og seks regelendringer gjennomført.
- **Formateringen** er samlet: 145 endringer der gale anførselstegn ble rettet,
  41 kursiverte titler ble til «…», og hip-hop-skrivemåten ble normalisert i hele
  appen.
- **De fire rot-nodene** Europeisk, Vestafrikansk, Work songs og Spirituals fikk
  prosa for første gang.
- **Samfunnstekstene i tiårene** er skrevet om til punktform, med faktakontroll
  som fjernet tillagte påstander i åtte av tolv utkast.
- **Backup-blokkene** i teknologitekstene er slettet, etter at ti opplysninger
  som bare fantes der ble berget inn i den aktive teksten.
- **Sjangerårstall** er kildesjekket for elleve sjangre.

---

## 9. Hva som gjenstår språklig

- **De 216 uttrykkene i `«…»` med liten forbokstav** må vurderes én for én som
  fagterm (blir kursiv), kallenavn eller sitat (blir stående). Ikke påbegynt.
- **Tretten opplysninger** fra de slettede backup-blokkene i tiårstekstene er
  vurdert som «kan vurderes» og ikke tatt inn. Blant dem: AM og FM skrevet ut,
  at vinylen også var billigere enn skjellakk, og oppfinnelsesårene for Fender
  Rhodes (1942) og Wurlitzer (1939).
- **Fire sjangre uten lytteeksempel**: Rock, Pop, New jack swing og Cont. R&B.
- **Fem funksjoner er midlertidig skjult** i elevvisningen fram til innholdet er
  kvalitetssikret, styrt fra `js/feature-flags.js`. Se filas egen kommentar.

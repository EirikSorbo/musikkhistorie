# Prosjektdokumentasjon: pensum-appen

Skrevet 2026-08-28. Dette dokumentet er den samlede historien om arbeidet med
pensum-appen (historieappen.no) fra første commit 12. juni 2026 til lanseringen
27. august, med fasene, valgene og begrunnelsene. Det er skrevet for en som
skal overta eller forstå prosjektet, og supplerer `README.md` (arkitekturen i
dag), `HANDOVER.md` (teknisk status per 22. august) og `content-explanation.md`
(innholdet og husstilen).

**Kildegrunnlag og metode.** Dokumentet bygger på fire kilder: 30 lesbare
økt-transkripter (5. juli til 26. august), git-historikken (477 commits per
28. august), 57 minnefiler om prosjektet, og repo-dokumentene. Transkriptene er
lest av agenter og deretter motprøvd av uavhengige kontrollører som sjekket
sitater og attribusjon mot kildene. De 33 tidligste øktene (12. juni til
14. juli) har ikke transkript. Den perioden er **rekonstruert** fra
commit-meldinger, minnefiler og økt-titler, og avsnittene om den skiller
mellom hva som er lest (commits, daterte minnenotater) og hva som er utledet
(motivasjon, samtaleforløp). Der dokumentet sier «læreren bestemte», finnes
det belegg i transkript eller minnefil; der det står «commitene tyder på»,
er det en tolkning.

---

## Hva appen er

Et pensumverktøy for afroamerikansk populærmusikkhistorie i emnet MUR114
(musikkhistorie, første år bachelor i utøvende musikk, rundt 50 studenter).
Læreren eier og redigerer alt innholdet; klassen utforsker det og kan justere
det ved å foreslå artister, foreslå endringer og stemme frem det viktigste.
Teknisk: fire HTML-sider med vanilla JS uten byggesteg, Firebase Firestore som
database, Google-innlogging kun for lærer, anonym innlogging som
stemme-identitet for studentene, GitHub Pages bak eget domene.

Innholdet per lansering: 319 artistkort (234 synlige, 85 i reserve), et
sjangertre med 54 noder (46 sjangre og 8 røtter) i 9 metasjangre, rundt 90
undersjangre, 9 sjangerhistorier, 82 koblingsbeskrivelser, 66 innovasjonskort,
13 tiår med samfunns- og teknologitekster, 175 lytteeksempler og en
autogenerert referanseoversikt. Rundt 568 tekstfelt, cirka 55 000 ord, alt i
Firestore og ingenting i koden.

---

## Kronologien

### Fase 1: Grunnleggingen (12. juni til 14. juli, 320 commits)

*Denne fasen er rekonstruert fra git og minnefiler; transkripter finnes ikke.*

Appen startet 12. juni som en **forslags-app**: Firebase, Google-innlogging
for lærer, grenser per tiår og sjanger. Versjonsnummereringen begynte på v1.00
den 16. juni, en dag med 30 commits (innstillinger, import og eksport med
konfliktløsning, tiårs- og undersjangerbeskrivelser).

Den 17. juni kom vendepunktet: minnefilene dokumenterer at MUR114-kompendiet
ble gjennomgått i økt samme dag og at en prioritert liste med pedagogiske
tiltak ble avtalt. Samme dag kom **slektstreet** (v1.39), raskt omgjort til
musicmap-inspirert kart med pan og zoom (v1.40). Uken etter fulgte
godkjenningsflyten for studentforslag (v1.69), konteksten delt i Samfunn og
Teknologi (v1.70), teknologikortene (v1.78) og linkify-systemet som gjør
artist-, sjanger- og teknologinavn klikkbare i all løpende tekst (v1.84 til
v1.90).

Slutten av juni var rydding: 27. juni ble sjangerbegrepene omdøpt
(genre til metaGenre, sjangre til mainGenre, undersjangre til subGenre) med
treet som sannhetskilde, samtidig med en systematisk kodeopprydding
(cache-busting med `bump.sh`, dedup, modulsplitting). Varmekartet kom samme
dag. Den 29. juni ble sjangerbeskrivelsene nivådelte, og et brukerkrav som
skulle prege hele appen ble nedfelt: **ingen innebygde standardtekster**.
Mangler et felt, skal appen si det, ikke skjule det. Begrunnelsen i
minnefilene: standardtekster skjuler at en sjanger ikke er synkronisert.

Juli åpnet med robusthet: anonym innlogging som stemme-identitet med
uid-håndhevede regler (v2.74), og 3. juli en full multi-agent
arkitektur-gjennomgang (62 funn) som ble lukket i fikspakker over de neste
dagene. Parallelt kom de store visualiseringene: tidslinjen (v2.80, en pakket
bane-tidslinje der åpne ender vises ærlig fordi 45 prosent av artistene
manglet sluttår), geografikartet (v2.81, senere fjernet), hubkortet «Det store
bildet» (4. juli) og Sjangerhimmelen (v2.88 til v2.94), der det første
force-baserte ringkartet ble forkastet som uleselig og stjernekartet i
slektstreets rekkefølge var lærerens eget forslag. En pedagogisk
potensial-analyse 7. til 8. juli konkluderte med at visualiseringslaget var
modent, men studentsløyfen passiv, og læreren bestilte tre av potensialene
(beslektede artister, lytteanvisning, Røtter-fortellingen, v2.95).

Fasen sluttet med innholdsuka: seks sjangerhistorier (v2.97), og 13. juli det
arkitektoniske veiskillet **v3.3: alt pensuminnhold ut av koden, Firestore er
kilden**. Kravet er dokumentert ordrett i minnefilene: læreren ville ikke
lures av utdatert tekst til å tro at det er innhold der. Samme dag kom
pensum-oversikten (form, hull, mangler), Skrivebord-panelet og de klikkbare
koblingene i slektstreet med egne koblingsbeskrivelser.

### Fase 2: Struktur og systematikk (14. til 19. juli)

Herfra finnes transkripter, og bildet blir skarpere.

Arkitektur-gjennomgangen 15. juli var bestilt med et klart mål: «Jeg må vite
at designet fungerer godt, er stabilt og solid, og vil tåle aktiv bruk av ~50
personer.» Den ga 40 unike funn som ble lukket i tre versjoner (v3.50 til
v3.52). To ting ble bevisst utsatt av læreren: tiårs-semantikken (fordi en
«tell frem til i dag»-regel ville blandet aktive artister og historiske
pionerer der data bare mangler) og full omstrukturering. Lærerens egen idé om
femårsrader i treet ble forkastet etter analyse: halvparten av nodene har bare
tiårspresisjon, og et finere rutenett ville funnet på en presisjon dataene
ikke har. Oppdelingen av `explore.js` ble planlagt her og gjennomført i et
annet kontekstvindu, med et overleveringsprompt som arbeidsform.

Den 18. juli identifiserte læreren selv et strukturproblem: spillelister
generert per artist blir misvisende for flersjanger-artister (Miles
Davis-eksempelet). Løsningen ble sjangerknytning per lytteeksempel (v3.64),
der læreren tok alle 87 valgene i en widget, og deretter den viktigste
beslutningen: **spillelister skal kun inneholde lytteeksempler** (v3.65),
som gjorde en planlagt tagging av 267 sentrale verk overflødig. Samme økt ble
instrumentvokabularet flyttet fra konfigurasjon til en fast konstant i koden
(v3.68) etter at tellingen avdekket to generasjoner vokabular om hverandre.

Den 19. juli startet den systematiske innholdsgjennomgangen: faktasjekk av
alle 295 artistbeskrivelser med 15 parallelle agenter (98 funn på 85
artister), godkjenningswidget for jazz og blues, full årstallssjekk der
læreren konsekvent valgte tidligere sluttår enn agentene foreslo, og
opprettelsen av loggen `Pensumgjennomgang.md`. Et nesten-uhell satte spor:
en importfil bygget på en eksport fra før samme dags instrument-migrering
ville ha reversert den, og appens egen import-advarsel fanget det. Regelen
ble at korreksjonsfiler alltid bygges på sist importerte tilstand.

### Fase 3: Kildesjekk-fabrikken (20. juli til 4. august)

Jazz ble pilot for den store kildesjekken: alle 87 jazz-artister mot
hierarkiet SNL, Britannica, Wikipedia, med to agenter per artist (faktasjekker
pluss skeptisk kontrollør), 174 agenter over fire gjenopptakinger. Rundens
viktigste funn var **Britannica-403-fella**: agentene fikk 403 fra
britannica.com og fjernet kilden for 54 artister i strid med hierarkiet, men
alle lenkene viste seg å virke i nettleser. Alt ble reversert, og
forhåndsverifisering i nettleser ble bygget inn i den gjenbrukbare oppskriften
læreren bestilte («Oppskrift Pensum-gjennomgang», med skriptene i
`pensum-gjennomgang/`). Læreren overprøvde modellen på faglig grunnlag der det
trengtes, som da utdanningspåstanden om Arild Andersen manglet kildedekning:
«Jeg kjenner til Arild Andersen og vet at han er viktig i utdanning.»

Deretter rullet oppskriften: Country (51 artister, én ren kjøring), R&B (86),
Klubbmusikk (25) og Gospel (10). Til sammen ble alle 319 artister
kildesjekket, med SNL øverst. Parallelt kjørte **sjangergjennomgangen** av
node-beskrivelsene mot SNL, Britannica og Grove, der kildehierarkiet ble
utvidet til sju nivåer (vedtatt av læreren som flat prioritetsliste), Grove
kom inn som 29 PDF-er hentet via UiA-abonnementet da netttilgangen falt bort,
og AllMusic ble bannlyst. Et prinsipielt øyeblikk: modellen strøk setningen om
at hard bop-navnet er misvisende som udokumentert, læreren krevde den tilbake
som pedagogisk poeng, og Grove viste seg senere å belegge den fullt ut.

### Fase 4: Utvidelse og omorganisering (1. til 19. august)

August åpnet med to strukturgrep læreren hadde eid lenge: begrepet
«hovedsjanger» ble utryddet til fordel for «metasjanger» i hele appen (v3.72),
og **hip-hop ble skilt ut fra R&B som egen metasjanger** (v3.88). Det siste
var lærerens egen vurdering som modellen tiltrådte: 35 av 79 R&B-artister
hadde en hip-hop-sjanger, og etiketten «R&B» på N.W.A og Kendrick Lamar var
en påstand ingen kilde støtter. R&B-historien ble delt i to, og fargekartet
lagt om (lærerens forslag om oransje til hip-hop ble forkastet fordi Country
eier den varme sonen; Gospel endte på oliven etter at burgunder leste som
svart i treet).

Videre i første halvdel av august: metasjangrene fikk pedagogisk rekkefølge i
tidslinje og varmekart, varmekartet ble glidende, treet ble slanket og
koblingene gjennomgått med lærerens kriterium om at hver kobling må ha reell
innvirkning, ikke flest mulig. Rock og Pop ble bevisst ikke bygget ut: «Rock
og pop er utenfor pensum […] jeg vil at de skal vises, men bare for å
poengtere at det er "noe" der.» En teknisk audit 5. august (v4.18 til v4.23)
fjernet 700 linjer utførte engangsmigreringer, la størrelsestak i
Firestore-reglene og fjernet all bakoverkompatibilitet, med den dokumenterte
konsekvensen at gamle backup-filer ikke lenger kan importeres. Alle
lytteeksempler ble retagget mot det nye sjangertreet i to widget-runder.

Den 17. til 18. august flyttet appen til eget domene: **historieappen.no**,
registrert av læreren, DNS satt opp i cPanel med skjermbildeguiding, og
GitHub Pages beholdt som vertskap etter at en adversarial evaluering (Fable
satt til å ettergå Sonnets råd) viste at Firebase Hosting-migrering ikke ville
løst noe: appen har ingen byggesteg, så koden er uansett lesbar. Appen ble
holdt ute av søk og KI-crawling (robots.txt pluss noindex), API-nøkkelen
strammet til 9 API-er (aldri referrer-restriksjoner, som ville låst ute
lærer-innloggingen), og en **klassekode** lagt foran appen (v4.35). Koden
sperrer nysgjerrige mennesker ute av grensesnittet, beskytter ikke dataene,
og feiler med vilje åpent: en lekkasje er å foretrekke fremfor at klassen står
låst ute. En robusthetsgjennomgang (v4.37) viste at lesekvoten på 50 000
dokumentlesninger per dag er den eneste reelle grensen, med cirka 1,25 ganger
headroom for normal klassebruk; Blaze-oppgradering ble bevisst utsatt til
konsollen viser reell bruk. Samme uke fikk treet New jack swing-noden, alle
beskrivelser fikk markdown-light-formatering (v4.32), tre noder byttet navn
(Hip-hop til Early hip-hop, Gullalder til Hip-hop, Country til Hillbilly,
v4.38), og Referanser-kortet erstattet geografikartet i huben (v4.39 til
v4.43), autogenerert fra kildedataene med kategorier og innganger tilbake til
kortene.

### Fase 5: Dynamiske sjangre (20. til 22. august)

Den siste store ombyggingen startet med lærerens misnøye: «Jeg syns
pensum-appen sitt slektstre fungerer ganske dårlig visuelt. Det er på en måte
hjertet av hele opplegget.» Etter skisser og en PDF-sammenligning med ekte
data valgte læreren **bundlede bånd** fremfor modellens anbefalte
metrolinjer, med en presis begrunnelse: sammensmeltninger som R&B (blues,
jazz og gospel) skal lese som likestilte foreldre, ikke annekteres av én
familie.

Samtidig reiste læreren det strategiske spørsmålet: kan sjangrene bli
lærer-redigerbare i stedet for kodet? «Hvis dette gjør at vi må dypt ned i
appens arkitektur, så er nok dette tidspunktet å gjøre det på.» Fem
beslutninger ble låst: bundlede bånd er treet; studenter kan ikke foreslå
strukturendringer; fargen eies av metasjangeren med unntak per node; sletting
blokkeres så lenge noe peker på sjangeren; ambisjonen er samme app med annet
innhold, ikke en flerfagsplattform. Gjennomføringen tok fire faser (v4.48 til
v4.64): avledningene samlet bak én fasade, treet flyttet til
`content/genealogy` i Firestore, bundlede bånd som eneste kart med utregnede
kolonner, og en lærer-editor der identitetsbytter (navn og sletting) alltid
går via en plan som utføres atomisk, fordi en etikett er identitet sju steder
i datamodellen. Underveis ble én delt datarot innført (`js/shared-data.js`),
og seks reelle feil funnet og fikset, blant dem kameralyttere som hopet seg
opp ved omtegning og en lærerside som døde stille fordi en import manglet.
En avsluttende gjennomgang 22. august med 127 verifiserte funn (v4.65 til
v4.69) lukket løpet; læreren kjørte selv det første ekte navnebyttet mot
live-basen og bekreftet at maskineriet virket.

### Fase 6: Kvalitetssikring og lansering (25. til 27. august)

Med lanseringen ett døgn unna ble innholdet kvalitetssikret i sju pakker med
widget-avgjørelser: hip-hop-motsigelser, varmekart-semantikk (vedtak:
ettervirkning teller), sjangerårstall mot kildene, undersjanger-kollisjoner,
foreldreløse beskrivelser (18 slettet i Firebase Console, siden import ikke
kan slette), og lytteeksempler, der læreren forkastet hele forslagsleveransen:
«Ikke gjør noe med lytteeksemplene, her var det mye rart som var foreslått.»
I tillegg: språkvask av undersjanger-beskrivelsene til telegramform (fem
faktafeil rettet), en formateringskonvensjon for hele appen (anførselstegn
for det som heter noe, kursiv for ord brukt som ord, vedtatt etter tre
fremlagte alternativer), samfunnstekstene i punktform med faktakontroll som
strøk tillagte påstander i åtte av tolv utkast, og prosa for de fire siste
rot-nodene.

Lanseringsbeslutningen: appen ble lansert 27. august, med **fem funksjoner
midlertidig skjult** i studentvisningen til innholdet er kvalitetssikret
(viktighetsgrad, koblingsbeskrivelser, metasjangerhistorier, «Det store
bildet»-kortet og «Hør etter»-kortene), styrt fra `js/feature-flags.js` uten
at kode ble fjernet.

### Fase 7: Etter lansering (27. og 28. august)

*Kun fra git-loggen; ingen transkripter er lest for denne perioden.*
Commitene viser småforbedringer i høyt tempo: skjuling av instrumenter uten
artister (v4.80), retting av en telling som leste metasjangeren i stedet for
treets sjanger (v4.81), artistens egen tidslinje på kortet (v4.84),
viktighetsgrad i lærer-oversikten (v4.87 til v4.89), rot-sjangre som bobler i
Røtter-kortet (v4.90 til v4.91), søk i alt innhold (v4.92) og sletting av
«les mer»-rester (v4.93 til v4.94).

---

## Bærende valg, samlet

Disse valgene er dokumentert med begrunnelse i transkripter eller minnefiler,
og forklarer hvorfor appen er som den er:

- **Alt innhold i Firestore, ingen reservetekster i koden.** Appen viser
  «mangler»-melding i stedet. Lærerens krav: utdatert tekst i koden lurer
  en til å tro at innholdet finnes.
- **Sjangertreet er sannhetskilden** for gyldige sjangre og metasjangre, og
  bor siden august i databasen, redigerbart av lærer uten utvikler.
- **Modellen skriver aldri til databasen.** All endring går via importfiler
  som læreren selv importerer med fletting og konfliktdialog, eller via
  migreringer læreren utløser innlogget. Fletting kan aldri tømme et felt,
  og import kan ikke slette; sletting skjer manuelt.
- **Spillelister er lytteeksempler**, ikke sentrale verk. Verkene bor på
  artistkortet.
- **Rock og Pop vises, men bygges ikke ut**: de markerer at det finnes noe
  utenfor pensumet.
- **Klassekoden feiler åpent** og er en sosial sperre, ikke en teknisk;
  ekte tilgangskontroll krever App Check eller innlogging.
- **GitHub Pages fremfor Firebase Hosting**: uten byggesteg er koden uansett
  offentlig, og push-er-live-flyten er verdt mer.
- **Ingen tankestrek omgitt av mellomrom, ingen emoji, norske anførselstegn**
  i all apptekst; formateringskonvensjonen av 26. august styrer titler mot
  fagtermer.

## Status og åpne punkter (per 28. august)

Appen er lansert og i drift på historieappen.no med klassekode. Testene står
grønne (267 per v4.81). Viktigste gjenstående, i fallende størrelse:

1. **App Check.** Firestore står på `allow read: if true`; REST-skraping er
   mulig. Bør på plass før appen deles bredere. Detaljene står i minnet og i
   `HANDOVER.md`.
2. **De fem skjulte funksjonene** skal slås på igjen etter kvalitetssikring
   (`js/feature-flags.js`).
3. **«Hør etter»-beslutningen**: feltet på musikkeksempler redigeres, men
   vises ikke; gjeninnfør visningen eller fjern feltet (se
   `HOR-ETTER-PROMPT.md`).
4. **Språklig restanse**: 216 uttrykk i anførselstegn med liten forbokstav
   skal vurderes én for én; fire autolenker peker på feil kort
   (tittel/node-kollisjoner som «Free Jazz») og kan bare løses i koden.
5. **Innholdshull**: sjangre uten lytteeksempel (Rock, Pop, New jack swing,
   Cont. R&B), 13 «kan vurderes»-opplysninger fra de slettede
   backup-blokkene, og 65 av 66 innovasjonskort uten kilde.

## Kilder for dette dokumentet

- Arbeidsmappen `../pensum-sammendrag-arbeid/` (utenfor repoet): forbehandlede
  transkripter av alle 30 økter, verifiserte øktnotater per gruppe,
  juni-rekonstruksjonen og git-loggen. `SAMMENDRAG-OPPSKRIFT.md` i repoet
  beskriver metoden.
- `README.md`, `HANDOVER.md`, `content-explanation.md`,
  `PEDAGOGISKE-POTENSIALER.md`, `JSON-OPPSKRIFT.md` i repoet.
- Minnefilene i Claude-prosjektmappen (57 om pensum-appen).

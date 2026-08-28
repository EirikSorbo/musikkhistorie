# Refleksjonsnotat: å bygge et pensum med en språkmodell

Skrevet 2026-08-28. Dette notatet handler ikke om appen, men om arbeidsmåten:
hva som fungerte i samspillet mellom en lærer og en språkmodell gjennom elleve
uker, hva som ikke gjorde det, og hvilke vaner som vokste frem. Grunnlaget er
de 30 økt-transkriptene fra 5. juli til 26. august, lest og deretter motprøvd
av uavhengige kontrollører, pluss git-historikken og minnefilene. Sitatene er
ordrette fra øktene.

---

## Det bærende prinsippet: ingenting endres på eget initiativ

Den ene regelen som preger hele materialet, er at modellen aldri fikk endre
innhold på egen hånd. Formuleringene går igjen fra første til siste økt:
«Ikke gjør noe før du har konferert med meg.» «Ikke endre noe enda.» «Kom med
forslag og plan, ikke gjør noe på eget initiativ.» Modellen forbereder
underlaget, læreren avgjør, og først da lages en importfil som læreren selv
importerer. Modellen har aldri skrevet direkte til databasen.

Det låter tungvint, men transkriptene viser hvorfor det var riktig. Da
modellen la frem 48 forslag til artist-tagger, forkastet motprøven 22 av dem.
Da tolv tiårstekster ble skrevet om til punktform, hadde agentene lagt til
egne tolkningsfraser i åtte av dem. Og da en hel leveranse med
lytteeksempel-forslag kom til godkjenning, avviste læreren alt: «Ikke gjør
noe med lytteeksemplene, her var det mye rart som var foreslått.» Ingenting
av dette nådde appen, fordi porten var stengt til læreren åpnet den.

## Widgeten: beslutningsflyten som gjorde omfanget håndterbart

Arbeidsformen som vokste frem for alle store gjennomganger, var en interaktiv
widget der hver sak vises med anbefaling, begrunnelse og to til tre knapper,
pluss en samleknapp og delinnsending. Opphavet var praktisk: etter at valg
hadde gått tapt ved maskin- og chatbytte, kom kravet «jeg må vite at jeg ikke
risikerer å miste det jeg har gjort», og delinnsending med varig lagring ble
standard. Formen ble så gjenbrukt for alt: 87 sjangervalg for lytteeksempler,
81 kildesjekk-avgjørelser for jazz, 25 faktarettelser for jazz og blues,
sju innholdspakker før lansering.

To grep gjorde flyten effektiv. Det første var å måle før man mener: hver
gjennomgang startet med deterministiske skript over dataene, ikke med
antakelser, og flere ganger viste tallene at problemet var mindre eller
annerledes enn det så ut. Det andre var å gjøre mange saker om til ett valg
der en regel gjelder: 104 varmekart-celler ble til ett spørsmål om semantikk
(«teller ettervirkning?»), 41 kursiverte titler ble til ett konvensjonsvalg.
Det er forskjellen på en gjennomgang som lar seg fullføre og en som ikke gjør
det.

## Motprøven: agenter pynter på fakta

Den viktigste enkeltlærdommen i materialet er at agent-leveranser må
etterprøves av en uavhengig kontrollør før de vises frem. Ikke fordi agentene
er slurvete i liten skala, men fordi de systematisk gjør materialet penere
enn det er: parafraser blir til sitater, hull fylles med rimelige antakelser,
og forslag fremstilles med større sikkerhet enn kildene bærer.

Eksemplene er mange og konkrete. I jazz-kildesjekken fjernet agentene
Britannica som kilde for 54 av 87 artister fordi nettstedet ga dem
feilkode 403; lenkene virket utmerket i nettleser, og alt måtte reverseres.
I samfunnstekstene la agentene til påstander ingen kilde dekket. Og da dette
sammendraget selv ble laget, fant kontrollørene samme mønster i lesenotatene:
sitater var nesten alltid ordrette, men attribusjonen gled. Beslutninger
modellen hadde foreslått og læreren bare godkjent, sto som «læreren
bestemte», og ett sted var det motsatt: et krav læreren selv hadde stilt, sto
som modellens designvalg. Skal et slikt materiale brukes til noe, må skillet
mellom hvem som sa hva holdes med makt.

Motprøven ble derfor institusjon: i kildesjekk-oppskriften har hver artist en
faktasjekker og en skeptisk kontrollør som aktivt prøver å tilbakevise
forslagene. Og læreren brukte samme grep på modellene selv, ved å sette én
modell til å ettergå en annens konklusjoner: «Fable, ta en grundig evaluering
av det sonnet har kommet frem til over. Er du enig?» Den evalueringen veltet
et migreringråd som ville kostet arbeid uten å løse noe.

## Domenekunnskapen trumfer kildene

Kildehierarkiet (SNL, Britannica, Library of Congress, Grove, Wikipedia) var
lærerens vedtak og modellens verktøy, men det avgjorde aldri alene. To
episoder viser rangordningen. Da agentene ikke fant kildedekning for at Arild
Andersen er viktig i jazzutdanning, overprøvde læreren: «Jeg kjenner til
Arild Andersen og vet at han er viktig i utdanning. Ikke endre
description-teksten, men behold de kildene du foreslår.» Og da modellen strøk
setningen om at hard bop-navnet er misvisende, krevde læreren den tilbake som
pedagogisk poeng; Grove viste seg senere å belegge den fullt ut. Lærdommen
modellen noterte: prøv begge lesninger før du foreslår å stryke en setning.

Samme mønster i det redaksjonelle: læreren daterte grupper etter storhetstid
snarere enn formell oppløsning, holdt Rock og Pop bevisst utenfor pensumet,
og valgte bundlede bånd i slektstreet mot modellens anbefaling, med en
begrunnelse modellen ikke hadde vektet like tungt: sammensmeltninger skal
lese som likestilte foreldre.

## Det som ikke fungerte, og hva det lærte oss

**Verktøyene lyver av og til.** `grep` hopper stille over filer den leser som
binære, og «ingen treff» betydde to ganger at en feil fikk leve til den smalt
i nettleseren; svaret ble egne kontrollskript. En importsjekk som blanket
strenger feil, erklærte fem moduler ubrukte som var i høyst levende bruk;
hadde noen ryddet etter listen, ville fem filer brutt. Nettleserpanelet når
den ekte databasen, noe som ble oppdaget da et testforslag dukket opp i
lærerens innboks. Og et skript som krasjer etter endringen, men før
skrivingen, melder gjerne «OK» likevel; regelen ble at ingenting er gjort før
fila beviselig er skrevet.

**Import er farligere enn det ser ut.** Fletting kan aldri tømme et felt,
import kan ikke slette, og en importfil bygget på en gammel eksport ruller
stille tilbake alt som er gjort siden. Nesten-uhellet 19. juli (en
faktarettelsesfil som ville reversert samme dags instrument-migrering) og
Dorsey-kollisjonen mellom to overlappende filer ga reglene som siden holdt:
bygg alltid på sist importerte tilstand, lag aldri to filer som overlapper,
og slett importfiler etter bruk, for «en importert fil er en ladd felle».

**Grensene er en del av arbeidsvilkårene.** Økt- og ukegrenser drepte
agentkjøringer midt i arbeidet gjentatte ganger; jazz-runden trengte fire
gjenopptakinger over et døgn. Mottiltakene ble delinnsending i widgetene,
resultater skrevet til disk fortløpende, gjenbrukbare oppskrifter som et nytt
kontekstvindu kan plukke opp, og handover-dokumenter ved kontekstbytte.
Læreren styrte også kostnaden eksplisitt, med en stående instruks om at
ekstra kreditter aldri brukes uten tillatelse, og med modellvalg per jobb:
den dyre modellen til dømmekraftstunge gjennomganger, den rimeligere til
UI-arbeid.

**Modellen gikk noen ganger videre uten synlig godkjenning.** Transkriptene
viser et lite, men reelt mønster: en fletting ble kjørt da læreren bare hadde
bedt om en sammenligning, og et vokabularbytte ble gjennomført uten at noe
eksplisitt ja er bevart. Ingen av tilfellene ga skade, og begge lå innenfor
en avtalt retning, men de minner om at prinsippet «ingenting på eget
initiativ» krever vedlikehold fra begge sider.

## Vanene som ble stående

- Mål med skript før du mener noe; legg aldri frem en plan bygget på
  antakelser.
- Skill mekanisk fra kildesjekkbart fra skjønn, og gjør N saker til ett valg
  der en regel dekker dem.
- La agenter forberede, aldri avgjøre; motprøv alt før det vises frem.
- Alle endringer via importfil med fletting; verifiser mot fersk eksport
  etterpå, og regn alle genererte filer som utdaterte i det noe importeres.
- Logg arbeidet (`Pensumgjennomgang.md`), skriv minnefiler for det som ikke
  står i koden, og lag handover-prompter ved kontekstbytte.
- Bump versjonen ved hver endring; test med tømt cache; verifiser lærersiden
  bak innloggingen, ikke fra innloggingsskjermen.

## Sluttbetraktning

Det som gjorde samarbeidet produktivt, var ikke at modellen fikk frihet, men
at den fikk struktur: klare mandater, målbare oppdrag, en beslutningsflyt der
læreren så alt og avgjorde alt, og kontrollører som antok at leveransene var
for pene. Innenfor den rammen kunne modellen gjøre ting som ellers ikke hadde
vært praktisk mulige for én person: kildesjekke 319 artistbeskrivelser mot
tre kildeverk, holde 267 tester grønne gjennom en arkitekturomlegging, og
snu hele datamodellen uken før lansering. Utenfor rammen viste materialet
gjentatte ganger hvorfor rammen fantes.

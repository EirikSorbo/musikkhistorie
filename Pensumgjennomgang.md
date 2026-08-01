# Pensumgjennomgang

Logg over gjennomgangen av musikkhistorie-pensumet. Kort og konsist: hva, dato, og hvilken Claude-modell.

| Dato | Hva ble gjort | Modell |
|---|---|---|
| 2026-07-18 | **Instrument-migrering importert og verifisert.** 35 artister omdøpt til kanonisk vokabular (Piano/keyboards→Tangenter, Saxofon→Saksofon, Trommer/perk→Trommer/perkusjon). 9 artister står fortsatt uten instrument (fylles manuelt). | Opus 4.8 |
| 2026-07-18 | **Faktasjekk av alle 295 artistbeskrivelser.** 98 funn (33 feil, 61 tvilsomme, 4 feltfeil), nettverifisert. Rapport: `Faktasjekk artistbeskrivelser 2026-07-18.md` i prosjektrota. | Opus 4.8 |
| 2026-07-18 | **Faktarettelser importert og verifisert mot live.** 84 beskrivelser rettet (inkl. 5 jazz/blues-tekster brukeren justerte selv via godkjenningswidget). 0 avvik på live. | Opus 4.8 |
| 2026-07-18 | **Års-sjekk av alle 295 artister** (fødsels-/døds-/dannelses-/oppløsningsår), inkl. aktiv dødsfallssjekk mot falske dødsrykter. 9 forslag, alle grupper. Importert og verifisert: 6 birthYear + 7 deathYear (bl.a. Run DMC oppløst 2002, Bee Gees 2012, EW&F dannet 1969, NWA 1987 med tekst oppdatert). 0 avvik på live. | Opus 4.8 |
| 2026-07-19 | **App-forbedringer (v3.69), pushet.** (1) Filtertreff viser nå artistkort som standard (kronologisk) med ny «Vis liste»-knapp for kompakt oversikt — både student og lærer. (2) «Vis i tidslinje»-knapp på alle artistkort-flater (dagens artist, liste med/uten filter, detaljmodal), ikke bare enkelte. Verifisert i preview (render-logikk + live bryter-veksling, ingen konsollfeil). | Opus 4.8 |
| 2026-07-19 | **App-justering (v3.70), pushet.** «Beslektede artister»-boblene viser nå kun navn — sjanger-taggen fjernet på alle kort-flater. Verifisert i preview. | Opus 4.8 |
| 2026-07-19 | **App-justering (v3.71), pushet.** (1) Lytteeksempler i «Sentrale verk»-format (fet etikett + understrekede lenker med årstall i parentes, ikke bobler). (2) Stemmetall fjernet fra kort; «Svært relevant»→«Merk ★» (stjerne = «Viktigst»), flyttet til knapperaden. Ryddet ubrukt CSS. Verifisert i preview (skjermbilde). | Opus 4.8 |
| 2026-08-01 | **Begrepsopprydding (v3.72), pushet.** `metaGenre` heter nå **metasjanger** overalt i appen — «hovedsjanger»/«supersjanger» er borte, så det ikke lenger kan forveksles med `mainGenre` («sjanger»). Verste tilfellet var lærerens rediger-skjema, der metaGenre-feltet het «Sjanger *» rett over «Sjangre (fra slektstreet)». Rørte 24 filer + tester; verifisert i preview. | Opus 5 |

## Gjenstår (ikke gjort ennå)
- 9 artister uten instrument — fylles manuelt via Oversikten: Dr. Dre, Owen Bradley, Calvin Harris, The Meters, Kenny Clarke, 808 State, King Tubby, Thomas A. Dorsey, James Cleveland.
- Innholdshull i sjangerspillelister: 5 tomme (British invasion, Cont. country, Cont. gospel, Cont. jazz, Rock'n'roll) og 6 tynne (Bluegrass, Folk, Ragtime, Techno, Trance & DnB, Trap).
- NB (NWA): kildene spriker 1986/1987 på dannelsesår — valgt 1987, felt og tekst er nå samstemte.

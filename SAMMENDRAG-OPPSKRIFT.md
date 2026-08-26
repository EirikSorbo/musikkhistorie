# Oppskrift: omfattende sammendrag av arbeidet med pensum-appen

Skrevet 2026-08-26. Alle tall og stier under er **verifisert i den økten**, så
den som utfører jobben slipper å kartlegge på nytt. Start på trinn 1.

**Mål:** tre leveranser fra samme grunnlag.

1. **Prosjektdokumentasjon** i repoet: hele reisen, faser, valg, begrunnelser, status.
2. **Fremvisningstekst**: hva som ble bygget og hvorfor det er pedagogisk interessant.
3. **Refleksjonsnotat**: om arbeidsmåten med en modell, hva som fungerte og ikke.

---

## Kildene, med verifiserte tall

| Kilde | Omfang | Dekker |
|---|---|---|
| Økt-transkripter | **30 lesbare** (116 MB rått) | 5. juli til 26. august |
| Økter uten transkript | **33** | 12. juni til 14. juli |
| Git-historikk | **460 commits** | 12. juni til 26. august |
| Minnefiler om appen | **56** | hele perioden |
| Repo-dokumentasjon | 8 `.md`-filer | nåtilstand |

### Stier

```
Øktmetadata (119 filer, kun tittel/dato/id, INGEN meldinger):
  ~/Library/Application Support/Claude/claude-code-sessions/**/local_*.json

Transkripter (53 filer, .jsonl, én melding per linje):
  ~/.claude/projects/-Users-eiriks05-Documents-Eiriks-Script/<cliSessionId>.jsonl

Minne:
  ~/.claude/projects/-Users-eiriks05-Documents-Eiriks-Script/memory/

Repo:
  ~/Documents/Eiriks Script/pensum/
```

**Koblingen mellom dem:** øktmetadata-fila har feltet `cliSessionId`. Det er
filnavnet på transkriptet. Uten den koblingen finner du ingenting, for
`sessionId` (`local_…`) matcher ikke filnavnene.

---

## Begrensningen, og hvordan den håndteres

**De 33 tidligste øktene har ikke transkript.** Bare tittel og dato finnes.
Verktøyet `search_session_transcripts` når dem heller ikke, det er testet.

Dette er grunnleggingsfasen, 12. juni til 14. juli. Den må **rekonstrueres** fra
git-commitene (som er detaljerte og daterte), minnefilene og titlene.

**Merk tydelig i leveransene hva som er lest og hva som er utledet.** Det er
forskjell på «du bestemte X fordi Y» og «commitene tyder på at X ble gjort da».

De 33, i kronologisk rekkefølge:

```
2026-06-12  Genealogy program requirements
2026-06-20  Music history curriculum app
2026-06-26  Artist card importance filters (x2)
2026-06-27  Curriculum visualization options
2026-06-27  Family tree node genre linking
2026-06-27  Pensum app code cleanup
2026-06-27  Removed artists disappearing after export
2026-06-29  Artist genre classification
2026-06-29  Genre descriptions for Alt #03.json
2026-06-29  Genre tree UI updates
2026-06-29  Genre tree tab visibility and artist card layout
2026-06-29  Music subgenre descriptions
2026-06-29  Varmekartet genre grouping (x2)
2026-06-29  Widget for subsjangere
2026-06-30  Multiple main genres per artist
2026-07-02  Subgenre description inheritance
2026-07-04  Artist timeline genre expansion
2026-07-05  MUR114 metaGenre narratives
2026-07-05  Populærmusikkhistorie low-priority findings
2026-07-06  Constellation map for artists by genre
2026-07-08  Pedagogical potential in pensum app
2026-07-12  Five genre summaries for curriculum app
2026-07-13  Genre tree mobile interactions
2026-07-13  JSON-OPPSKRIFT.md pensum-appen
2026-07-13  Pensum app UI updates
2026-07-13  Pensum app duplicate/shadow-text audit
2026-07-13  Pensumappen genre description duplicates
2026-07-14  Curriculum app fixes and guide
2026-07-14  Decade buttons missing on dashboard cards
2026-07-14  Innovation card edit popup
2026-07-14  Pensum artist card error
```

---

## Trinn 1: uttrekk og forbehandling

Ingen agenter. Deterministisk.

**Det viktigste funnet:** i det største transkriptet (23 MB) er den faktiske
samtalen bare **104 KB**, altså under en halv prosent. Resten er verktøy-output.
Stripper du det bort, krymper 116 MB til rundt **1,5 MB ren samtale**, som er
fullt lesbart. **Ikke gi rå .jsonl til agenter.** Forbehandle først.

Skript som trekker ut samtalen fra ett transkript:

```js
// node strip.js <sti-til.jsonl>
const fs = require("fs");
const linjer = fs.readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean);
const ut = [];
for (const l of linjer) {
  let j; try { j = JSON.parse(l); } catch { continue; }
  const m = j.message; if (!m) continue;
  const tekst = typeof m.content === "string" ? m.content
    : Array.isArray(m.content) ? m.content.filter(p => p.type === "text").map(p => p.text || "").join("\n") : "";
  if (!tekst.trim()) continue;                    // hopper over ren verktøybruk
  ut.push((m.role === "user" ? "### BRUKER\n" : "### CLAUDE\n") + tekst.trim());
}
console.log(ut.join("\n\n"));
```

Hent også:

```bash
cd ~/Documents/Eiriks\ Script/pensum
git log --reverse --date=short --format="%ad  %s" > /tmp/gitlogg.txt
```

Og les alle 56 minnefilene i `memory/` som matcher `pensum`.

---

## Trinn 2: lesning av de 30 øktene

Rundt **10 agenter, tre økter hver**. Hver agent leser den forbehandlede teksten
og returnerer strukturert:

- hva som ble besluttet, og av hvem
- **hva som ble forkastet, og hvorfor** (det viktigste, og det som ikke finnes
  i git eller minnet)
- brukerens egne begrunnelser, gjerne sitert
- blindveier og ting som måtte gjøres om

**Be agentene være strenge på skillet mellom hva brukeren sa og hva modellen
foreslo.** Sammendraget skal handle om lærerens arbeid, ikke modellens.

### Arbeidsliste

Transkriptene ligger i `~/.claude/projects/-Users-eiriks05-Documents-Eiriks-Script/`.

| # | Dato | Tittel | Fil |
|---|---|---|---|
| 1 | 2026-07-05 | Artist influence year approval widget | `0e33f4ae-f90e-474c-ba99-b3c16033b3d4.jsonl` |
| 2 | 2026-07-14 | Pensum-appen Firebase file access | `df6bbe41-159a-4f5f-bee4-26c2b48f988a.jsonl` |
| 3 | 2026-07-14 | Innovation cards vs technology descriptions | `f2e1799b-a4fa-414f-95d0-722eb7377102.jsonl` |
| 4 | 2026-07-14 | Genre tree hover interactions | `124529cf-aa8e-45b1-afd0-385a07320ccf.jsonl` |
| 5 | 2026-07-15 | Pensum app architecture review | `18e87a59-7dc5-478e-ab0e-91cc3529bd49.jsonl` |
| 6 | 2026-07-16 | Genre description editing | `63b7c8b5-490f-439b-9d44-bc5979f48863.jsonl` |
| 7 | 2026-07-18 | JSON-fil import for pensum-appen | `482c0e69-e9ed-43ee-b6e1-65e9b02c66c9.jsonl` |
| 8 | 2026-07-18 | Spillelister og multi-sjanger artister | `368a1009-b7a7-45bc-9229-812bc90b4cde.jsonl` |
| 9 | 2026-07-19 | Pensum innhold struktur | `05adbb67-b8d0-4f1e-9ccf-90f83f0eb903.jsonl` |
| 10 | 2026-07-22 | Jazz | `4b1eead7-c4dd-4301-8c1d-93130689e900.jsonl` |
| 11 | 2026-07-22 | Country | `703ff6e6-a9b4-4501-a95f-af6ee1ce06a1.jsonl` |
| 12 | 2026-07-24 | R&B | `266ec933-5128-47df-831d-ad64a8017de0.jsonl` |
| 13 | 2026-07-24 | Klubbmusikk | `f6a4cd25-17ea-4dbb-9dc6-bd15e25ec086.jsonl` |
| 14 | 2026-07-24 | Gospel pensum-gjennomgang | `a3db7dda-d66b-4e9f-8ff5-d25a315aa035.jsonl` |
| 15 | 2026-08-02 | Hip-hop som metasjanger | `d215045d-a55f-4f5e-80b5-970d99d455fe.jsonl` |
| 16 | 2026-08-02 | Metasjanger naming refactor | `877428ef-caef-430c-8e2e-53a377e71b39.jsonl` |
| 17 | 2026-08-03 | Artistenes tidslinje metasjanger-rekkefølge | `ff607bcc-7f3d-4a52-8f15-9e6ef2fdc08f.jsonl` |
| 18 | 2026-08-04 | Sjanger-gjennomgang musikk | `8a3b22da-0ca2-4973-9214-e515036697e8.jsonl` |
| 19 | 2026-08-04 | Hovedsjangere i sjangertreet | `e7c0b348-a918-4e0e-9d64-4e15c98f76a7.jsonl` |
| 20 | 2026-08-04 | Pensum-appen UI-justeringer | `395bcad7-6671-4231-a8b5-d618d7840e03.jsonl` |
| 21 | 2026-08-04 | Pensum-appen (kort økt) | `8d397ace-3b98-4b4f-b4dd-481cc249b48d.jsonl` |
| 22 | 2026-08-05 | Pensumappen | `4353837a-cfae-4cc3-b692-879cb399a0f0.jsonl` |
| 23 | 2026-08-05 | Pensum-appen lytteeksempler retagging | `6bfbdf88-ca63-4644-bfa9-19b85dba2361.jsonl` |
| 24 | 2026-08-18 | Pensumappen domene-oppsett | `ae5f2970-ae1c-4b93-97fc-2aae3927960e.jsonl` |
| 25 | 2026-08-18 | Endringer i sjanger-treet | `f2a0db51-41f1-4440-855c-852eb5f8534c.jsonl` |
| 26 | 2026-08-19 | Referanser-kort i pensum-appen | `2ce8d3d5-170c-4a2e-ab2a-0129dc92b9d1.jsonl` |
| 27 | 2026-08-21 | Pensum natt fase0 1 | `7327efa6-6067-460f-8cf9-551b2a131374.jsonl` |
| 28 | 2026-08-21 | Pensum-appen handover plan | `bf2eb695-cb9c-4be4-a995-04b7131f65de.jsonl` |
| 29 | 2026-08-21 | Pensum-app slektstre visualisering | `14f19d34-bd4b-4575-a025-7e4ac82530f3.jsonl` |
| 30 | 2026-08-26 | Innhold, formatering, lansering | `855e5b36-122c-404f-87f3-bf4f8e2aa0f9.jsonl` |

Filnavnene kan endre seg hvis økter slettes. Bygg lista på nytt fra
`cliSessionId` hvis en fil mangler.

---

## Trinn 3: rekonstruksjon av juni-perioden

Fra git-loggen 12. juni til 14. juli, minnefilene og de 33 titlene. Målet er en
troverdig kronologi over hva som ble bygget først, ikke en gjetning på hva som
ble sagt. **Merk avsnittet som rekonstruert.**

---

## Trinn 4: syntese

Slå sammen til én kronologi med faser. Et utgangspunkt, basert på det som er
kjent i dag:

- **Grunnlegging** (juni): idé, datamodell, sjangertre, første visualiseringer
- **Struktur** (juli): arkitektur-review, oppdeling av `explore.js`, innhold i
  Firestore, JSON-formatet, import og eksport
- **Innhold** (juli til august): sjangerbeskrivelser per metasjanger, artistkort,
  kildesjekk, faktagjennomgang
- **Utvidelse** (august): hip-hop som metasjanger, navnebytter, referansekort,
  dynamiske sjangre, domene og klassekode
- **Kvalitetssikring og lansering** (26. til 27. august): innholdsgjennomgang,
  formateringskonvensjon, midlertidig skjuling av fem funksjoner

---

## Trinn 5: de tre leveransene

Skriv dem hver for seg. Samme grunnlag, ulik leser.

**Prosjektdokumentasjon** i repoet. Fullstendig, med datoer, tall og
begrunnelser. Skal kunne leses av noen som overtar.

**Fremvisningstekst.** Hva som ble bygget og hvorfor det er pedagogisk
interessant. Mindre teknikk, mer om hva appen gjør for en elev. Vurder en
Artifact med figurer.

**Refleksjonsnotat.** Om arbeidsmåten: hva som fungerte i samspillet med en
modell, hva som ikke gjorde det, og hvilke vaner som vokste fram. Her hører
widget-metoden hjemme, kravet om at ingenting endres på eget initiativ, og
oppdagelsen av at agenter må motprøves fordi de pynter på fakta.

---

## Praktisk

- Følg språkreglene i `content-explanation.md` hvis leveransene skal ligge i
  repoet: ingen tankestrek omgitt av mellomrom, ingen emoji, norske
  anførselstegn.
- Sjekk alltid at et skript **faktisk skrev fila** før du melder «OK». En
  krasj etter siste endring, men før skrivingen, gir tapte endringer uten feil.
- Bruk `Workflow` for trinn 2, ikke en løkke av enkeltkall. Brukeren har
  godkjent kostnaden for denne jobben, men har ellers bedt om at agenter og
  dyre operasjoner ikke settes i gang uten tillatelse.

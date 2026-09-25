// ============================================================================
//  DELTE ENTITETSVERDIER — «hva står det nå?» for et endringsforslag
// ----------------------------------------------------------------------------
//  Delt av lærersidens diff-visning (teacher-review.js) og studentens
//  retur-editor (landing.js). Begge trenger dagens verdier for entiteten et
//  pendingEdit peker på, og de MÅ lese likt: diffen læreren godkjenner og
//  utgangspunktet studenten redigerer videre på skal være samme virkelighet.
//  `state` er sidens delte samlinger (sharedStateDefaults-formen).
// ============================================================================

import { resolveDesc } from "./genre-descriptions.js?v=5.63";
import { resolveMainDesc } from "./genealogy.js?v=5.63";
import { genreEditLevel } from "./store.js?v=5.63";

export function currentEntityValues(state, edit) {
  const { entityType, entityId } = edit;
  switch (entityType) {
    case "artist": return state.artists.find(a => a.id === entityId) || {};
    case "tech":   return state.techItems.find(t => t.id === entityId) || {};
    case "subgenre": {
      // Les fra SAMME nivå som forslaget gjelder, og med SAMME oppslag som
      // sjangerkortet (main går via resolveMainDesc, som også prøver nodens
      // fulle navn). Alle foreslåbare felter må med — «Gjeldende»-kolonnen
      // viste før «(tom)» for kilder selv når sjangeren hadde kilder, og
      // godkjenning kunne dermed viske dem ut.
      const level = genreEditLevel(edit);
      const r = level === "main"
        ? resolveMainDesc(state.genreDescs, entityId)
        : resolveDesc(state.genreDescs, entityId, level);
      return {
        description: r.description || "",
        kilder: r.kilder || [],
        activeFrom: r.activeFrom ?? null,
        activeTo: r.activeTo ?? null,
        // era kom som foreslåbart felt i v4.03, men ble aldri lagt til her.
        // 35 av 141 beskrivelser har en epoketekst, og godkjenning ERSTATTER:
        // læreren så «(tom)» og trodde feltet var ledig.
        era: r.era || "",
      };
    }
    // Instrumentsammendraget er en innholdsside (content/instrument-<slug>).
    case "instrument": {
      const page = state.content?.[entityId] || {};
      // kilder ble foreslåbart i v5.00. Uten det her leste læreren «Kilder |
      // (tom) | ny kilde» som en ren tilføyelse, mens godkjenning i praksis
      // BYTTET UT lista (Firestore erstatter arrays ved merge).
      return { body: page.body || "", kilder: page.kilder || [] };
    }
    case "decade-society": {
      const d = state.decadeDescs[String(entityId)] || {};
      return { society: d.society || "", kilder: d.kilder || [] };
    }
    case "decade-tech": {
      const d = state.decadeDescs[String(entityId)] || {};
      return { tech: d.tech || "", kilder: d.kilder || [] };
    }
    default: return {};
  }
}

// ============================================================================
//  LAGRE SOM TIME (v7.15)
// ----------------------------------------------------------------------------
//  Delt av Avslutt i visningen (presentasjon.js) og de ulagrede visningene
//  (sikkerhetskopiene, visning.js). Spør om tittel og gruppe og lagrer timen
//  som en egen plan med dato. Til v7.14 lå tittelspørsmålet inne i
//  avsluttPresentasjon, og en time hadde ingen gruppe.
//
//  Gruppen foreslås som den forrige timen fikk (husket i denne nettleseren),
//  ellers som kjøreplanen som ble spilt. Avbryt i ett av spørsmålene lagrer
//  ingenting.
// ============================================================================

import { getState } from "../data/app-state.js";
import { savePlan } from "../data/store.js";
import { sporTekst } from "../ui/ui-modal.js";
import { normaliserPlaner, normaliserGruppe, nyPlanId } from "./presentasjon-modell.js";
import { gruppeNavn } from "./gjennomgang-modell.js";

const SIST_GRUPPE = "pensum-time-gruppe";

function sistGruppe() {
  try { return normaliserGruppe(localStorage.getItem(SIST_GRUPPE) || ""); } catch (e) { return ""; }
}
function huskGruppe(g) {
  try { if (g) localStorage.setItem(SIST_GRUPPE, g); else localStorage.removeItem(SIST_GRUPPE); } catch (e) { /* uten lagring huskes den ikke */ }
}

// { tittel, gruppe } når timen er lagret, null når læreren avbrøt. Kaster når
// lagringen feiler: kalleren sier fra og lar alt stå, så det kan prøves igjen.
export async function lagreSomTime({ stopp, dato, tittelForslag, gruppeForslag = "" }) {
  const svar = await sporTekst("Datoen lagres ved siden av tittelen.", tittelForslag, { tittel: "Tittel på timen", ok: "Videre" });
  if (svar === null) return null;
  const tittel = (svar.trim() || tittelForslag).slice(0, 80);
  const grupper = gruppeNavn(normaliserPlaner(getState().content?.presentasjoner?.planer));
  const forslag = sistGruppe() || normaliserGruppe(gruppeForslag);
  const g = await sporTekst(
    "Timene i samme gruppe får en felles oversikt over det som er gått gjennom. La feltet stå tomt for ingen gruppe.",
    forslag, { tittel: "Gruppe", ok: "Lagre timen", forslag: grupper });
  if (g === null) return null;
  const gruppe = normaliserGruppe(g);
  await savePlan(nyPlanId(), { tittel, laget: new Date().toISOString(), dato, stopp, ...(gruppe ? { gruppe } : {}) });
  huskGruppe(gruppe);
  return { tittel, gruppe };
}

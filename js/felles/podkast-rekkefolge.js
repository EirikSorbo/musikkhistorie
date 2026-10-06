// ============================================================================
//  PODKASTENES REKKEFØLGE (v6.48, brukerbestilling 2026-10-06)
// ----------------------------------------------------------------------------
//  Nyeste øverst: episoden med høyest `order` står først. En ny episode får
//  høyeste order + 1 (teacher-content.js) og havner dermed øverst av seg selv.
//  Før v6.48 var sorteringen stigende, så nye episoder havnet nederst.
//
//  Læreren kan flytte episodene opp og ned. En flytting nummererer hele lista
//  på nytt (øverst får antallet, nederst 1), så like eller manglende order-
//  verdier fra eldre data eller import aldri gjør flyttingen virkningsløs.
//  Bare episodene som faktisk får nytt tall, skrives.
//
//  DOM-fri og uten Firebase, så den testes i Node (tests/unit/podkast-rekkefolge.test.js).
// ============================================================================

// Manglende order regnes som eldst (nederst).
const tall = (p) => (Number.isFinite(p?.order) ? p.order : -Infinity);

export function sorterPodkaster(pods) {
  return [...(pods || [])].sort((a, b) => {
    const ta = tall(a), tb = tall(b);
    if (ta !== tb) return tb > ta ? 1 : -1;
    return String(a?.title || "").localeCompare(String(b?.title || ""), "no")
      || String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}

// Episoden `id` ett steg opp (steg -1) eller ned (+1) i den viste lista.
// Gir [{ id, order }] for episodene som må skrives, eller [] når flyttingen
// ikke går (øverst, nederst eller ukjent episode).
export function flyttPodkast(pods, id, steg) {
  const liste = sorterPodkaster(pods);
  const i = liste.findIndex((p) => p.id === id);
  const j = i + steg;
  if (i < 0 || j < 0 || j >= liste.length) return [];
  [liste[i], liste[j]] = [liste[j], liste[i]];
  const n = liste.length;
  return liste
    .map((p, k) => ({ id: p.id, order: n - k, var: p.order }))
    .filter((x) => x.var !== x.order)
    .map(({ id: pid, order }) => ({ id: pid, order }));
}

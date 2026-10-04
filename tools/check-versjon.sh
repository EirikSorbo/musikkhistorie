#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Cache-busting-sjekken, delt av .githooks/pre-push og CI
#  (.github/workflows/tester.yml). Feiler hvis:
#    · en import i js/ eller tests/ HAR ?v=. Fra v6.28 står versjonen i
#      importkartet i HTML-sidene. En import med ?v= ved siden av en uten
#      laster modulen TO ganger, og med genre-modellens live bindings rendrer
#      treet da tomt.
#    · en lokal js/css-referanse i *.html MANGLER ?v=, eller ?v= ikke matcher
#      VERSION i js/version.js (kjør ./bump.sh)
#    · importkartet i en side er utdatert (tools/importkart.js --sjekk)
#  Flyttet ut av kroken i v5.49, så også commits som ikke har gått gjennom
#  kroken (en annen maskin, GitHubs webredigering) blir sjekket.
#  NB: leser ARBEIDSTREET (bevisst enkelhet). Feiler alltid LUKKET med beskjed.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

# -a overalt: tving tekst-tolkning. I C-locale kan BSD-grep ellers
# feilklassifisere UTF-8-filer (›, ◆ osv.) som binære og skjule treffene.

# Importer MED ?v= (statiske og dynamiske, i appen og i testene), i alle
# mappene under js/ (fra v6.30). -r med --include virker likt i BSD- og GNU-grep.
medv=$(grep -rnaE --include='*.js' --exclude-dir=vendor "[\"'][.][.]?/[^\"'?]+[.]js[?]v=" js tests || true)
if [ -n "$medv" ]; then
  echo "check-versjon: importer med ?v= (versjonen står i importkartet fra v6.28):"
  echo "$medv" | head -20
  echo "Fjern ?v= fra importene."
  exit 1
fi

# Lokale referanser UTEN ?v= i HTML: usynlige for bump.sh, og nettleseren
# fortsetter med den gamle fila fra cachen.
mangler=$(grep -naE '(src|href)="(js|css)/[^"?]+\.(js|css)"' ./*.html || true)
if [ -n "$mangler" ]; then
  echo "check-versjon: lokale referanser uten ?v= i HTML (cache-busting mangler):"
  echo "$mangler" | head -20
  echo "Legg på ?v= (bump.sh tar dem med videre)."
  exit 1
fi

# «|| true»: uten den ville set -e drept skriptet før feilmeldingen under.
VER=$(grep -oE '"[0-9][0-9.]*"' js/version.js | head -1 | tr -d '"' || true)
[ -n "$VER" ] || { echo "check-versjon: fant ikke VERSION i js/version.js"; exit 1; }

bad=$(grep -naoE '(src|href)="(js|css)/[^"?]+\?v=[0-9][0-9.]*' ./*.html | grep -av -- "?v=${VER//./[.]}\$" || true)
if [ -n "$bad" ]; then
  echo "check-versjon: cache-busting er i utakt med js/version.js (v$VER):"
  echo "$bad" | head -20
  echo
  echo "Kjør ./bump.sh og commit på nytt."
  exit 1
fi

node tools/importkart.js --sjekk || { echo "Kjør ./bump.sh og commit på nytt."; exit 1; }
echo "check-versjon: alle referanser har ?v=$VER, og importkartene er à jour"

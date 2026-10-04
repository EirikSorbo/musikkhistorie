#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Cache-busting for GitHub Pages.
#  Setter appens VERSION fra js/version.js på det sidene laster:
#    · ?v= på <script src> og <link href> til js/ og css/ i *.html
#    · importkartet i *.html (tools/importkart.js), som gir hver modul ?v=.
#  Importlinjene i js/ står UTEN versjon (fra v6.28) og røres ikke her.
#
#  Bruk:  bump VERSION i js/version.js  →  kjør ./bump.sh
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

# «|| true»: uten den dreper set -e pipelinen FØR feilmeldingen under rekker
# å skrives (samme vern som .githooks/pre-push).
VER=$(grep -oE '"[0-9][0-9.]*"' js/version.js | head -1 | tr -d '"' || true)
[ -n "$VER" ] || { echo "Fant ikke VERSION i js/version.js"; exit 1; }

# Bare src/href til js/ og css/: en løs «?v=<tall>» kan like gjerne være en
# YouTube-lenke (watch?v=3rd9…). Den forrige, bredere regexen skrev om en slik
# lenke i en test ved hver versjon fra v5.56 til v6.27.
shopt -s nullglob
for f in *.html; do
  perl -i -pe "s/((?:src|href)=\"(?:js|css)\/[^\"?]+)\?v=[0-9][0-9.]*/\$1?v=$VER/g" "$f"
done
node tools/importkart.js
# Modulkartet (MODULKART.md) lages av innledningen øverst i hver fil, så en ny
# fil eller en endret tittellinje kommer med når versjonen bumpes.
node tools/modulkart.js

echo "Satt ?v=$VER i *.html og importkartet, og oppdaterte modulkartet"

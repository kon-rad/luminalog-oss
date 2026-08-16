#!/usr/bin/env bash
# Copies the renderer source into the Next.js app.
#
# WHY A COPY RATHER THAN A `file:` DEPENDENCY: web/deploy.sh rsyncs ONLY the web/
# directory to the server, so a `file:../packages/cognitive-map` dependency would not
# exist remotely and `npm run build` would fail there. Vendoring the source keeps the
# deploy exactly as it is today, and mirrors sync-ios.sh, which vendors the built
# bundle into the app's Resources for the same "no external tree at build time" reason.
#
# packages/cognitive-map/src is the SINGLE SOURCE OF TRUTH. The copy is committed and
# must never be hand-edited; `npm test` in this package fails if the two drift.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dest="$here/../../web/src/lib/cognitive-map"

mkdir -p "$dest"
rm -f "$dest"/*.ts "$dest"/*.tsx

for file in types layout wrap rank theme render mount index; do
  cp "$here/src/$file.ts" "$dest/$file.ts"
done
cp "$here/src/react.tsx" "$dest/react.tsx"

echo "synced cognitive-map source into $dest"

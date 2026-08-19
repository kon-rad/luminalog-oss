#!/usr/bin/env bash
# Copies the built renderer into the iOS app's Resources so an Xcode build never needs
# Node. Both artifacts are COMMITTED; re-run this whenever src/ changes, or the app
# keeps silently rendering the previously committed bundle.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
resources="$here/../../ios/LuminaLog/Resources"

npm --prefix "$here" run build

mkdir -p "$resources/vendor"
cp "$here/dist/cognitive-map.iife.js" "$resources/vendor/cognitive-map.iife.js"
cp "$here/ios/map.html" "$resources/map.html"

echo "synced cognitive-map into $resources"

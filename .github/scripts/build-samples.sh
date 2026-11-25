#!/usr/bin/env bash
#
# Builds the sample apps of the suite for the web, in a container: the counter of `flutter create`, and
# form_app, testing_app and material_3_demo of flutter/samples (BSD-3-Clause, at a pinned commit, only
# built here), each into samples/<site>/<app>/, served under /<app>/.
#
#   SDK_IMAGE     the image the apps are built in (default webship-flutter-sdk:3.50.1, built from
#                 .github/sdk/Dockerfile when it is not there)
#   SAMPLES_DIR   where the sources and the builds go (default: samples/, beside .github/)
#   --wasm        build for WebAssembly (`flutter build web --wasm`) into samples/site-wasm/; else
#                 for JavaScript into samples/site/
#
# The samples are a pub workspace upstream: each is copied out of it (its `resolution: workspace` line
# dropped) and built on its own.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SDK_IMAGE="${SDK_IMAGE:-webship-flutter-sdk:3.50.1}"
SAMPLES_DIR="${SAMPLES_DIR:-$ROOT/samples}"
SAMPLES_REPO="https://github.com/flutter/samples.git"
SAMPLES_COMMIT="a5bccd247163b1017d2eb9320cf3b94a95ccfb5e"
APPS=(counter form_app testing_app material_3_demo)

wasm=""
site="site"
if [ "${1:-}" = "--wasm" ]; then
  wasm="--wasm"
  site="site-wasm"
fi

if ! docker image inspect "$SDK_IMAGE" > /dev/null 2>&1; then
  echo "Building the SDK image $SDK_IMAGE"
  docker build -t "$SDK_IMAGE" "$ROOT/.github/sdk"
fi

mkdir -p "$SAMPLES_DIR/src" "$SAMPLES_DIR/apps" "$SAMPLES_DIR/pub-cache" "$SAMPLES_DIR/$site"

if [ ! -d "$SAMPLES_DIR/src/flutter-samples/.git" ]; then
  git clone --quiet --filter=blob:none --no-checkout "$SAMPLES_REPO" "$SAMPLES_DIR/src/flutter-samples"
  git -C "$SAMPLES_DIR/src/flutter-samples" sparse-checkout set analysis_defaults form_app testing_app material_3_demo
  git -C "$SAMPLES_DIR/src/flutter-samples" checkout --quiet "$SAMPLES_COMMIT"
fi

for app in analysis_defaults form_app testing_app material_3_demo; do
  if [ ! -d "$SAMPLES_DIR/apps/$app" ]; then
    cp -a "$SAMPLES_DIR/src/flutter-samples/$app" "$SAMPLES_DIR/apps/$app"
    sed -i '/^resolution: workspace$/d' "$SAMPLES_DIR/apps/$app/pubspec.yaml"
  fi
done

owner="$(id -u):$(id -g)"
run() {
  docker run --rm -v "$SAMPLES_DIR/apps:/work" -v "$SAMPLES_DIR/pub-cache:/opt/pub-cache" -w "$1" "$SDK_IMAGE" bash -c "$2" < /dev/null
}

if [ ! -d "$SAMPLES_DIR/apps/counter" ]; then
  run /work "flutter create --platforms web --project-name counter counter; rc=\$?; chown -R $owner /work/counter /opt/pub-cache; exit \$rc"
fi

for app in "${APPS[@]}"; do
  echo "Building $app${wasm:+ for WebAssembly}"
  run "/work/$app" "flutter pub get && flutter build web --release $wasm --base-href /$app/; rc=\$?; chown -R $owner /work/$app /opt/pub-cache; exit \$rc"
  rm -rf "${SAMPLES_DIR:?}/${site:?}/${app:?}"
  cp -a "$SAMPLES_DIR/apps/$app/build/web" "$SAMPLES_DIR/$site/$app"
done

cat > "$SAMPLES_DIR/$site/index.html" <<HTML
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Sample apps</title></head>
<body>
<h1>The sample apps of the suite${wasm:+ (WebAssembly)}</h1>
<ul>
$(for app in "${APPS[@]}"; do echo "  <li><a href=\"$app/\">$app</a></li>"; done)
</ul>
</body>
</html>
HTML
echo "Built ${#APPS[@]} apps into $SAMPLES_DIR/$site/"

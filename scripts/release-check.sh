#!/usr/bin/env bash
# Everything that has to be true before this is handed to anybody: the package
# packs, what it packs is what the manifest says, and the entry point runs out
# of the packed tree rather than out of the working one.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "packing"
TARBALL="$(npm pack --pack-destination "$WORK" --silent | tail -1)"
tar -xzf "$WORK/$TARBALL" -C "$WORK"
PACKED="$WORK/package"

echo "checking what came out"
for path in package.json bin/shakerdeck.js src/index.js README.md LICENSE; do
  if [ ! -f "$PACKED/$path" ]; then
    echo "the package is missing $path" >&2
    exit 1
  fi
done

for unwanted in tests scripts .github coverage node_modules; do
  if [ -e "$PACKED/$unwanted" ]; then
    echo "the package carries $unwanted, which it should not" >&2
    exit 1
  fi
done

echo "checking every source file the entry point reaches came with it"
MISSING=0
while read -r file; do
  if [ ! -f "$PACKED/$file" ]; then
    echo "  missing from the package: $file" >&2
    MISSING=1
  fi
done < <(cd "$ROOT" && find src bin -name '*.js' | sort)
if [ "$MISSING" -ne 0 ]; then
  echo "the package is short of source files" >&2
  exit 1
fi

echo "running the entry point out of the packed tree"
cp -r examples "$PACKED/examples"
# The runtime dependency is not in the tarball, which is correct, so the
# already installed tree is lent to the packed one for the run.
ln -s "$ROOT/node_modules" "$PACKED/node_modules"
( cd "$PACKED" && node bin/shakerdeck.js commands >/dev/null )
( cd "$PACKED" && node bin/shakerdeck.js check -c examples/check-brazos.json >/dev/null )
( cd "$PACKED" && node -e "import('./src/index.js').then((m) => { if (!m.VERSION) { process.exit(1); } })" )

echo "the package is fit to hand over"

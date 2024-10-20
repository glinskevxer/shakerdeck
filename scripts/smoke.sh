#!/usr/bin/env bash
# Drives every command against the files in examples/ and fails on the first
# non zero exit. It is deliberately not a test framework: it is here to catch
# a command that only works when vitest imports it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CLI="node bin/shakerdeck.js"

run() {
  echo "  $*"
  # shellcheck disable=SC2086
  if ! $CLI "$@" >/dev/null; then
    echo "FAILED: $*" >&2
    exit 1
  fi
}

echo "smoke test"
run check -c examples/check-brazos.json
run check -c examples/check-brazos.json -f json
run hydraulics -w examples/well-brazos.json -c examples/check-brazos.json
run hydraulics -w examples/well-brazos.json -c examples/check-brazos.json -r 450
run daily -d examples/day-brazos.json -c examples/check-brazos.json -p examples/programme-brazos.json -P examples/products.json
run daily -d examples/day-brazos.json -c examples/check-brazos.json --summary
run mix -j "weight up" --from 12.4 --to 13.5 -v 800
run mix -j "cut back" --from 12.4 --to 11.5 -v 800
run mix -j blend --from 9.2 --to 12.4 --heavy 16 -v 400
run mix -j dilute --from-solids 0.06 --to-solids 0.05 -v 800
run programme -p examples/programme-brazos.json
run programme -p examples/programme-brazos.json -c examples/checks-brazos.json
run programme -p examples/programme-brazos.json -s intermediate -t examples/treatments.json -P examples/products.json
run solids -s examples/solids-control.json
run stock -P examples/products.json -m examples/movements.json -b examples/opening-stock.json
run commands
run commands -v

echo "every command ran"

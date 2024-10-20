#!/usr/bin/env bash
# npm audit, with a readable failure. The production dependency list is one
# package deep on purpose, so anything this finds is worth stopping for.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if ! npm audit --omit=dev --audit-level=high; then
  echo "there is a high or critical advisory against a runtime dependency" >&2
  exit 1
fi
echo "no high or critical advisories"

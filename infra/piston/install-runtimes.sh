#!/usr/bin/env bash
# Installs the three runtimes Code Dojo needs into a running Piston container.
set -euo pipefail
URL="${PISTON_URL:-http://127.0.0.1:2000}"
for spec in "python 3.12.0" "gcc 10.2.0" "java 15.0.2"; do
  set -- $spec
  echo "installing $1 $2…"
  curl -fsS -X POST "$URL/api/v2/packages" -H 'Content-Type: application/json' -d "{\"language\":\"$1\",\"version\":\"$2\"}" && echo
done
curl -fsS "$URL/api/v2/runtimes" && echo

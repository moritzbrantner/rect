#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  printf 'usage: %s <baseline-checkout> [candidate-checkout]\n' "$0" >&2
  exit 2
fi

baseline="$(cd "$1" && pwd)"
candidate="$(cd "${2:-.}" && pwd)"

printf -v primary 'cd %q && bun run benchmark:state' "$baseline"
printf -v candidate_command 'cd %q && bun run benchmark:state' "$candidate"

exec "$(dirname "$0")/moonlight.sh" run \
  --primary "$primary" \
  --candidate "$candidate_command"

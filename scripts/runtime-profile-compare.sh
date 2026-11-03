#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'usage: %s <reference-checkout> <candidate-checkout> <fresh-output-directory> [process|hotspots]\n' "$0" >&2
  exit 2
}

[[ $# -ge 3 && $# -le 4 ]] || usage
reference="$(cd "$1" && git rev-parse --show-toplevel)"
candidate="$(cd "$2" && git rev-parse --show-toplevel)"
output="$3"
mode="${4:-process}"
case "$mode" in
  process) scenario_name=state.json ;;
  hotspots) scenario_name=state-hotspots.json ;;
  *) usage ;;
esac

if [[ "$output" != /* ]]; then
  output="$PWD/$output"
fi
if [[ -e "$output" ]]; then
  printf 'refusing to overwrite existing evidence: %s\n' "$output" >&2
  exit 2
fi

reference_scenario="$reference/profiles/runtime-profiler/$scenario_name"
candidate_scenario="$candidate/profiles/runtime-profiler/$scenario_name"
if [[ ! -f "$reference_scenario" || ! -f "$candidate_scenario" ]]; then
  printf 'both checkouts must contain %s\n' "$scenario_name" >&2
  exit 2
fi
if ! cmp -s "$reference_scenario" "$candidate_scenario"; then
  printf 'scenario bytes differ between checkouts; measurements are not comparable\n' >&2
  exit 2
fi
for checkout in "$reference" "$candidate"; do
  if [[ -n "$(git -C "$checkout" status --porcelain)" ]]; then
    printf 'checkout is dirty; evidence must identify an exact source revision: %s\n' "$checkout" >&2
    exit 2
  fi
done

# The two upstream CLIs retain ownership of their evidence formats and verdicts.
profiler="${RUNTIME_PROFILER_BIN:-}"
if [[ -z "$profiler" ]] && command -v runtime-profiler >/dev/null 2>&1; then
  profiler="$(command -v runtime-profiler)"
fi
if [[ -z "$profiler" ]]; then
  profiler_root="${RUNTIME_PROFILER_ROOT:-$(dirname "$candidate")/runtime-profiler}"
  if [[ ! -f "$profiler_root/Cargo.toml" ]] || ! command -v cargo >/dev/null 2>&1; then
    printf 'runtime-profiler is unavailable; install it or set RUNTIME_PROFILER_BIN\n' >&2
    exit 127
  fi
  cargo build --quiet --locked --manifest-path "$profiler_root/Cargo.toml" --bin runtime-profiler
  profiler="$profiler_root/target/debug/runtime-profiler"
fi
if ! command -v "$profiler" >/dev/null 2>&1; then
  printf 'runtime-profiler binary is not executable: %s\n' "$profiler" >&2
  exit 127
fi

evaluator=()
if [[ -n "${MOONLIGHT_RUNTIME_PROFILE_BIN:-}" ]]; then
  evaluator=("$MOONLIGHT_RUNTIME_PROFILE_BIN")
elif command -v moonlight-runtime-profile >/dev/null 2>&1; then
  evaluator=("$(command -v moonlight-runtime-profile)")
else
  moonlight_root="${MOONLIGHT_ROOT:-$(dirname "$candidate")/moonlight}"
  if [[ ! -f "$moonlight_root/Cargo.toml" ]] || ! command -v cargo >/dev/null 2>&1; then
    printf 'Moonlight runtime evaluator is unavailable; install it or set MOONLIGHT_RUNTIME_PROFILE_BIN\n' >&2
    exit 127
  fi
  evaluator=(cargo run --quiet --locked --manifest-path "$moonlight_root/Cargo.toml" \
    -p moonlight-cli --bin moonlight-runtime-profile --)
fi

mkdir -p "$(dirname "$output")"
mkdir "$output"
git -C "$reference" rev-parse HEAD > "$output/reference-revision.txt"
git -C "$candidate" rev-parse HEAD > "$output/candidate-revision.txt"

"$profiler" capture --scenario "$reference_scenario" --output "$output/reference" > "$output/reference-capture.json"
"$profiler" capture --scenario "$candidate_scenario" --output "$output/candidate" > "$output/candidate-capture.json"

# Moonlight performs bundle validation, strict comparability, scoring and
# policy evaluation, preserving its distinct pass/fail/inconclusive exit codes.
status=0
"${evaluator[@]}" \
  --runtime-profiler "$profiler" \
  --reference "$output/reference" \
  --candidate "$output/candidate" \
  --reference-uri "file://$output/reference" \
  --candidate-uri "file://$output/candidate" \
  > "$output/evaluation.json" || status=$?
if [[ -s "$output/evaluation.json" ]]; then
  cat "$output/evaluation.json"
fi
printf 'Evidence: %s\n' "$output" >&2
exit "$status"

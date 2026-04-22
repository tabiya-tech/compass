#!/usr/bin/env bash

set -xe

mkdir -p results

test_cases=(get-version check-invitation-code e2e-skills-elicitation-chat)
#test_cases=(e2e-skills-elicitation-chat)

for i in "${!test_cases[@]}"; do
  test_case="${test_cases[$i]}"
  start=$SECONDS
  echo "testing ${test_case}"
  k6 run --out json="./results/${test_case}.out.jsonl" --summary-export="./results/${test_case}.summary.json" "./src/tests/${test_case}.js"
  echo "done testing ${test_case}"

  if (( i < ${#test_cases[@]} - 1 )); then
    elapsed=$(( SECONDS - start ))
    remaining=$(( 60 - elapsed ))
    if (( remaining > 0 )); then
      echo "sleeping for ${remaining}s"
      sleep "$remaining"
    fi
  fi
done

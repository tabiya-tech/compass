#!/usr/bin/env bash
#
# Runner for the k6 stress test. Loads k6s/.env (gitignored) and forwards the
# required/optional vars to `k6 run` via explicit -e flags, because k6 itself
# does not auto-load .env files and (since v0.38) does not expose system env
# vars to __ENV by default.
#
# Usage:
#   ./run.sh                                  # use everything from .env
#   ./run.sh -e STAGES_PROFILE=spike          # override a var for this run
#   ./run.sh --summary-export=results/x.json  # pass any extra k6 flag
#
# Any extra arguments are forwarded verbatim to `k6 run`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${BASE_URL:?BASE_URL is required. Set it in k6s/.env (see .env.example) or export it.}"
: "${FIREBASE_API_KEY:?FIREBASE_API_KEY is required. Set it in k6s/.env or export it.}"
: "${INVITATION_CODE:?INVITATION_CODE is required. Set it in k6s/.env or export it.}"

exec k6 run \
  -e BASE_URL="$BASE_URL" \
  -e FIREBASE_API_KEY="$FIREBASE_API_KEY" \
  -e INVITATION_CODE="$INVITATION_CODE" \
  ${STAGES_PROFILE:+-e STAGES_PROFILE="$STAGES_PROFILE"} \
  ${VUSERS:+-e VUSERS="$VUSERS"} \
  ${DURATION:+-e DURATION="$DURATION"} \
  ${LANGUAGE:+-e LANGUAGE="$LANGUAGE"} \
  ${MAX_MESSAGES_PER_VU:+-e MAX_MESSAGES_PER_VU="$MAX_MESSAGES_PER_VU"} \
  "$@" \
  stress-chat-flow.js

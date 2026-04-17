# k6 Load Tests for the Compass Backend

Stress tests the full user journey against any Compass backend environment:

1. Firebase **anonymous sign-in** (real call against `identitytoolkit.googleapis.com`).
2. `POST /users/preferences` — creates a session.
3. `POST /conversations/{session_id}/messages` — scripted career-guidance dialogue (~6 turns per VU).

Each k6 VU runs this end-to-end journey once per iteration, so VUs at steady-state represent the number of *concurrent users* the backend is serving.

## Install k6

```
brew install k6                 # macOS
# or: https://k6.io/docs/get-started/installation/
```

## Layout

```
k6s/
├── stress-chat-flow.js     # entrypoint
├── run.sh                  # loads .env and invokes `k6 run` with -e flags
├── lib/
│   ├── config.js           # env var parsing + ramp profiles
│   ├── firebase.js         # anonymous sign-in helper
│   ├── backend.js          # /users/preferences + chat helpers
│   └── prompts.js          # scripted dialogue with variations
├── .env.example            # required + optional env vars
└── results/                # JSON summaries (gitignored)
```

## Required env vars

| Var | Why |
| --- | --- |
| `BASE_URL` | Backend under test, e.g. `http://localhost:8080`. |
| `FIREBASE_API_KEY` | Same Web API key the frontend uses for the target env. |
| `INVITATION_CODE` | A valid `LOGIN`-type invitation code. Required by `backend/app/users/validators.py:20-32` for anonymous users. |

Optional: `STAGES_PROFILE` (default `stress`), `LANGUAGE` (default `en`), `MAX_MESSAGES_PER_VU` (default `6`).

See `.env.example` for the full list and comments.

## Run

### Configuration

k6 does **not** auto-load `.env` files, and (as of v0.38) doesn't expose system env vars to scripts by default. Use the included runner to bridge the gap:

```
cd k6s
cp .env.example .env     # fill in BASE_URL, FIREBASE_API_KEY, INVITATION_CODE
./run.sh                 # loads .env and invokes `k6 run` with explicit -e flags
```

Any extra arguments to `run.sh` are forwarded verbatim to `k6 run`, so you can override a var or add k6 flags on the fly:

```
./run.sh -e STAGES_PROFILE=smoke
./run.sh --summary-export=results/summary.json
```

Prefer the raw CLI? Pass the vars yourself with `k6 run -e KEY=value ... stress-chat-flow.js`.

### Smoke (1 VU, ~35s) — verify the setup works

Set `STAGES_PROFILE=smoke` in `.env` (or override per-run):

```
./run.sh -e STAGES_PROFILE=smoke
```

Expected: `user_flows_completed` > 0, no threshold breaches, zero 4xx/5xx.

### Stress (default profile, ~6 minutes, peak 100 VUs)

With `STAGES_PROFILE` unset or set to `stress` in `.env`:

```
./run.sh
```

### Export results as JSON

```
./run.sh --summary-export=results/summary.json
```

## Ramp profiles

Defined in `lib/config.js`:

| Profile | Shape | Purpose |
| --- | --- | --- |
| `smoke` | 1 VU for ~35s | Sanity check. |
| `baseline` | 5 VUs for ~3 min | Steady low load to measure normal-state latency. |
| `stress` (default) | ramps 5 → 20 → 50 → 100 VUs | Find the breaking point. |
| `spike` | jumps from 5 → 100 VUs instantly | Measure recovery behaviour. |

To use a different shape, edit `STAGE_PROFILES` in `lib/config.js` or override via `-e STAGES_PROFILE=<name>`.

## Thresholds

Defined in `stress-chat-flow.js`. A run **fails** (non-zero exit code) if any breaches:

- `http_req_failed: rate<0.05` — overall error rate < 5%.
- `http_req_duration{endpoint:firebase_signup}: p(95)<3s`.
- `http_req_duration{endpoint:preferences}: p(95)<2s`.
- `http_req_duration{endpoint:chat}: p(95)<15s` (LLM latency is the bottleneck).

Adjust these to match the SLO you're testing against.

## Reading the summary

k6 prints per-endpoint stats because each request is tagged with `endpoint: firebase_signup | preferences | chat`. Look for:

- Per-tag `http_req_duration` percentiles — is chat latency stable as VUs ramp?
- `http_req_failed{endpoint:chat}` — rising means the backend is saturating.
- Custom counters `user_flows_started`, `user_flows_completed`, `chat_messages_sent`.

## Notes

- `INVITATION_CODE` must be type `LOGIN` (not `REGISTER`). Seed one in the user-invitations collection before running.
- Local backends set `TARGET_ENVIRONMENT_TYPE=local`, which skips JWT signature verification — but the token still needs to parse, and the Firebase API key must be valid for the sign-up call.
- The chat timeout is set to 120s in `lib/backend.js` because under heavy stress the LLM path can exceed the 60s k6 default.
- Reruns consume invitation-code capacity and create real users in the target DB. Use a non-production env.

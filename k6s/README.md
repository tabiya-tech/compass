# k6 Load Tests for the Compass Backend

Stress tests the full user journey against any Compass backend environment:

1. Firebase **anonymous sign-in** (real call against `identitytoolkit.googleapis.com`).
2. `POST /users/preferences` — creates a session.
3. `PATCH /users/preferences` — accepts Terms & Conditions.
4. `POST /users/{user_id}/plain-personal-data` — submits personal data (name, institution, programme, school year).
5. `POST /conversations/{session_id}/messages` — scripted career-guidance dialogue (~6 turns per VU).

Each k6 VU signs in to Firebase, creates a session, accepts T&C, and submits personal data **once**, then runs the chat journey on every iteration, so VUs at steady-state represent the number of *concurrent users* the backend is serving.

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
│   ├── backend.js          # /users/preferences, T&C, personal data + chat helpers
│   ├── prompts.js          # scripted dialogue with variations
│   └── userdata.js         # personal data variations (names, institutions, etc.)
├── .env.example            # required + optional env vars
└── results/                # JSON summaries (gitignored)
```

## Required env vars

| Var | Why |
| --- | --- |
| `BASE_URL` | Backend under test, e.g. `http://localhost:8080`. |
| `FIREBASE_API_KEY` | Same Web API key the frontend uses for the target env. |
| `INVITATION_CODE` | A valid `LOGIN`-type invitation code. Required by `backend/app/users/validators.py:20-32` for anonymous users. |

Optional: `STAGES_PROFILE` (default `stress`), `VUSERS` (peak VU count — overrides profile default), `DURATION` (total test duration — overrides profile default), `LANGUAGE` (default `en`), `MAX_MESSAGES_PER_VU` (default `6`).

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

### Custom scale — override VUs and/or duration

Each profile has a default peak VU count and duration, but you can override either or both with `VUSERS` and `DURATION`. The profile's ramp shape is preserved; only the scale changes.

```
# Stress at 200 VUs for 10 minutes:
./run.sh -e VUSERS=200 -e DURATION=10m

# Quick smoke with 50 VUs:
./run.sh -e STAGES_PROFILE=smoke -e VUSERS=50 -e DURATION=1m

# Override just the VU count, keep the default duration:
./run.sh -e VUSERS=50
```

### Export results as JSON

```
./run.sh --summary-export=results/summary.json
```

## Ramp profiles

Defined in `lib/config.js`:

| Profile | Shape | Purpose |
| --- | --- | --- |
| Profile | Shape (default scale) | Purpose |
| --- | --- | --- |
| `smoke` | 1 VU for ~35s | Sanity check. |
| `baseline` | 5 VUs for ~3 min | Steady low load to measure normal-state latency. |
| `stress` (default) | ramps 5 → 20 → 50 → 100 VUs over ~6 min | Find the breaking point. |
| `spike` | jumps from 5 → 100 VUs instantly over ~2 min | Measure recovery behaviour. |

Each profile's VU targets and durations scale dynamically via `VUSERS` and `DURATION` env vars. When neither is set, the defaults above are used. See `PROFILE_TEMPLATES` in `lib/config.js` for the multipliers and weights.

## Thresholds

Defined in `stress-chat-flow.js`. A run **fails** (non-zero exit code) if any breaches:

- `http_req_failed: rate<0.05` — overall error rate < 5%.
- `http_req_duration{endpoint:firebase_signup}: p(95)<3s`.
- `http_req_duration{endpoint:preferences}: p(95)<2s`.
- `http_req_duration{endpoint:accept_tc}: p(95)<2s`.
- `http_req_duration{endpoint:personal_data}: p(95)<2s`.
- `http_req_duration{endpoint:chat}: p(95)<15s` (LLM latency is the bottleneck).

Adjust these to match the SLO you're testing against.

## Reading the summary

k6 prints per-endpoint stats because each request is tagged with `endpoint: firebase_signup | preferences | accept_tc | personal_data | chat`. Look for:

- Per-tag `http_req_duration` percentiles — is chat latency stable as VUs ramp?
- `http_req_failed{endpoint:chat}` — rising means the backend is saturating.
- Custom counters `user_flows_started`, `user_flows_completed`, `chat_messages_sent`, `tc_accepted`, `personal_data_submitted`.

## Notes

- `INVITATION_CODE` must be type `LOGIN` (not `REGISTER`). Seed one in the user-invitations collection before running.
- Local backends set `TARGET_ENVIRONMENT_TYPE=local`, which skips JWT signature verification — but the token still needs to parse, and the Firebase API key must be valid for the sign-up call.
- The chat timeout is set to 120s in `lib/backend.js` because under heavy stress the LLM path can exceed the 60s k6 default.
- Reruns consume invitation-code capacity and create real users in the target DB. Use a non-production env.
- Firebase sign-in is cached per VU (module-level state). Each VU calls `signInAnonymously()` on its first iteration and reuses the token for all subsequent iterations. The `firebase_signins` counter in the summary should roughly equal the total number of VUs that were active during the run.

# Analytics Setup Guide (GA4 + GTM)

This guide walks through setting up Google Analytics 4 (GA4) and Google Tag Manager (GTM) for a Compass fork.
The process is largely automated by `backend/scripts/analytics/setup_analytics.py`, but requires a few one-time manual steps first.

## How It Works

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Frontend (React)                                                        │
│                                                                          │
│  gtmInit.ts ── loads GTM snippet at runtime                              │
│       │                                                                  │
│       ├── pushToDataLayer("user_registered", { method: "email" })        │
│       └── pushToDataLayer("user_login", { method: "google" })            │
│                                                                          │
│  dataLayer.push() ──▶ GTM Container ──▶ GA4 Property                     │
│                       (tags/triggers)    (reports/dashboards)            │
└──────────────────────────────────────────────────────────────────────────┘
```

- **GTM** is injected into the frontend at runtime (like Sentry), not via `index.html`.
- **GTM tags** fire GA4 events when custom `dataLayer.push()` calls match configured triggers.
- **GA4** receives the events and makes them available for reporting.
- This is separate from the existing `MetricsService` (which tracks operational metrics to MongoDB).

## Tracked Events

| Event | Parameters | Where |
|-------|-----------|-------|
| `page_view` | `page_location` (virtual URL with hash normalized) | Automatic: initial load + every route navigation |
| `user_registered` | `method`: `"email"` or `"google"` | After successful registration |
| `user_login` | `method`: `"email"`, `"google"`, or `"invitation_code"` | After successful login |

Each fork can extend these events by adding more `pushToDataLayer()` calls in the frontend code and
creating corresponding triggers/tags in GTM (either via the script or manually).

### SPA Page View Tracking (HashRouter)

Compass uses React's `HashRouter`, so URLs look like `https://example.com/#/skills-interests`.
GA4's default page view tracking only sees `/` as the page path because the hash fragment is not
part of the URL path. The setup script handles this automatically by creating:

1. **`Virtual Page URL` variable** — Custom JavaScript that normalizes hash URLs into proper paths
   (e.g., `https://example.com/#/skills-interests` → `https://example.com/skills-interests`)
2. **`History Change - SPA Navigation` trigger** — Fires on every hash change (route navigation)
3. **`GA4 Page View - SPA` tag** — Sends `page_view` events on initial load and every navigation,
   with `page_location` overridden to the virtual URL

The GA4 Config tag has `sendPageView` disabled to avoid duplicate page views.

> **Important:** In your GA4 data stream settings, disable **"Page changes based on browser history
> events"** under Enhanced Measurement → Advanced Settings. This prevents GA4 from sending its own
> `page_view` events (which would have `/` as the path) in addition to the ones from GTM.

## Prerequisites (One-Time Manual Steps)

### 1. Create a GA4 Account

Go to [analytics.google.com](https://analytics.google.com) and create an account (e.g., "Compass Analytics").
One account can hold properties for all forks.

> **Note:** GA4 accounts are free and not tied to GCP billing.

### 2. Create a GTM Account

Go to [tagmanager.google.com](https://tagmanager.google.com) and create an account (e.g., "Compass Tags").
Same pattern: one account, containers per fork.

> **Do NOT** manually create a container — the script creates one automatically.

### 3. Create a GCP Service Account

The automation script authenticates using a GCP service account (not OAuth browser flow).

```bash
# In GCP Console → IAM & Admin → Service Accounts → Create Service Account
# Name: "analytics-setup" (or similar)
# No GCP roles needed — permissions are granted directly in GA4/GTM
# Create a JSON key and download it
```

Or use an existing service account from your GCP project. The key file should be stored
somewhere secure (e.g., `backend/keys/`) and **must not** be committed to git.

### 4. Enable Google APIs

In your GCP project (APIs & Services → Library), enable:

- **Google Analytics Admin API** (`analyticsadmin.googleapis.com`)
- **Tag Manager API** (`tagmanager.googleapis.com`)

### 5. Grant Permissions to the Service Account

Find the service account email (looks like `name@project.iam.gserviceaccount.com`):

**GA4**: Go to analytics.google.com → Admin → Account Access Management → Add the service
account email with **Editor** role.

**GTM**: Go to tagmanager.google.com → Admin → Account-level User Management → Add the service
account email with **Publish** permission.

### 6. Find Your Account IDs

- **GA4 Account ID**: In GA4, go to Admin → Account Settings → the numeric ID at the top.
- **GTM Account ID**: In GTM, go to Admin → the numeric Account ID shown in the header.

## Running the Setup Script

### Install Dependencies

```bash
cd backend/scripts/analytics
pip install -r requirements.txt
```

### Dry Run (Validate Without Creating Resources)

```bash
python3 setup_analytics.py \
  --ga4-account-id <GA4_ACCOUNT_ID> \
  --gtm-account-id <GTM_ACCOUNT_ID> \
  --url "https://your-fork.compass.tabiya.tech" \
  --config ../../../config/default.json \
  --credentials path/to/service_account_key.json \
  --dry-run
```

### Full Run

```bash
python3 setup_analytics.py \
  --ga4-account-id <GA4_ACCOUNT_ID> \
  --gtm-account-id <GTM_ACCOUNT_ID> \
  --url "https://your-fork.compass.tabiya.tech" \
  --property-name "Compass YourFork" \
  --config ../../../config/default.json \
  --credentials path/to/service_account_key.json
```

This will:
1. Create a GA4 property and web data stream
2. Create a GTM container with:
   - GA4 Config tag (fires on all pages)
   - Custom event triggers and tags for `user_registered` and `user_login`
   - SPA page view tracking (Virtual Page URL variable, History Change trigger, GA4 Page View tag)
3. Publish the GTM container
4. Write the generated IDs into `config/default.json`
5. Run `inject-config.py` to propagate IDs to `frontend-new/public/data/env.js`

> **Post-setup:** Disable "Page changes based on browser history events" in your GA4 data stream's
> Enhanced Measurement → Advanced Settings to avoid duplicate page views.

### Resuming After a Failure

The script saves checkpoints to `config/default.json` after each major step. If a step fails,
you can resume from that step using `--step`:

```bash
# Resume from the publish step (GA4 + GTM already created)
python3 setup_analytics.py \
  --ga4-account-id <GA4_ACCOUNT_ID> \
  --gtm-account-id <GTM_ACCOUNT_ID> \
  --url "https://your-fork.compass.tabiya.tech" \
  --config ../../../config/default.json \
  --credentials path/to/service_account_key.json \
  --step publish \
  --gtm-container-path accounts/<GTM_ACCOUNT_ID>/containers/<CONTAINER_ID>
```

Available steps: `ga4`, `gtm`, `spa-tracking`, `publish`, `config`

### Adding SPA Page View Tracking to an Existing Container

If you already have a GTM container (created manually or by a previous run of the script)
and need to add the SPA page view tracking:

```bash
python3 setup_analytics.py \
  --ga4-account-id <GA4_ACCOUNT_ID> \
  --gtm-account-id <GTM_ACCOUNT_ID> \
  --url "https://your-fork.compass.tabiya.tech" \
  --config ../../../config/default.json \
  --credentials path/to/service_account_key.json \
  --step spa-tracking \
  --gtm-container-path accounts/<GTM_ACCOUNT_ID>/containers/<CONTAINER_ID>
```

This creates only the 3 SPA tracking resources (Virtual Page URL variable, History Change trigger,
GA4 Page View tag) in the existing container. After running, publish the container with `--step publish`.

You can also pass existing IDs directly via CLI args:

| Flag | Description |
|------|-------------|
| `--ga4-property-id` | Existing GA4 property ID |
| `--ga4-measurement-id` | Existing measurement ID (e.g., `G-XXXXXXX`) |
| `--gtm-container-id` | Existing GTM container public ID (e.g., `GTM-XXXXXXX`) |
| `--gtm-container-path` | GTM container API path (e.g., `accounts/123/containers/456`) |

## CLI Reference

```
python3 setup_analytics.py --help
```

| Flag | Required | Description |
|------|----------|-------------|
| `--ga4-account-id` | Yes | GA4 account ID (numeric) |
| `--gtm-account-id` | Yes | GTM account ID (numeric) |
| `--url` | Yes | Deployed URL of the fork |
| `--credentials` | Yes | Path to service account JSON key file |
| `--config` | No | Config JSON file (default: `config/default.json` relative to repo root) |
| `--property-name` | No | GA4 property name (defaults to `branding.appName` from config) |
| `--dry-run` | No | Validate inputs without creating resources |
| `--step` | No | Run only a specific step: `ga4`, `gtm`, `publish`, `config` |

## Configuration

After the script runs, `config/default.json` will contain:

```json
"analytics": {
  "ga4AccountId": "387253059",
  "ga4PropertyId": "528078871",
  "ga4MeasurementId": "G-XXXXXXX",
  "gtmAccountId": "6343687890",
  "gtmContainerId": "GTM-XXXXXXX",
  "enabled": true
}
```

These values flow through the config injection pipeline:

```
config/default.json
  → inject-config.py
    → frontend-new/public/data/env.js (base64-encoded)
      → envService.ts (decoded at runtime)
        → gtmInit.ts (reads env vars, loads GTM)
```

### Environment-Specific IDs

Each deployment has its own GA4 property and GTM container to keep analytics data isolated.

| | Development (`dev-njila.compass.tabiya.tech`) | Production (`njila.ai`) |
|---|---|---|
| **GA4 Account ID** | `387253059` | `387253059` |
| **GA4 Property ID** | `528078871` | `532850500` |
| **GA4 Measurement ID** | `G-722MET383C` | `G-BBV5W2M0FB` |
| **GTM Account ID** | `6343687890` | `6343687890` |
| **GTM Container ID** | `GTM-K3QPRR2W` | `GTM-TT62SLCK` |

- `config/default.json` contains the **development** IDs (used for local dev and the dev-njila deployment).
- **Production** IDs are configured via environment variables (`FRONTEND_GTM_CONTAINER_ID`, `FRONTEND_GTM_ENABLED`) in GCP Secret Manager and injected at deploy time by `iac/frontend/prepare_frontend.py`.

### Disabling Analytics

Set `analytics.enabled` to `false` in `config/default.json` and re-run `inject-config.py`.
The frontend will skip GTM initialization entirely.

## Frontend Architecture

### Key Files

| File | Purpose |
|------|---------|
| `frontend-new/src/gtmInit.ts` | Initializes GTM at runtime, exports `pushToDataLayer()` |
| `frontend-new/src/gtmInit.test.ts` | Tests for GTM initialization and dataLayer pushes |
| `frontend-new/src/envService.ts` | `getGtmEnabled()` and `getGtmContainerId()` getters |
| `frontend-new/src/index.tsx` | Calls `initGTM()` at app startup |

### Adding New Events

To track a new event:

1. Add a `pushToDataLayer("event_name", { param: "value" })` call in the relevant frontend code
2. Create a custom event trigger and GA4 event tag in GTM (either via the script or GTM UI)
3. The event will automatically appear in GA4 reports after a few hours

### Event Integration Points

| Event | File | Location |
|-------|------|----------|
| `user_registered` (email) | `src/auth/services/.../emailAuth/FirebaseEmailAuthentication.service.ts` | After `super.onSuccessfulRegistration()` |
| `user_registered` (google) | `src/auth/components/SocialAuth/SocialAuth.tsx` | After `setUserPreferences()` in `registerUser()` |
| `user_login` (email) | `src/auth/services/.../emailAuth/FirebaseEmailAuthentication.service.ts` | After `super.onSuccessfulLogin()` |
| `user_login` (google) | `src/auth/services/.../socialAuth/FirebaseSocialAuthentication.service.ts` | After `super.onSuccessfulLogin()` |
| `user_login` (invitation_code) | `src/auth/services/.../invitationCodeAuth/FirebaseInvitationCodeAuthenticationService.ts` | After `super.onSuccessfulLogin()` |

## Troubleshooting

### Script fails with "No access token in response"
The service account scopes may be incorrect. Ensure the GA4 and GTM APIs are enabled in your GCP project.

### Script fails with 403 "insufficient authentication scopes"
The service account needs the correct permissions in GA4 (Editor) and GTM (Publish).

### Script fails at the publish step
You can resume with `--step publish --gtm-container-path accounts/XXX/containers/YYY`.
Find the container path in the GTM UI (Admin → Container Settings) or from the script's earlier output.

### GTM not loading in the browser
1. Check that `FRONTEND_GTM_ENABLED` is `"true"` in `env.js` (base64 of `"true"` = `"dHJ1ZQ=="`)
2. Check that `FRONTEND_GTM_CONTAINER_ID` has a valid container ID
3. Open browser DevTools Console — look for "GTM is not enabled" or "container ID is not set" messages
4. Check the Network tab for requests to `googletagmanager.com`

### Events not appearing in GA4
1. Use GTM Preview mode (tagmanager.google.com → Preview) to verify tags fire
2. Use GA4 DebugView (analytics.google.com → Admin → DebugView) for real-time event inspection
3. Standard GA4 reports can take 24-48 hours to populate

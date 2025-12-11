# Adding a New Language to Compass

Use this guide to introduce a new locale across the frontend and backend. Locale identifiers follow [IETF BCP 47](https://www.ietf.org/rfc/bcp/bcp47.txt) (e.g., `en-GB`, `es-AR`); keep language in lowercase and region in uppercase.

## Frontend (frontend-new)
- **Translation bundles**: Copy [`frontend-new/src/i18n/locales/en-GB/translation.json`](frontend-new/src/i18n/locales/en-GB/translation.json) to `frontend-new/src/i18n/locales/<locale>/translation.json` and translate values. Keys must stay identical; [`src/i18n/locales/locales.test.ts`](frontend-new/src/i18n/locales/locales.test.ts) checks this.
- **Register the locale**: Update [`frontend-new/src/i18n/constants.ts`](frontend-new/src/i18n/constants.ts) (add to `Locale`, `LocalesLabels`, `SupportedLocales`, and adjust `FALL_BACK_LOCALE` only if the fallback changes).
- **Import Translations and Feedback Questions**: In [`frontend-new/src/i18n/i18n.ts`](frontend-new/src/i18n/i18n.ts), import the new translation JSON and feedback questions JSON files, then add the locale to the `resources` object using `constructLocaleResources()`.
- **Feedback questions**: Add `frontend-new/src/feedback/overallFeedback/feedbackForm/questions-<locale>.json` mirroring the existing files, e.g., [`questions-en-GB.json`](frontend-new/src/feedback/overallFeedback/feedbackForm/questions-en-GB.json).
- **Sensitive data form schema**: Add `frontend-new/public/data/config/fields-<locale>.yaml`; keep the same structure/keys as [`fields-en-GB.yaml`](frontend-new/public/data/config/fields-en-GB.yaml).
- **Environment-driven availability**: Supported locales shown in the UI come from `FRONTEND_SUPPORTED_LOCALES` (JSON array) and default to `FRONTEND_DEFAULT_LOCALE` if parsing fails; see [`parseEnvSupportedLocales.ts`](frontend-new/src/i18n/languageContextMenu/parseEnvSupportedLocales.ts) for validation rules.

## Backend
- **Hardcoded responses/prompts**: Translate backend-facing strings in `backend/app/i18n/locales/<locale>/messages.json`. Use [`en-US/messages.json`](backend/app/i18n/locales/en-US/messages.json) as the reference; [`backend/app/i18n/test_i18n.py`](backend/app/i18n/test_i18n.py) enforces key parity.
- **Supported list**: Add the locale to [`backend/app/i18n/types.py`](backend/app/i18n/types.py) (`Locale` enum and `SUPPORTED_LOCALES`). Update [`backend/app/i18n/constants.py`](backend/app/i18n/constants.py) only if the default fallback changes.
- **Runtime default**: The backend runs with a single default locale set via `BACKEND_DEFAULT_LOCALE` (must be one of `SUPPORTED_LOCALES`); see [`backend/app/server.py`](backend/app/server.py).

## Deployment configuration
- **Add environment variables for the frontend** ([see deployment procedure](./deployment-procedure.md) and [upload to secret manager](./deployment-procedure.md)):
  - `FRONTEND_SUPPORTED_LOCALES`: JSON string array of supported locales, e.g., `["en-GB","es-ES"]`.
  - `FRONTEND_DEFAULT_LOCALE`: Default locale string.
- **Add environment variables for the backend** ([see deployment procedure](./deployment-procedure.md) and [upload to secret manager](./deployment-procedure.md)): `BACKEND_DEFAULT_LOCALE`: Default backend locale (BCP 47).

Keep frontend and backend locale lists aligned; unsupported env values are dropped and fall back to the configured defaults (`FALL_BACK_LOCALE` on the frontend, `BACKEND_DEFAULT_LOCALE` on the backend).

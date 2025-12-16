# Compass Language Guide

This guide is divided into two main parts:

1. **[Adding a New Language](#adding-a-new-language)**: Instructions for introducing a new locale across the backend and frontend.
2. **[Switching or Using Supported Languages](#switching-or-using-supported-languages)** : Guidance for configuring or switching between languages that are already supported.

## Adding a New Language

This section shows how to introduce a new locale end-to-end across the backend and the frontend. It includes what files to add, the expected templates, which configs to update, and how to verify everything.

Locale identifiers follow [IETF BCP 47](https://www.ietf.org/rfc/bcp/bcp47.txt) (e.g., `en-GB`, `es-AR`). Keep language in lowercase and region in uppercase. Keep codes consistent across config and folders.

Notes

* Use BCP‑47 language tags (e.g., `en-GB`, `en-US`, `es-ES`, `es-AR`). Keep codes consistent across config and folders.
* Backend uses locale directories under `backend/app/i18n/locales/<locale>/` with domain JSON files (e.g., `messages.json`).
* Frontend-new uses `frontend-new/src/i18n/locales/<locale>/translation.json` and maps them in [`frontend-new/src/i18n/i18n.ts`](frontend-new/src/i18n/i18n.ts).
* Supported languages are enabled via environment variables on both backend and frontend.

### Prerequisites

* Decide the language code(s) you want to support (e.g., `es-AR`).
* Pick a reference language to copy from (English is recommended):
  - Backend reference: [`backend/app/i18n/locales/en-US/messages.json`](backend/app/i18n/locales/en-US/messages.json)
  - Frontend-new reference: [`frontend-new/src/i18n/locales/en-GB/translation.json`](frontend-new/src/i18n/locales/en-GB/translation.json)

### 1. Backend

The backend uses `LocaleProvider` to determine the current locale. The first language listed in `BACKEND_DEFAULT_LOCALE` is used as the default.

**Important:** The backend looks up translations by the exact locale string returned by `LocaleProvider`; make sure you create a folder matching that code or use a code in `BACKEND_DEFAULT_LOCALE` that matches an existing folder name.

#### 1.1 Create Locale directory and messages file

* Create a folder for your new locale under `backend/app/i18n/locales/<locale>/` and add a `messages.json` file with the same keys as English.
* Translate backend-facing strings in `backend/app/i18n/locales/<locale>/messages.json`. Use [`en-US/messages.json`](backend/app/i18n/locales/en-US/messages.json) as the reference.
* Key consistency is enforced by [`backend/app/i18n/test_i18n.py`](backend/app/i18n/test_i18n.py).

Example 
```
backend/app/i18n/locales/en-US/messages.json     # reference
backend/app/i18n/locales/es-AR/messages.json     # new 
```
For the message structure and keys, please refer to the reference file: [`backend/app/i18n/locales/en-US/messages.json`](backend/app/i18n/locales/en-US/messages.json).

#### 1.2 Update Supported Constants and Environment Variables

  - Add the locale to [`backend/app/i18n/types.py`](backend/app/i18n/types.py) (`Locale` enum and `SUPPORTED_LOCALES`).
  - Update [`backend/app/i18n/constants.py`](backend/app/i18n/constants.py) only if the default fallback changes.
  - Enable the new locale in your backend environment via `BACKEND_DEFAULT_LOCALE`. The first item becomes the default.

#### 1.3 Verify Backend Key Consistency

`I18nManager` can verify that all locales contain the same keys per domain; [`backend/app/i18n/test_i18n.py`](backend/app/i18n/test_i18n.py) enforces key parity.

Optional commands

```bash
cd backend
poetry run python scripts/verify_i18n_keys.py --verify
```

### 2. Frontend 

The frontend uses `i18next` with resources defined in locale files and mapped in [`frontend-new/src/i18n/i18n.ts`](frontend-new/src/i18n/i18n.ts).

#### 2.1 Create the locale folder and translation file

Create a folder for your new locale under `frontend-new/src/locales/<locale>/` and copy the reference `translation.json` from English (`en-GB`). Translate values, keeping all keys identical.

Example
```
frontend-new/src/i18n/locales/en-GB/translation.json   # reference
frontend-new/src/i18n/locales/es-AR/translation.json   # new
```

For the translation structure and keys, please refer to the reference file: [`frontend-new/src/i18n/locales/en-GB/translation.json`](frontend-new/src/i18n/locales/en-GB/translation.json).

* **Add other locale files:**
  - Add `frontend-new/src/feedback/overallFeedback/feedbackForm/questions-<locale>.json` mirroring the existing files, e.g., [`questions-en-GB.json`](frontend-new/src/feedback/overallFeedback/feedbackForm/questions-en-GB.json).
  - Add `frontend-new/public/data/config/fields-<locale>.yaml`; keep the same structure/keys as [`fields-en-GB.yaml`](frontend-new/public/data/config/fields-en-GB.yaml).

#### 2.2 Register Locale Resources

* Update [`frontend-new/src/i18n/constants.ts`](frontend-new/src/i18n/constants.ts) (add to `Locale`, `LocalesLabels`, `SupportedLocales`, and adjust `FALL_BACK_LOCALE` only if the fallback changes).
* Import and register the translation and feedback JSON files in  [`frontend-new/src/i18n/i18n.ts`](frontend-new/src/i18n/i18n.ts).

#### 2.3 Environment Config

Enable the new locale via environment variables:
* `FRONTEND_SUPPORTED_LOCALES`: a JSON array of enabled locale codes (see [`parseEnvSupportedLocales.ts`](frontend-new/src/i18n/languageContextMenu/parseEnvSupportedLocales.ts) for validation rules).
* `FRONTEND_DEFAULT_LOCALE`: default language if user preference not set.

Environment variables are Base64-encoded and read from [`frontend-new/public/data/env.example.js`](frontend-new/public/data/env.example.js).

#### 2.4 Verify Frontend Key Consistency

There is an automated test that ensures all locales share the same keys as English (`en-GB`): [`frontend-new/src/i18n/locales/locales.test.ts`](frontend-new/src/i18n/locales/locales.test.ts).

Optional commands

```bash
cd frontend-new
yarn test -- src/i18n/locales/locales.test.ts
```

### 3. Deployment Configuration

Supported languages are enabled via environment variables on both backend and frontend.

* **Add environment variables for the frontend** ([see deployment procedure](./deployment-procedure.md) and [upload to secret manager](./deployment-procedure.md):
  - `FRONTEND_SUPPORTED_LOCALES`: JSON string array of supported locales, e.g., `["en-GB","es-ES"]`.
  - `FRONTEND_DEFAULT_LOCALE`: Default locale string.

* **Add environment variables for the backend** ([see deployment procedure](./deployment-procedure.md) and [upload to secret manager](./deployment-procedure.md)):
  - `BACKEND_DEFAULT_LOCALE`: Default backend locale (BCP 47).

### 4.  Quick checklist (summary)

* **Backend**
  * [ ] Create `backend/app/i18n/locales/<locale>/messages.json` with the same keys as English
  * [ ] Add the locale code to `BACKEND_DEFAULT_LOCALE`
  * [ ] Add the locale to `backend/app/i18n/types.py` (`Locale` enum and `SUPPORTED_LOCALES`)
  * [ ] Generate embeddings for the new language using the new taxonomy model ID \([Generate Embeddings](./deployment-procedure.md#step-43-generate-embeddings)\)
  * [ ] (Optional) Run backend i18n verify script

* **Frontend-new**
  * [ ] Create `frontend-new/src/i18n/locales/<locale>/translation.json` with the same keys as English (`en-GB`)
  * [ ] Import and register resources in `frontend-new/src/i18n/i18n.ts`
  * [ ] Update `frontend-new/src/i18n/constants.ts` (`Locale`, `LocalesLabels`, `SupportedLocales`)
  * [ ] Add `frontend-new/src/feedback/overallFeedback/feedbackForm/questions-<locale>.json`
  * [ ] Add `frontend-new/public/data/config/fields-<locale>.yaml`
  * [ ] Update `env` config: `FRONTEND_SUPPORTED_LOCALES` and `FRONTEND_DEFAULT_LOCALE`
  * [ ] (Optional) Run the locales consistency test

## Switching or Using Supported Languages

This section explains how to enable or switch between languages that are already supported in Compass.

### Overview

* Supported languages are controlled via environment variables on both backend and frontend.
* Users can select a language from the frontend language menu if it is included in `FRONTEND_SUPPORTED_LOCALES`.

### 1. Backend

* **Default locale:** `BACKEND_DEFAULT_LOCALE` determines the default backend language. The first locale listed is used if no user preference is set.
* **Supported languages:** Listed in the `SUPPORTED_LOCALES` enum in [`backend/app/i18n/types.py`](backend/app/i18n/types.py).
* **Locale determination:** `LocaleProvider` returns the current locale for backend requests. Changing the environment variable or the first locale in `BACKEND_DEFAULT_LOCALE` updates the backend default language.

### 2. Frontend

* **Registered languages:** Defined in [`frontend-new/src/i18n/i18n.ts`](frontend-new/src/i18n/i18n.ts) (translation resources) and [`frontend-new/src/i18n/constants.ts`](frontend-new/src/i18n/constants.ts) (`Locale`, `LocalesLabels`, `SupportedLocales`).
* **Default language:** `FRONTEND_DEFAULT_LOCALE` in `public/data/env.js` sets the default UI language.
* **Switching languages at runtime:** Users can select a language from the UI menu. Only locales listed in `FRONTEND_SUPPORTED_LOCALES` are available. To change the default language in the frontend, update `FRONTEND_DEFAULT_LOCALE` in the environment configuration.

> **Note:** Backend and frontend are not automatically synchronized. To ensure a consistent language across the application, configure both layers to support and use the same language.

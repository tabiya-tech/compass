# Compass Language Guide

This guide is divided into two main parts:

1. **[Adding a New Language](#adding-a-new-language)**: Instructions for introducing a new locale using the automated Google Sheets workflow.
2. **[Switching or Using Supported Languages](#switching-or-using-supported-languages)** : Guidance for configuring or switching between languages that are already supported.

## Adding a New Language

Compass uses an automated translation workflow based on Google Sheets. This allows non-technical users to add translations from a familiar spreadsheet, while developers simply run an import script to automatically apply them to the codebase.

Locale identifiers must follow [IETF BCP 47](https://www.ietf.org/rfc/bcp/bcp47.txt) (e.g., `en-GB`, `es-AR`, `fr-FR`). Keep language codes in lowercase and region codes in uppercase.

### 1. For Translators (Non-Technical)

1. **Open the Compass Translation Sheet:** Access the shared Google Sheet provided by the development team.
2. **Add a New Language Column:** Find the first empty column header after the existing language codes. Type the BCP-47 language code for your new language (e.g., `fr-FR` for French) and press Enter.
   > **Note:** Do NOT modify the `Platform` or `Key` columns, as these are strict technical identifiers required for the application to function and **must only be edited by developers or other authorised maintainers**.
3. **Fill in the Translations:** Scroll through the rows. Use the English (`en-GB` or `en-US`) columns as a reference. Type your translated text into your new column. If you leave a cell blank, the application will automatically fall back to English for that specific text.
4. **Notify the Team:** Once translations are complete, notify the development team to run the import script.

### 2. For Developers (Technical)

Once translations or new keys have been added to the Google Sheet, follow these steps to pull them into the codebase.

> **Supported platforms**
>
> Currently, only three platforms are powered by this workflow:
> - **Frontend** (React app)
> - **Backend** (Python services)
> - **Feedback** (survey/questions content)
>
> Only rows/keys that belong to one of these platforms will be generated. If a *new* platform is ever introduced, the import script must be extended to support it before any keys for that platform will have an effect.

#### 2.1 Run the Import Script

Navigate to the `backend` directory and run the automated import script:

```bash
cd backend
poetry run python scripts/import_translations_from_sheets.py
```

**What this script does:**
* Connects to the Google Sheet and downloads the translation matrices.
* Generates or updates the corresponding JSON files in `frontend-new/src/i18n/locales/`, `backend/app/i18n/locales/`, and `frontend-new/src/feedback/overallFeedback/feedbackForm/`.
* Ensures that **new translation keys** defined in the sheet are created for the supported platforms, and keeps existing keys in sync.
* **Auto-registers the new locale:** It automatically patches the codebase to recognize the new language by modifying:
  * `config/default.json` (Adds locale to `supportedLocales` and injects English fallbacks into `sensitiveData`)
  * `backend/app/i18n/types.py` (Locale enum and `SUPPORTED_LOCALES`)
  * `frontend-new/src/i18n/constants.ts` (Locale enum, `LocalesLabels`, `SupportedLocales`)
  * `frontend-new/src/i18n/i18n.ts` (Import statements and internal resource mapping)

> **When to re-run the script**
>
> Any time the shared translation sheet is updated (new language, updated strings, or new keys), a developer must:
> 1. Re-run `scripts/import_translations_from_sheets.py`.
> 2. Commit the regenerated locale files and configuration changes.
> 3. Deploy the updated services so the changes are visible in all environments.

#### 2.2 Manual Steps Required

While the script handles JSON translations and locale registration, one manual step remains:

1. **Embeddings:** Generate taxonomy embeddings for the new language using the appropriate model ID (see [Generate Embeddings](./deployment-procedure.md#step-43-generate-embeddings)).

#### 2.3 Verify Key Consistency

You can optionally run the automated tests to ensure exact key consistency across platforms:

```bash
# Backend verification
cd backend
poetry run python scripts/verify_i18n_keys.py --verify

# Frontend verification
cd frontend-new
yarn test -- src/i18n/locales/locales.test.ts
```

### 3. Deployment Configuration

Supported languages are enabled via environment variables on both backend and frontend.

* **Add environment variables for the frontend** ([see deployment procedure](./deployment-procedure.md) and [upload to secret manager](./deployment-procedure.md)):
  - `FRONTEND_SUPPORTED_LOCALES`: JSON string array of supported locales, e.g., `["en-GB","es-ES"]`.
  - `FRONTEND_DEFAULT_LOCALE`: Default locale string.

* **Add environment variables for the backend** ([see deployment procedure](./deployment-procedure.md) and [upload to secret manager](./deployment-procedure.md)):
  - `BACKEND_LANGUAGE_CONFIG`: Default backend locale (BCP 47).


## Switching or Using Supported Languages

This section explains how to enable or switch between languages that are already supported in Compass.

### Overview

* Supported languages are controlled via environment variables on both backend and frontend.
* Users can select a language from the frontend language menu if it is included in `FRONTEND_SUPPORTED_LOCALES`.

### 1. Backend

* **Language Config:** `BACKEND_LANGUAGE_CONFIG` determines the default backend language and other configurations.
* **Supported languages:** Listed in the `SUPPORTED_LOCALES` list in [`backend/app/i18n/types.py`](backend/app/i18n/types.py).

### 2. Frontend

* **Registered languages:** Defined in [`frontend-new/src/i18n/i18n.ts`](frontend-new/src/i18n/i18n.ts) (translation resources) and [`frontend-new/src/i18n/constants.ts`](frontend-new/src/i18n/constants.ts) (`Locale`, `LocalesLabels`, `SupportedLocales`).
* **Default language:** `FRONTEND_DEFAULT_LOCALE` in `public/data/env.js` sets the default UI language if no user preference is set.
* **Switching languages at runtime:** Users can select a language from the UI menu. Only locales listed in `FRONTEND_SUPPORTED_LOCALES` are available. To change the default language in the frontend, update `FRONTEND_DEFAULT_LOCALE` in the environment configuration.

> **Note:** Backend and frontend active languages are not automatically synchronized. To ensure a completely consistent language across the application, configure both layers to support and default to the same language.

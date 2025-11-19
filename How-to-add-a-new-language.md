## How to add a new language to Brujula

This guide shows how to add a new language end-to-end across the backend and the new frontend (`frontend-new`). It includes what files to add, the expected templates, which configs to update, and how to verify everything.

Notes
- Use BCP‑47 language tags (e.g., en-gb, en-us, es-es, es-ar, fr-fr). Keep codes consistent across config and folders.
- Backend uses locale directories under `backend/app/i18n/locales/<locale>/` with domain JSON files (e.g., `messages.json`).
- Frontend-new uses `src/locales/<locale>/translation.json` and maps them in `src/i18n/i18n.ts`.
- Supported languages are enabled via environment variables on both backend and frontend.

### Prerequisites
- Decide the language code(s) you want to support (e.g., `es-ar`).
- Pick a reference language to copy from (English is recommended):
  - Backend reference: `backend/app/i18n/locales/en/messages.json`
  - Frontend-new reference: `frontend-new/src/locales/en-gb/translation.json`

---

## 1) Backend changes (FastAPI)

Backend i18n lives in `backend/app/i18n/`. Translations are loaded by `I18nManager` and fetched via `t(domain, key, ...)` from `translation_service.py`. The locale is selected by `get_locale()` in `locale_detector.py` with the following priority:
1. First language in `BACKEND_SUPPORTED_LANGUAGES` env var (highest priority)
2. Locale on the current conversation context (if set)
3. Best effort match from the HTTP `Accept-Language` header
4. Default fallback ("en")

Important: The backend looks up translations by the exact locale string returned by `get_locale()`; make sure you create a folder matching that code or use a code in `BACKEND_SUPPORTED_LANGUAGES` that matches an existing folder name.

### 1.1 Create locale directory and messages file
Create a folder for your new locale under `backend/app/i18n/locales/<locale>/` and add a `messages.json` file with the same keys as English.

Example
```
backend/app/i18n/locales/en/messages.json      # reference
backend/app/i18n/locales/fr/messages.json      # new (primary language)
# Optionally, region-specific variant
backend/app/i18n/locales/fr-fr/messages.json
```

Template for `messages.json` (keep keys identical to English; values are your translations):
```json
{
  "welcome_agent_first_encounter": "…",
  "collect_experiences.did_not_understand": "…",
  "experience.until": "jusqu'à {end_date}"
}
```

Best practice
- Start by copying `backend/app/i18n/locales/en/messages.json` and translating values.
- Keep placeholders unchanged (e.g., `{end_date}`) so formatting still works.

### 1.2 Enable the language via env var
Add or update `BACKEND_SUPPORTED_LANGUAGES` in your backend environment (see `backend/.env.example`). The first item becomes the default locale.

Example
```
BACKEND_SUPPORTED_LANGUAGES='["en","fr"]'
# If you created a region-specific folder, you can target it directly:
# BACKEND_SUPPORTED_LANGUAGES='["fr-fr","en"]'
```

### 1.3 Optional: verify backend key consistency
`I18nManager` can verify that all locales contain the same keys per domain:

Optional commands
```
cd backend
poetry run python app/i18n/i18n_manager.py --verify
```

---

## 2) Frontend changes (frontend-new)

The new UI uses `i18next` with resources defined in `frontend-new/src/locales/<locale>/translation.json` and mapped in `frontend-new/src/i18n/i18n.ts`. Users pick a language from the language menu, which is enabled per environment config.

### 2.1 Create the locale folder and translation file
Add a new folder under `frontend-new/src/locales/<locale>/` and copy the reference `translation.json` from English (`en-gb`) so keys match.

Example
```
frontend-new/src/locales/en-gb/translation.json   # reference
frontend-new/src/locales/fr-fr/translation.json   # new
```

Template for `translation.json` (keep keys identical to English; values are your translations):
```json
{
  "welcome_to_compass": "Bienvenue sur Brujula !",
  "login": "Se connecter",
  "language_selector": "Sélecteur de langue"
}
```

### 2.2 Register the new locale in i18n resources
Open `frontend-new/src/i18n/i18n.ts` and:
- Import your new translation file
- Add it to the `resources` map under the appropriate BCP‑47 code(s). Consider adding both uppercase (e.g., `fr-FR`) and lowercase (`fr-fr`) variants for leniency with detectors/storage.

Example diff (illustrative)
```ts
import fr from "../locales/fr-fr/translation.json";

i18n.init({
  resources: {
    "fr-FR": { translation: fr },
    "fr-fr": { translation: fr },
    // … keep existing entries …
  },
  fallbackLng: DEFAULT_LOCALE,
  …
});
```

### 2.3 Add the language to the language menu (optional but recommended)
Update `frontend-new/src/i18n/languageContextMenu/LanguageContextMenu.tsx` to include a new menu item (text label, id, and action) that calls `i18n.changeLanguage("fr-fr")` (or your code). The item will be disabled unless your environment enables it (see next step).

Example (illustrative)
```ts
{
  id: MENU_ITEM_ID.AUTH_FRENCH_SELECTOR,
  text: MENU_ITEM_TEXT.FRENCH,
  disabled: !supportedLanguages.includes("fr-fr"),
  action: () => changeLanguage("fr-fr"),
}
```

### 2.4 Enable the language via environment config
`frontend-new` reads environment variables from `public/data/env.js`. All values must be Base64-encoded.

Update or add:
- `FRONTEND_SUPPORTED_LANGUAGES`: a JSON array of enabled locale codes
- `FRONTEND_DEFAULT_LOCALE`: default UI language if user preference not set

Example (`frontend-new/public/data/env.js`)
```js
window.tabiyaConfig = {
  // …other settings…
  FRONTEND_SUPPORTED_LANGUAGES: btoa(JSON.stringify(["en-gb","en-us","fr-fr"])),
  FRONTEND_DEFAULT_LOCALE: btoa("en-gb"),
};
```

Notes
- `src/envService.ts` decodes the values at runtime.
- Keep the codes aligned with what you registered in `i18n.ts`.

### 2.5 Verify frontend key consistency
There is an automated test that ensures all locales share the same keys as English (`en-gb`): `frontend-new/src/i18n/locales.test.ts`.

Optional commands
```
cd frontend-new
yarn test -t "i18n locales consistency"
```

---

## 3) Quick checklist (summary)
- Backend
  - [ ] Create `backend/app/i18n/locales/<locale>/messages.json` with the same keys as English
  - [ ] Add the locale code to `BACKEND_SUPPORTED_LANGUAGES` (first item becomes default)
  - [ ] (Optional) Run backend i18n verify script
- Frontend-new
  - [ ] Create `frontend-new/src/locales/<locale>/translation.json` with the same keys as English (`en-gb`)
  - [ ] Import + register resources in `frontend-new/src/i18n/i18n.ts`
  - [ ] Add a menu entry in `LanguageContextMenu.tsx` (optional but recommended)
  - [ ] Update `public/data/env.js`: `FRONTEND_SUPPORTED_LANGUAGES` and `FRONTEND_DEFAULT_LOCALE`
  - [ ] (Optional) Run the locales consistency test

---

## 4) Tips, pitfalls, and conventions
- Keep keys consistent. Do not rename keys between languages; translate only the values.
- Preserve placeholders such as `{end_date}` and ICU style `{{variable}}` exactly.
- Align codes across layers:
  - If backend `get_locale()` returns `fr-fr` you need a `backend/app/i18n/locales/fr-fr/` folder (or change the env to return `fr`).
  - Frontend resources must be registered with the same code you will pass to `i18n.changeLanguage()`.
- Default languages
  - Backend: first item in `BACKEND_SUPPORTED_LANGUAGES` wins.
  - Frontend: `FRONTEND_DEFAULT_LOCALE` in `env.js`.
- Region variants: You can support both primary (`fr`) and region-specific (`fr-fr`) on the backend by providing both folders. On the frontend, add both entries to `resources` (upper + lower case) if needed.

---

## 5) Minimal templates

Backend `messages.json`
```json
{
  "welcome_agent_first_encounter": "…",
  "collect_experiences.final_message": "…",
  "experience.until": "jusqu'à {end_date}"
}
```

Frontend `translation.json`
```json
{
  "welcome_to_compass": "Bienvenue sur Brujula !",
  "login": "Se connecter",
  "language_selector": "Sélecteur de langue"
}
```

---

## 6) Where things live (reference)
- Backend
  - Loader: `backend/app/i18n/i18n_manager.py`
  - Translator: `backend/app/i18n/translation_service.py` (function: `t(domain, key, ...)`)
  - Locale detection: `backend/app/i18n/locale_detector.py`
  - Locales: `backend/app/i18n/locales/<locale>/messages.json`
  - Env: `BACKEND_SUPPORTED_LANGUAGES` in backend environment
- Frontend-new
  - i18n init: `frontend-new/src/i18n/i18n.ts`
  - Locales: `frontend-new/src/locales/<locale>/translation.json`
  - Default locale constant: `frontend-new/src/i18n/constants.ts` (value from env)
  - Language menu: `frontend-new/src/i18n/languageContextMenu/LanguageContextMenu.tsx`
  - Env provider: `frontend-new/src/envService.ts`
  - Env file example: `frontend-new/public/data/env.example.js`

If you also maintain the old Next.js POC in `frontend`, note it does not currently implement the full i18n flow; new language work targets `frontend-new`.

---

That’s it — add your locale files, wire them up in config, and verify with the built-in checks. If you need help aligning codes across layers or planning a gradual rollout, add notes near the env configs explaining the intended default and allowed languages.

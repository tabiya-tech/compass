## How to add a new language to Brújula

This guide covers adding a new language to both the backend and `frontend-new`. Use BCP-47 language tags (e.g., `en-GB`, `es-AR`) consistently.

### 1. Backend

1.  **Create Locale Files**:
    *   Copy `backend/app/i18n/locales/en-US/messages.json` to `backend/app/i18n/locales/<your-locale>/messages.json`.
    *   Translate the values, keeping keys and placeholders (e.g., `{end_date}`) identical.

2.  **Enable Language**:
    *   Add your locale code to `BACKEND_DEFAULT_LOCALE` in your backend `.env` file (e.g., `BACKEND_DEFAULT_LOCALE='en-US'`). The first item is the default.

3.  **Verify** (Optional):
    *   Run `poetry run python app/i18n/i18n_manager.py --verify` in the `backend` directory to check for missing keys.

### 2. Frontend (`frontend-new`)

1.  **Create Locale Files**:
    *   Copy `frontend-new/src/locales/en-GB/translation.json` to `frontend-new/src/locales/<your-locale>/translation.json`.
    *   Translate the values.

2.  **Register Locale**:
    *   In `frontend-new/src/i18n/i18n.ts`, import your new `translation.json` and add it to the `resources` map (include both case variants if needed, e.g., `fr-FR` and `fr-fr`).

3.  **Update Language Menu**:
    *   In `frontend-new/src/i18n/languageContextMenu/LanguageContextMenu.tsx`, add a new menu item pointing to your locale.

4.  **Enable Configuration**:
    *   Update `public/data/env.js` (or your environment variable provider).
    *   Add the locale to `FRONTEND_SUPPORTED_LOCALES` (JSON array, base64 encoded).
    *   Update `FRONTEND_DEFAULT_LOCALE` if this should be the default (base64 encoded).

5.  **Verify** (Optional):
    *   Run `yarn test -- src/i18n/locales/locales.test.ts` in `frontend-new` to ensure key consistency.

### 3. Evaluation Tests

To test with a specific locale in python tests, use `CustomProvider`:

```python
from app.i18n.translation_service import get_i18n_manager
from app.i18n.locale_provider import CustomProvider

# ... inside your test ...
get_i18n_manager().set_locale(CustomProvider("es-AR"))
```


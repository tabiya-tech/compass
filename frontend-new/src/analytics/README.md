# Analytics Identity Flow

This app sets GA4 `user_id` through GTM using the registration code for secure-link users and the internal user id for everyone else.

**What we store**
- `sessionStorage` holds `analytics_user_identity` plus any pending `registration_code` captured from URL query (`captureRegistrationCodeFromUrl`).
- `StoredIdentity` includes `user_id`, `identifier_type` (`registration_code` or `user_id`), optional `registration_code`, source, and timestamp.

**When we set identity**
- **Login/refresh:** `resolveAndSetUserIdentity` runs in `Authentication.service` using the authenticated user profile (prefers profile `registration_code`, falls back to pending code, otherwise legacy `user_id`).
- **Email registration:** After Firebase registration completes, we call `setUserIdentityFromAuth({ registrationCode: codeToUse, source: "secure_link" })` before `registration_complete` is fired.
- **Google registration:** `SocialAuth` sets identity right after preferences are created, before `registration_complete` fires.

**DataLayer events**
- `user_identity_set`: `user_id` + `identifier_type` (and `registration_code` when present) pushed via `pushToDataLayer`; GTM GA4 config must map User-ID to the `user_id` dataLayer variable.
- `user_identity_cleared`: pushed on logout to avoid cross-user leakage.

**Guardrails**
- We warn when `user_id` is missing or mismatched with `registration_code`.
- Identity is session-scoped; logout clears stored identity.

# Quickstart - Invite Code Tracking

1. **Frontend (frontend-new)**
   - Parse `reg_code` from registration/report URLs; persist latest to `localStorage.registrationCode` (last-link-wins).
   - Auto-fill and lock the invitation/registration code field; show toast confirming applied code; keep legacy shared code flow when no link code.
   - On submit (Google or email), include `registration_code` with signup payload; prevent submission if validation fails.
   - Push `registration_code` into data layer on page land and registration complete; log on failure without blocking.

2. **Backend (FastAPI)**
   - Reuse `GET /user-invitations/check-status` for validation; ensure personalized invites have `allowed_usage=1` and are time-valid.
   - On successful registration, persist `registration_code` on the user record and decrement `remaining_usage`; reject if already consumed.
   - Ensure report lookup can resolve by `registration_code` alongside token; when no personalized code exists (shared/default invite), allow fallback lookup by `user_id` with token.

3. **Testing**
   - Backend: `poetry run pytest -v` (plus targeted tests for invitation validation/uniqueness).
   - Frontend: `yarn test`, `yarn lint`, `yarn test-storybook` for accessibility; validate auto-fill, lock, last-link-wins, and analytics payloads.
   - Full gate: `./run-before-merge.sh`.

4. **Operational notes**
   - Use neutral label "registration code" in UI to avoid DNI exposure.
   - Keep existing shared invitation code intact for users without personalized links.

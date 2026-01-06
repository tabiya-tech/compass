# Quickstart - Invite Code Tracking

1. **Frontend (frontend-new)**
   - Parse `reg_code` from registration/report URLs; persist latest to `localStorage.registrationCode` (last-link-wins).
   - Auto-fill and lock the invitation/registration code field; show toast confirming applied code; keep legacy shared code flow when no link code (users manually type the shared invitation code only in this path).
   - On submit (Google or email), include `registration_code` with signup payload; prevent submission if validation fails.
   - Push `registration_code` into data layer on page land and registration complete; log on failure without blocking.

2. **Backend (FastAPI)**
   - Validate secure links by verifying the `report_token` and checking whether the requested `reg_code` is already claimed in user data; if unclaimed, allow the signup without requiring a pre-existing invitation row.
   - Continue to support manual/shared invitation flows by calling `/user-invitations/check-status` when no secure token is present; treat the shared invitation code as unlimited and never decrement invitation capacity in this legacy path.
   - On successful registration, persist `registration_code` on the user record and append/update the SecureLink claim log (store `invitation_code=registration_code` to satisfy the collection’s unique index) so subsequent attempts with the same code are rejected; maintain report lookup that prefers `registration_code` with token, falling back to `user_id` for legacy users.

3. **Testing**
   - Backend: `poetry run pytest -v` (plus targeted tests for invitation validation/uniqueness).
   - Frontend: `yarn test`, `yarn lint`, `yarn test-storybook` for accessibility; validate auto-fill, lock, last-link-wins, and analytics payloads.

4. **Operational notes**
   - Use neutral label "registration code" in UI to avoid DNI exposure.
   - Keep existing shared invitation code intact for users without personalized links.
   - Legacy `frontend/` folder is off-limits; all work stays in backend/ and `frontend-new/`.

# Research Findings - Invite Code Tracking

## Decision 1: Neutral code parameter and label
- **Decision**: Use a neutral query param (e.g., `reg_code`) and display label "registration code" instead of DNI wording in the UI.
- **Rationale**: Avoid exposing PII terms while keeping the link self-descriptive for admins and users.
- **Alternatives considered**: Keep `dni` in the URL (rejected due to PII leakage); use opaque GUIDs (rejected because admins need human-friendly codes).

## Decision 2: Enforce single-use via invitation capacity
- **Decision**: For per-user links, create invitations with `allowed_usage=1` and rely on existing `/user-invitations/check-status` plus `reduce_capacity` on successful signup; treat the code as invalid when remaining_usage reaches 0.
- **Rationale**: Reuses existing invitation infrastructure and avoids new uniqueness tables while satisfying "one code per user".
- **Alternatives considered**: New uniqueness table keyed by code (adds schema/ops overhead); allowing reuse with backend dedupe (fails requirement to block second registrations).

## Decision 3: Persist code on user and invitation records
- **Decision**: Store the applied registration code on the invitation record (existing) and on user data (user profile/preferences) at registration time; code becomes the external identifier for reports.
- **Rationale**: Ensures downstream lookups (reports, analytics) can correlate to the user without relying on random `user_id` alone.
- **Alternatives considered**: Only store on invitation (would require joining by historical usage logs); only store on client (breaks backend/report flows).

## Decision 4: Client persistence with last-link-wins
- **Decision**: Persist the latest link code in `localStorage` (key `registrationCode`) when arriving via URL; auto-fill and lock the field; if a newer link is opened, overwrite the stored value.
- **Rationale**: Meets requirement to survive navigation and to treat the latest admin link as source of truth.
- **Alternatives considered**: Session storage (lost on tab close); cookies (heavier policy surface, not needed); allowing manual edits (breaks integrity requirement).

## Decision 5: Analytics payloads include registration code
- **Decision**: Push `registration_code` into the data layer for `first_visit` (page land) and `registration_complete` events; if the data layer is unavailable, log and continue signup.
- **Rationale**: Satisfies tracking requirement without blocking registration; non-blocking handling avoids user impact during GA/GTM outages.
- **Alternatives considered**: Blocking on analytics availability (hurts UX); omitting first_visit payload (loses visit coverage).

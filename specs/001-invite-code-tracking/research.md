# Research Findings - Invite Code Tracking

## Decision 1: Neutral code parameter and label
- **Decision**: Use a neutral query param (e.g., `reg_code`) and display label "registration code" instead of DNI wording in the UI.
- **Rationale**: Avoid exposing PII terms while keeping the link self-descriptive for admins and users.
- **Alternatives considered**: Keep `dni` in the URL (rejected due to PII leakage); use opaque GUIDs (rejected because admins need human-friendly codes).

## Decision 2: Enforce single-use via secure-link claims (token + user data)
- **Decision**: Treat the admin/report token as authorization to mint arbitrary codes. When a secure link arrives, check whether the code has already been claimed in user data; if not, allow registration and persist the claim. Manual/shared invitation codes still pass through the legacy invitation check.
- **Rationale**: Removes the need for admins to seed Mongo while still preventing duplicates—the system becomes source of truth for claimed codes.
- **Alternatives considered**: Requiring per-code invitations (impractical for admins), or letting duplicates through and reconciling later (breaks reporting integrity).

## Decision 3: Persist code on user data + claim log
- **Decision**: Store the applied registration code on user data (user profile/preferences) and create/append a SecureLinkCodeClaim entry for auditing/report lookup; invitation documents become optional for tokenized links.
- **Rationale**: Keeps backend as single source of truth without requiring additional admin tooling.
- **Alternatives considered**: Requiring invitation audit trails only (needs manual ops); storing solely on client (breaks reporting).

## Decision 4: Client persistence with last-link-wins
- **Decision**: Persist the latest link code in `localStorage` (key `registrationCode`) when arriving via URL; auto-fill and lock the field; if a newer link is opened, overwrite the stored value.
- **Rationale**: Meets requirement to survive navigation and to treat the latest admin link as source of truth.
- **Alternatives considered**: Session storage (lost on tab close); cookies (heavier policy surface, not needed); allowing manual edits (breaks integrity requirement).

## Decision 5: Analytics payloads include registration code
- **Decision**: Push `registration_code` into the data layer for `first_visit` (page land) and `registration_complete` events; if the data layer is unavailable, log and continue signup.
- **Rationale**: Satisfies tracking requirement without blocking registration; non-blocking handling avoids user impact during GA/GTM outages.
- **Alternatives considered**: Blocking on analytics availability (hurts UX); omitting first_visit payload (loses visit coverage).

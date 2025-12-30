# Feature Specification: Invite Code Tracking

**Feature Branch**: `001-invite-code-tracking`  
**Created**: 2025-12-30  
**Status**: Draft  
**Input**: Admins need personalized registration links carrying a per-user code (DNI alias) that auto-fills the invitation code, enforces uniqueness, and supports analytics/report lookup.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register via personalized link (Priority: P1)

Admin shares a link with a per-user code; the invite field auto-fills, is locked, and the user completes signup (Google or email) with that code stored for reporting and analytics.

**Why this priority**: Core value is tying each user to a human-friendly external identifier for reports and tracking; must work for all sign-up methods.

**Independent Test**: Open a code-based registration link, complete signup with either Google or email, and verify the code is locked, stored on the user, and analytics receive the code.

**Acceptance Scenarios**:

1. **Given** a valid code in the registration URL, **When** the page loads, **Then** the invitation code field is auto-filled, locked, and a toast confirms the unique code was applied.
2. **Given** an unused code provided via link, **When** the user completes signup with Google or email, **Then** the code is stored on the invitation record and user data and is available for later report lookup and analytics.
3. **Given** a code already bound to another registered user, **When** a different user attempts to register with that code, **Then** registration is blocked with a clear message and no new account is created.

---

### User Story 2 - Resume or switch link with persistence (Priority: P2)

A user lands on /register with a code, leaves, and returns or opens a newer link; the last link code persists and auto-fills without manual editing.

**Why this priority**: Prevents code loss when users navigate away and ensures the most recent admin link is the source of truth.

**Independent Test**: Visit a link with Code A, navigate away, then visit a link with Code B and return to /register; confirm Code B overrides and remains locked from storage.

**Acceptance Scenarios**:

1. **Given** a user landed with Code A and left the page, **When** they return to /register, **Then** Code A reappears from storage and remains locked.
2. **Given** a user later opens a link containing Code B, **When** they reach /register, **Then** Code B replaces Code A as the stored and displayed code, and Code A is no longer used for registration.

---

### User Story 3 - Admin views report by code or fallback (Priority: P3)

An admin uses either the personalized registration code or, if the user registered without one, a fallback identifier to retrieve that user’s skills report with the existing token mechanism.

**Why this priority**: Enables admins to reference reports with the same human-friendly code they distributed for signup, while still allowing access to users created under the shared/default invitation code.

**Independent Test**: Open a report link containing a valid code (or fallback id) and token; confirm the report corresponds to the registered user, and invalid identifiers return a clear error.

**Acceptance Scenarios**:

1. **Given** a report URL containing a valid registration code and token, **When** the admin opens it, **Then** the report shown matches the user registered with that code.
2. **Given** a report URL with an unknown or unassigned registration code, **When** the admin opens it, **Then** the page shows an error or empty state without exposing other users’ data.
3. **Given** a user registered without a personalized code, **When** the admin opens a report URL using the fallback identifier (e.g., user_id) plus token, **Then** the correct report is returned.

---

### Edge Cases

- Missing code in URL: default invitation code flow remains available and editable.
- Invalid code format or length: surface an error and keep registration blocked until a valid code is provided via link.
- Code already used: block registration and prompt the user to request a new link.
- Multiple links visited: the most recent link overrides previously stored codes (last link wins).
- Local storage unavailable or cleared: registration still works with default invitation code; link-based code may need to be reloaded from the URL.
- Report retrieval for users without personalized codes: allow fallback identifier lookup (e.g., user_id) with token to disambiguate users sharing the default invitation code.
- Analytics unavailable at load time: proceed with registration and retry/queue analytics payload or log the failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Accept a code parameter on registration and report URLs (displayed to users as a neutral label such as "registration code" instead of DNI) and treat it as the external identifier for that user.
- **FR-002**: On landing at /register with a code, auto-fill the invitation code field with that code, display a toast confirming it was applied, and keep the field non-editable while a link code is present.
- **FR-003**: Persist the latest link-supplied code in client storage so returning users see it pre-filled; when a new link is opened, the new code replaces the stored one (last link wins).
- **FR-004**: Carry the code through both email/password and Google signup flows so that the same code is stored on the invitation record and user data upon successful registration.
- **FR-005**: Enforce uniqueness: once a code is bound to a registered user, block additional registrations with that code and surface a clear error state without creating accounts.
- **FR-006**: Retain the existing shared invitation code flow for users without a link code; when no code is present in the URL or storage, allow manual entry as today.
- **FR-007**: Attach the code used at registration to user data (e.g., preferences/profile) and the invitation record so it can be referenced for reporting and downstream processes.
- **FR-008**: Push the code into the analytics data layer (e.g., for first-visit and registration-complete events) so unique users can be tracked via GA/GTM.
- **FR-009**: Validate code availability during registration (format and unused status) before account creation; if invalid or already used, prevent submission and instruct the user to obtain a new link.
- **FR-010**: When a report URL is opened with a code and token, resolve the report corresponding to that code; if the code is unknown, show an error or empty state without leaking other data. When no personalized code exists (shared/default invite), allow a fallback identifier (e.g., user_id) with token to fetch the correct report.
- **FR-011**: Log or surface operational errors (e.g., analytics push failures, code validation failures) for support without exposing sensitive identifiers to end users.
- **FR-012**: Ensure code handling does not depend on the random internal `user_id`; external code remains the primary admin-facing identifier for links, reports, and analytics.

### Key Entities *(include if feature involves data)*

- **Registration Code**: Human-friendly external identifier delivered via link; attributes include raw code value, display label, source (link or manual), and status (unused, claimed, blocked).
- **Registration Session**: Client context capturing the incoming code, storage state, authentication path (Google or email), and validation results.
- **User Profile**: User data that stores the applied registration code and invitation details for later reporting and analytics correlation.
- **Analytics Event**: Events such as first-visit and registration-complete carrying the registration code for attribution.

### Assumptions

- The user-facing label for the code will be "registration code" (or similar) to avoid exposing DNI terminology.
- The existing shared invitation code remains valid and unchanged for users without a personalized link.
- Report token handling stays as currently implemented; this feature only aligns report lookup to the registration code.
- GA/GTM data layer is available; if it is not, registration proceeds and failures are logged for later inspection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of users arriving via a coded link see the registration code auto-filled and locked within 1 second of page load.
- **SC-002**: 100% of attempted duplicate registrations with an already-claimed code are blocked before account creation.
- **SC-003**: 95% of completed registrations from coded links emit analytics events that include the registration code attribute.
- **SC-004**: 100% of report URL visits with a valid registration code or fallback identifier and token return the matching user’s report; invalid identifiers return a clear error with no data leakage.

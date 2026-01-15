# Feature Specification: GA4 Registration Code Tracking

**Feature Branch**: `001-ga4-registration-tracking`  
**Created**: 2026-01-14  
**Status**: Draft  
**Input**: Implement user event tracking in GA4 filtered by registration code for secure link signup flow. Scenario: users arrive via secure links containing a `registration_code`, register and log in, then trigger app events; legacy manual invite code users stay tracked by internal `user_id`. Track standard and custom GA4 events with timestamps/parameters, enable GA4 User Explorer filtering by `registration_code`, and allow export (e.g., BigQuery) with identifier, event_name, event_timestamp, and event_params for later joins to internal PII.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Secure-link registrant events carry registration_code (Priority: P1)

Users arriving via a secure link with a `registration_code` can register/log in and have every subsequent app event tied to that code for the full journey.

**Why this priority**: Core value is being able to attribute engagement and activation to specific invitations distributed via secure links.

**Independent Test**: Register via a secure link and verify GA4 (or export) shows a single journey with the same `registration_code` across registration, login, chat, and navigation events.

**Acceptance Scenarios**:

1. **Given** a new user opens a secure link containing a valid `registration_code`, **When** they register and log in through that flow, **Then** all subsequent GA4 events include that `registration_code` as the user identifier.
2. **Given** the same user returns after logging out and back in, **When** they trigger standard or custom events, **Then** the events continue to carry the original `registration_code` without dropping or changing it.

### User Story 2 - Legacy invite tracking stays on internal user_id (Priority: P2)

Legacy users who register with manual invite codes continue to have events attributed to their internal `user_id`, not a `registration_code`.

**Why this priority**: Prevents regressions in existing analytics and keeps historical reporting intact for legacy cohorts.

**Independent Test**: Complete registration with a manual invite code and confirm events appear with `user_id` and without any `registration_code` value.

**Acceptance Scenarios**:

1. **Given** a user registers via the legacy manual invite flow, **When** they log in and interact with the app, **Then** GA4 events include their internal `user_id` and omit `registration_code`.

### User Story 3 - Analysts can filter and export journeys by registration_code (Priority: P3)

Analysts can view per-invite journeys in GA4 User Explorer and export event data that includes identifier, event_name, event_timestamp, and event_params for reconciliation with internal PII.

**Why this priority**: Enables downstream reporting, fraud checks, and ROI analysis by invite channel.

**Independent Test**: In GA4 User Explorer, filter by a known `registration_code` to see a chronological journey, then export data and verify rows include identifier, event_name, event_timestamp, and event_params for that code.

**Acceptance Scenarios**:

1. **Given** events exist for a secure-link registrant, **When** an analyst filters GA4 User Explorer by that `registration_code`, **Then** the ordered event timeline is visible with correct event names and times.
2. **Given** an export (e.g., via BigQuery) is run for that `registration_code`, **When** the dataset is downloaded, **Then** each row contains the identifier (`registration_code` or `user_id`), event_name, event_timestamp, and event_params.

---

### Edge Cases

- Secure link is opened without a `registration_code` param or with an expired/invalid code: user should not be mis-attributed; events must default to legacy identifiers only after explicit legacy registration.
- User switches device or browser after registering via secure link: identifier should persist after login so the journey remains tied to the same `registration_code`.
- Multiple secure links are opened before registration completes: the system should prefer the code actually used for registration and avoid mixing codes across the same user.
- Analytics pipeline delay or retry sends events out of order: exports and timelines should rely on stored timestamps to maintain chronological order.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: Capture the `registration_code` from the secure link at registration time and associate it with the new user’s profile for ongoing attribution.
- **FR-002**: Ensure every GA4 event emitted by secure-link registrants (standard and custom) includes the associated `registration_code` as the primary user identifier across sessions.
- **FR-003**: Preserve event timestamps and existing event parameters when adding the identifier so downstream ordering and analysis are unaffected.
- **FR-004**: Continue to attribute legacy manual-invite users with their internal `user_id` only, without attaching any `registration_code` value.
- **FR-005**: Prevent mixing identifiers: a user linked to a `registration_code` must not also emit events with a different code or with only `user_id`, and legacy users must not emit `registration_code` values.
- **FR-006**: Surface journeys in GA4 User Explorer that can be filtered by `registration_code`, showing event names and times for that identifier.
- **FR-007**: Provide exports (e.g., via GA4 → BigQuery) that include per-event columns: identifier (`registration_code` for secure-link users or `user_id` for legacy), event_name, event_timestamp, and event_params.
- **FR-008**: Validate data quality with monitoring that flags missing or conflicting identifiers on events for both secure-link and legacy flows.

### Key Entities *(include if feature involves data)*

- **Registration Code**: Unique token delivered in secure links; associated with a single invited user and used as the analytics identifier for that cohort.
- **User Identifier**: The value attached to events—`registration_code` for secure-link registrants or internal `user_id` for legacy users.
- **GA4 Event**: Standard or custom analytics event carrying event_name, event_timestamp, event_params, and the user identifier.
- **User Journey Export**: Dataset of ordered events for a single identifier, used for analysis and reconciliation with internal PII.

### Assumptions

- Secure-link registration always includes a valid `registration_code` parameter when the link is correct.
- GA4 and BigQuery connectors are available and already provisioned; this feature focuses on correct identifiers and data completeness.
- Legacy invite code flows remain unchanged aside from verifying identifiers on emitted events.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 100% of events generated by secure-link registrants carry the correct `registration_code` identifier across registration, login, and post-login sessions.
- **SC-002**: 0% of legacy manual-invite events include a `registration_code`, and 100% include the correct internal `user_id`.
- **SC-003**: In GA4 User Explorer, filtering by a known `registration_code` returns the full ordered journey within $5$ seconds for at least the latest $30$ days of data.
- **SC-004**: BigQuery exports produce per-event rows with identifier, event_name, event_timestamp, and event_params, with less than $1\%$ of rows missing the identifier over a rolling $30$-day window.

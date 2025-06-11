## Session Analysis CSV Column Reference

This file describes the meaning of each column in the exported session analysis data.

---

### Basic Session Data

| Column                            | Description                                                                                                                  |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| `session_id`                      | Unique identifier for the session                                                                                            |
| `user_id`                         | Anonymized user ID                                                                                                           |
| `user_created_at`                 | Timestamp when the user account was created(in case this can't be found we use the time when the conversation was conducted) |
| `user_gave_pii`                   | Whether the user ever provided PII (e.g. name, age, etc.)                                                                    |
| `accepted_terms_and_conditions`   | Whether the user accepted the T&Cs                                                                                           |
| `user_never_started_conversation` | Whether the user never got past the onboarding steps (terms and conditions and PII)                                          |
| `has_multiple_sessions`           | Whether this user had more than one session                                                                                  |
| `compass_version`                 | Version of Compass based on session time                                                                                     |
| `user_messages`                   | Number of real (non-silent, non-artificial) messages from the user                                                           |
| `agent_messages`                  | Number of messages from the agent                                                                                            |
| `counseling_messages`             | Number of messages during the counseling phase                                                                               |
| `discovered_experiences`          | Number of experiences mentioned by the user                                                                                  |
| `explored_experiences`            | Number of experiences that were explored (dive-in = PROCESSED)                                                               |
| `current_phase`                   | Most recent conversation phase (e.g. INTRO, COUNSELING, DIVE_IN, ENDED)                                                      |
| `conversation_started_at`         | Timestamp when the conversation started                                                                                      |
| `last_message_at`                | Timestamp of the last message in the session                                                                                 |
---
### User demographics information

| Column                          | Description                                                                 |
|----------------------------------|-----------------------------------------------------------------------------|
| `gender`                       | User-reported or inferred gender (if available)                             |
| `age`                          | User's age (if available)                                                   |
| `education_status`             | Education level or status (if available)                                    |
| `main_activity`                | Main activity (e.g. working, studying) at the time of the session            |
| `conversation_link`            | SharePoint link to the session transcript (if the user gave no PII)         |

---

### User groups

These are computed booleans based on the user's session behavior.

| Column                              | Description                                                                 |
|-------------------------------------|-----------------------------------------------------------------------------|
| `is_never_left_intro`               | User stopped at the INTRO phase                                            |
| `is_counseling_but_no_messages`     | Counseling started, but user didn’t reply                                  |
| `is_counseling_but_no_discovered`   | User entered counseling but didn’t discover any experiences                |
| `is_discovered_but_no_explored`     | User discovered at least one experience but explored none                  |
| `is_explored_1_but_not_completed`   | User explored exactly one experience but didn’t finish                     |
| `is_explored_gt1_but_not_complete`  | User explored multiple experiences but didn’t finish                       |


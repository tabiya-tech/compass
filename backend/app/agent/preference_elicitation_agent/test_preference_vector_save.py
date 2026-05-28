"""
DEPRECATED: These tests are obsolete after fixing the dependency injection issue.

The PreferenceElicitationAgent no longer saves to JobPreferences directly.
Instead, ConversationService handles the save with proper dependency injection.

See:
- app/conversations/service.py: _save_preference_vector_to_job_preferences()
- app/conversations/routes.py: get_conversation_service() dependency injection

Testing Strategy:
- The agent focuses on conversation logic and updates state
- ConversationService detects when preference elicitation completes (COMPLETE phase)
- ConversationService saves to JobPreferences using injected service

For integration tests of this flow, see:
- test_integration.py (tests full agent flow)
- Integration tests that verify ConversationService properly saves preferences

This file is kept for reference but tests are disabled.
"""

import pytest


@pytest.mark.skip(reason="Agent no longer saves directly - ConversationService handles this")
def test_deprecated():
    """
    These tests are obsolete after architectural fix.

    The dependency injection pattern was incorrect - the agent was trying to call
    get_job_preferences_service() outside of FastAPI's request context, which doesn't work.

    Fix: ConversationService now handles the save with proper dependency injection.
    """
    pass

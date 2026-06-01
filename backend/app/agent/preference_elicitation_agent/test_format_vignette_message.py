"""
Unit tests for PreferenceElicitationAgent._format_vignette_message.

Covers:
- Transition sentence when category changes between vignettes
- "Different angle" sentence when category stays the same
- No transition sentence on the first vignette (previous_category=None)
- Options rendered with title and description
- Closing prompt always present
"""

import pytest
from unittest.mock import MagicMock, patch

from app.agent.preference_elicitation_agent.agent import PreferenceElicitationAgent
from app.agent.preference_elicitation_agent.types import Vignette, VignetteOption


@pytest.fixture
def agent():
    """Agent instance with all external dependencies mocked out."""
    with patch(
        "app.agent.preference_elicitation_agent.agent.GeminiGenerativeLLM"
    ), patch(
        "app.agent.preference_elicitation_agent.agent.VignetteEngine"
    ), patch(
        "app.agent.preference_elicitation_agent.agent.UserContextExtractor"
    ), patch(
        "app.agent.preference_elicitation_agent.agent.PreferenceExtractor"
    ), patch(
        "app.agent.preference_elicitation_agent.agent.ExperiencePreferenceExtractor"
    ), patch(
        "app.agent.preference_elicitation_agent.agent.MetadataExtractor"
    ):
        return PreferenceElicitationAgent()


@pytest.fixture
def vignette():
    """A minimal vignette with two options."""
    return Vignette(
        vignette_id="test_001",
        category="job_security",
        scenario_text="You are weighing two job offers.",
        options=[
            VignetteOption(
                option_id="A",
                title="Stable Corp",
                description="• Salary: ZMW 20,000/month\n• Permanent contract\n• Fixed hours",
                attributes={}
            ),
            VignetteOption(
                option_id="B",
                title="Fast Startup",
                description="• Salary: ZMW 30,000/month\n• Contract-based\n• Flexible hours",
                attributes={}
            ),
        ],
        follow_up_questions=[],
        targeted_dimensions=["job_security"],
        difficulty_level="medium"
    )


class TestFormatVignetteMessage:

    def test_no_transition_on_first_vignette(self, agent, vignette):
        """When previous_category is None, no transition sentence is added."""
        message = agent._format_vignette_message(vignette, previous_category=None)

        assert "We've covered" not in message
        assert "Still on" not in message
        assert vignette.scenario_text in message

    def test_transition_sentence_when_category_changes(self, agent, vignette):
        """A 'We've covered X — now let's look at Y' sentence appears when category changes."""
        message = agent._format_vignette_message(vignette, previous_category="financial")

        assert "We've covered" in message
        assert "salary and compensation" in message   # previous label
        assert "job stability" in message             # current label

    def test_same_category_shows_different_angle(self, agent, vignette):
        """When previous and current category are the same, a 'different angle' line appears."""
        message = agent._format_vignette_message(vignette, previous_category="job_security")

        assert "Still on" in message
        assert "We've covered" not in message

    def test_options_title_and_description_present(self, agent, vignette):
        """Both option titles and descriptions are included in the output."""
        message = agent._format_vignette_message(vignette)

        assert "Stable Corp" in message
        assert "Fast Startup" in message
        assert "ZMW 20,000/month" in message
        assert "ZMW 30,000/month" in message

    def test_closing_prompt_always_present(self, agent, vignette):
        """The 'Which would you prefer, and why?' prompt always ends the message."""
        for previous in [None, "financial", "job_security"]:
            message = agent._format_vignette_message(vignette, previous_category=previous)
            assert message.strip().endswith("Which would you prefer, and why?")

    def test_scenario_text_always_present(self, agent, vignette):
        """The vignette's scenario_text always appears in the message."""
        for previous in [None, "financial", "job_security"]:
            message = agent._format_vignette_message(vignette, previous_category=previous)
            assert vignette.scenario_text in message

    def test_unknown_category_falls_back_to_raw_name(self, agent, vignette):
        """An unrecognised category key is rendered as-is rather than crashing."""
        vignette_unknown = vignette.model_copy(update={"category": "mystery_category"})
        message = agent._format_vignette_message(
            vignette_unknown, previous_category="financial"
        )

        assert "mystery_category" in message

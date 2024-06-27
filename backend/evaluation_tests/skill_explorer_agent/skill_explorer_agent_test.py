import os

import pytest
from pydantic import TypeAdapter

from app.agent.agent_types import AgentInput
from app.agent.experience_state import ExperienceState
from app.agent.skill_explorer_agent import SkillExplorerAgent
from app.vector_search.esco_entities import OccupationSkillEntity
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationRecord, Actor
from evaluation_tests.conversation_libs.fake_conversation_context import FakeConversationContext


@pytest.fixture()
def baker_occupation() -> OccupationSkillEntity:
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'baker_occupations.json')) as f:
        return TypeAdapter(OccupationSkillEntity).validate_json(f.read())


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_skill_explorer_agent(fake_conversation_context: FakeConversationContext,
                                    baker_occupation: OccupationSkillEntity):
    """ Tests the QnA agent with a simple question after a conversation. """
    occupations = [baker_occupation]
    state: ExperienceState = ExperienceState(job_title="Baker", esco_occupations=occupations, top_skills=[])
    skill_explorer_agent = SkillExplorerAgent(state)

    fake_conversation_context.fill_conversation(conversation=[
        ConversationRecord(message="Hello. Welcome. Are you ready to start?",
                           actor=Actor.EVALUATED_AGENT),
        ConversationRecord(message="Yes, I am ready to start.",
                           actor=Actor.SIMULATED_USER),
        ConversationRecord(
            message="Great, let's dive in! Tell me about a time when you had to overcome a challenge. What did you do "
                    "and what skills did you use to succeed?",
            actor=Actor.EVALUATED_AGENT),
        ConversationRecord(
            message="Last year, I worked in a Bakery in Cape Town.",
            actor=Actor.SIMULATED_USER),
        ConversationRecord(
            message="What company did you work for?",
            actor=Actor.EVALUATED_AGENT),
        ConversationRecord(
            message="I worked for a small bakery called 'Bread and Butter'.",
            actor=Actor.SIMULATED_USER),
    ],
        summary="The user and the agent are discussing a time when the user had to come a challenge. The user is "
                "explaining how they used their arch skills to come up with new ideas.")
    await skill_explorer_agent.execute(AgentInput(message="ignored", ), fake_conversation_context)
    assert len(state.top_skills) == skill_explorer_agent.TOP_COUNT
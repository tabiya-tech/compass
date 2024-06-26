import pytest

from app.agent.agent_types import AgentInput
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.infer_occupation_agent import InferOccupationAgent
from evaluation_tests.conversation_libs.evaluators.evaluation_result import (
    Actor,
    ConversationRecord,
)
from evaluation_tests.conversation_libs.fake_conversation_context import (
    FakeConversationContext,
)


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_occupation_inference_agent(
    fake_conversation_context: FakeConversationContext,
):
    """Tests the QnA agent with a simple question after a conversation."""
    state: ExperienceEntity = ExperienceEntity(
        experience_title="Baker",
        work_type="Formal sector/Unpaid trainee work",
        company="Bread and Butter",
        location="South Africa",
    )

    fake_conversation_context.fill_conversation(
        conversation=[
            ConversationRecord(
                message="Hello. Welcome. Are you ready to start?",
                actor=Actor.EVALUATED_AGENT,
            ),
            ConversationRecord(
                message="Yes, I am ready to start.", actor=Actor.SIMULATED_USER
            ),
            ConversationRecord(
                message="Great, let's dive in! Tell me about a time when you had to overcome a challenge. What did you do "
                "and what skills did you use to succeed?",
                actor=Actor.EVALUATED_AGENT,
            ),
            ConversationRecord(
                message="Last year, I worked in a Bakery in Cape Town.",
                actor=Actor.SIMULATED_USER,
            ),
            ConversationRecord(
                message="What company did you work for?", actor=Actor.EVALUATED_AGENT
            ),
            ConversationRecord(
                message="I worked for a small bakery called 'Bread and Butter'.",
                actor=Actor.SIMULATED_USER,
            ),
            ConversationRecord(
                message="Was it paid or unpaid?", actor=Actor.EVALUATED_AGENT
            ),
            ConversationRecord(message="unpaid", actor=Actor.SIMULATED_USER),
        ],
        summary="The user and the agent are discussing a time when the user had to come a challenge. The user is "
        "explaining how they worked in an unpaid job as a baker at Bread and Butter, in Cape Town.",
    )
    infer_occupation_agent = InferOccupationAgent()
    infer_occupation_agent.set_experience(state)
    await infer_occupation_agent.execute(
        AgentInput(
            message="ignored",
        ),
        fake_conversation_context
    )
    assert len(infer_occupation_agent._experience.esco_occupations) > 0
    assert len(infer_occupation_agent._experience.contextual_title) > 0

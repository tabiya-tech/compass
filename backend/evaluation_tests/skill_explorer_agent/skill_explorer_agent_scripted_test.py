import logging
import pytest
import textwrap

from app.agent.agent_types import AgentInput
from app.agent.skill_explorer_agent import SkillsExplorerAgent, SkillsExplorerAgentState
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.work_type import WorkType
from app.conversation_memory.conversation_memory_types import (
    ConversationContext,
    ConversationHistory,
)
from app.vector_search.esco_entities import (
    OccupationEntity,
    AssociatedSkillEntity,
    OccupationSkillEntity,
)
from evaluation_tests.conversation_libs.utils import _add_turn_to_context
from evaluation_tests.one_shot_test_case import write_one_shot_test_cases
from evaluation_tests.conversation_libs.evaluators.full_history_evaluator import (
    FullHistoryEvaluator,
)
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run

FIXED_TURNS = [
    (
        "(silence)",
        "We will now explore your skills with regard to your experience as a Baker at Fluffy Flour. What were your main responsibilities?",
    ),
    (
        "I spent most of my time preparing the doe and loading the flour. Sometimes I would bake.",
        "Which of these responsibilities would you say were the most important?",
    ),
]
EVALUATION_INTRO_PROMPT = textwrap.dedent(
    """You are assessing a conversation between a human (SIMULATED_USER) and an
            agent (EVALUATED_AGENT) in charge of exploring the skills of the SIMULATED_USER.
"""
)

EXPERIENCE_ENTITY = ExperienceEntity(
    experience_title="Baker",
    company="Fluffy Flour",
    location="Berlin, Germany",
    work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
    esco_occupations=[
        OccupationSkillEntity(
            occupation=OccupationEntity(
                id="6613c0d42c477928e7d46861",
                modelId="esco_occupation",
                UUID="97354279-6ae2-44c9-bca5-3d2fe4cccb04",
                preferredLabel="baker",
                code="7512.1",
                description="Bakers make\xa0a wide range of breads, pastries, and other baked goods. They follow all the processes from receipt and storage of raw materials, preparation of raw materials for bread-making, measurement and mixing of ingredients into dough and proof.",
                altLabels=[
                    "bakery specialist",
                    "bakery employee",
                    "bread baker",
                    "baker",
                ],
                score=0.98,
            ),
            associated_skills=[
                AssociatedSkillEntity(
                    id="6613c0c92c477928e7d43122",
                    modelId="esco_skill",
                    UUID="c7999a68-372f-4c43-aff2-f8a0d211a2ed",
                    preferredLabel="tend packaging machines",
                    description="Tend packaging machines such as filling, labelling, and sealing machines. Stock and sort products to be processed according to specifications.",
                    altLabels=[
                        "tend packaging machines",
                        "mind packaging machines",
                        "tend a packaging machines",
                        "look after packaging machines",
                        "watch packaging machines",
                        "take care of packaging machines",
                        "tend packaging machinery",
                    ],
                    skillType="skill/competence",
                    relationType="optional",
                    score=0.78,
                )
            ],
        )
    ],
)


test_cases_skill_explorer = write_one_shot_test_cases(
    FIXED_TURNS, EVALUATION_INTRO_PROMPT
)


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize(
    "test_case",
    get_test_cases_to_run(test_cases_skill_explorer),
    ids=[
        case.name for case in get_test_cases_to_run(test_cases_skill_explorer)
    ],
)
async def test_skill_explorer(test_case):
    session_id = hash("focus") % 10 ** 10
    skill_explorer_agent = SkillsExplorerAgent()
    skill_explorer_agent.set_experience(EXPERIENCE_ENTITY)
    skill_explorer_agent.set_state(
        SkillsExplorerAgentState(
            session_id=session_id,
        )
    )
    context: ConversationContext = ConversationContext(
        all_history=ConversationHistory(turns=[]),
        history=ConversationHistory(turns=[]),
        summary="",
    )
    # GIVEN the previous conversation context
    for turn in test_case.turns:
        _add_turn_to_context(turn[0], turn[1], context)
    # AND the context summary
    context.summary = test_case.summary
    agent_output = await skill_explorer_agent.execute(
        AgentInput(message=test_case.user_input), context=context
    )
    logging.info(f"Agent output: {agent_output.message_for_user}")
    evaluator = FullHistoryEvaluator(
        evaluation_prompt=test_case.evaluator_prompt
    )
    evaluation_output = await evaluator.evaluate(
        test_case.user_input, context, agent_output
    )
    logging.info(f"Evaluation reasoning: {evaluation_output.reason}")
    actual = evaluation_output.score
    assert actual >= test_case.expected_min_score

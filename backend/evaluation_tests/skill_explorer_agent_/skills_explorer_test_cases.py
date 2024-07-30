from textwrap import dedent
from typing import Optional, Literal, Any

from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.work_type import WorkType
from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, Evaluation
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType
from app.agent.experience.timeline import Timeline

system_instruction_prompt = dedent("""
    You are going to be interacting with a GenAI-driven conversational agent to help you explorer your skills. 
    You will interact with this agent by typing responses, so reply in a way that is typical of type responses 
    rather than verbal, meaning you speak concisely and directly. Don't invent information or hallucinate.
""")

sa_prompt = system_instruction_prompt + dedent("""       
    You talk in English, like a young person from South Africa would.
""")

kenya_prompt = system_instruction_prompt + dedent("""‘
    You talk in English, like a young person from Kenya would.
""")

france_prompt = system_instruction_prompt + dedent("""   
    Talk in English, like a young person would. 
    
    Some additional context you may need:
        QPV: These areas in France defined as priority neighborhoods for urban policy are among the most 
        disadvantaged in France, and therefore face a number of socio-economic challenges. 
        Civic service: An opportunity for young people aged 16 to 25 (or 30 if they are disabled) to volunteer for 
        assignments for 6 to 12 months. They do not need a degree or experience and are compensated for their service 
        (€580 a month, or €688 if volunteers have higher education grants or qualify for RSA supplemental income).
""")


class SkillsExplorerAgentTestCase(EvaluationTestCase):
    given_experience: ExperienceEntity
    expected_responsibilities: list[str]

    def __init__(self, *, name: str, simulated_user_prompt: str, evaluations: list[Evaluation],
                 given_experience: ExperienceEntity, expected_responsibilities: list[str], **data: Any):
        super().__init__(name=name, simulated_user_prompt=simulated_user_prompt, evaluations=evaluations,
                         given_experience=given_experience, expected_responsibilities=expected_responsibilities,
                         **data)


test_cases = [
    SkillsExplorerAgentTestCase(
        name='university_of_oxford_manager',
        simulated_user_prompt=dedent("""
            You are a person without any personal background.
            You Worked as a project manager. 
            Here are you responsibilities:
            - Managed a team of 5 people
            - Coordinated the project
            - Managed the budget
            - Reported on the project's progress
            - Ensured the project was completed on time
            When asked about your skills, answer with all the information at the same time. Do not add additional information or invent information.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        given_experience=ExperienceEntity(
            experience_title="Project Manager",
            company="University of Oxford",
            location="Remote",
            timeline=Timeline(
                start="2018",
                end="2020"
            ),
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
        ),
        expected_responsibilities=[],
    ),
    SkillsExplorerAgentTestCase(
        name='cook_at_a_restaurant',
        simulated_user_prompt=dedent("""
            You are a person without any personal background.
            You Worked as a cook at a restaurant. 
            Here are you responsibilities:
            - Prepared meals
            - Cleaned the kitchen
            - Managed the inventory
            When asked about your skills, answer with all the information at the same time. Do not add additional information or invent information.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        given_experience=ExperienceEntity(
            experience_title="Cook",
            company="Dinner for Two",
            location="Berlin",
            timeline=Timeline(
                start="2018",
                end="2020"
            ),
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
        ),
        expected_responsibilities=[],
    ),
    SkillsExplorerAgentTestCase(
        skip_force='skip',
        name='caregiving_for_elderly',
        simulated_user_prompt=dedent("""
            You are a person without any personal background.
            You help your older neighbor with daily tasks for free. 
            Here are you responsibilities:
            - Cooked meals
            - Cleaned the house
            - Helped with shopping
            - Took care of the garden
            When asked about your skills, answer with all the information at the same time. Do not add additional information or invent information.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        given_experience=ExperienceEntity(
            experience_title="Helping an older neighbor",
            company="Neighbor",
            location="London",
            timeline=Timeline(
                start="2018",
                end="2020"
            ),
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
        ),
        expected_responsibilities=[],
    ),
]

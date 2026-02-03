"""
Golden Test Set for Regression Testing

This module defines a curated set of 7 representative test cases that serve as the
"golden set" for regression testing. These tests cover key user types and conversation
patterns, and are used to quickly validate that changes don't degrade quality.

The golden set is designed to:
1. Run quickly (< 30 minutes for full suite)
2. Cover all work types
3. Represent different conversation styles
4. Include edge cases
5. Validate both quality and performance

Usage:
    pytest -m "golden_test" evaluation_tests/golden_test_cases.py

Expected Runtime: ~25 minutes (7 tests × ~3-4 minutes each)
"""

from textwrap import dedent

from app.agent.experience import WorkType
from app.countries import Country
from evaluation_tests.conversation_libs.conversation_test_function import Evaluation
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType
from evaluation_tests.core_e2e_tests_cases import E2ESpecificTestCase
from evaluation_tests.matcher import ContainsString, AnyOf

# Import system instruction prompts from core test cases
system_instruction_prompt = dedent("""
    You are going to be interacting with a GenAI-driven conversational agent to help you identify what your skills 
    are. You will interact with this agent by typing responses, so reply in a way that is typical of type responses 
    rather than verbal, meaning you speak concisely and directly.
""")

kenya_prompt = system_instruction_prompt + dedent("""'
    You talk in English, like a young person from Kenya would.
""")

sa_prompt = system_instruction_prompt + dedent("""       
    You talk in English, like a young person from South Africa would.
""")


class GoldenTestCase(E2ESpecificTestCase):
    """
    Base class for golden test cases.
    Extends E2ESpecificTestCase with golden test marker.
    """
    pass


# Golden Test Set: 7 Representative Personas
golden_test_cases = [
    # 1. SIMPLE FORMAL EMPLOYMENT (Baseline)
    # Represents: Concise user, single formal job, straightforward conversation
    # Coverage: FORMAL_SECTOR_WAGED_EMPLOYMENT
    GoldenTestCase(
        country_of_user=Country.UNSPECIFIED,
        conversation_rounds=50,
        name='golden_simple_formal_employment',
        simulated_user_prompt=dedent("""
            You're a Gen Y living alone. you have this single experience as an employee:
            - Selling Shoes at Shoe Soles, a shoe store in Tokyo, from 2023 to present.
            When asked you will reply with the information about this experience all at once, in a single message.
            You have never had another job experience beside the shoe salesperson job. Also never
            did any internship, never run your own business, never volunteered, never did any freelance work.
            Be as concise as possible, and do not make up any information.
            """) + system_instruction_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={
            WorkType.SELF_EMPLOYMENT: (0, 0),
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
            WorkType.UNSEEN_UNPAID: (0, 0),
        },
        matchers=["llm", "matcher"],
        expected_experience_data=[{
            "experience_title": ContainsString("Shoe Salesperson"),
            "location": ContainsString("Tokyo"),
            "company": ContainsString("Shoe Soles"),
            "timeline": {"start": ContainsString("2023"), "end": AnyOf(ContainsString("present"), "")},
        }]
    ),
    
    # 2. UNSEEN UNPAID WORK (Edge Case)
    # Represents: Informal unpaid work, challenging to classify
    # Coverage: UNSEEN_UNPAID
    GoldenTestCase(
        country_of_user=Country.KENYA,
        conversation_rounds=50,
        name='golden_unseen_unpaid_caregiver',
        simulated_user_prompt=dedent("""
            You're a young mother living in Mombasa. You have been raising your child since it was born three years ago (2022) 
            and mostly taking care of your family at home.
            Never had a paying working experience of any kind, never as an employee, never did any internship, never run
            did any internship, never run your own business, never volunteered, never did any freelance work, never helped the community or other households.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=2,
        expected_work_types={
            WorkType.SELF_EMPLOYMENT: (0, 0),
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
            WorkType.UNSEEN_UNPAID: (1, 2),
        },
        matchers=["llm", "matcher"],
        expected_experience_data=[{
            # Conversation often surfaces titles like "Taking Care of My Kid"/"Caregiver"
            "experience_title": AnyOf(
                ContainsString("Mom"),
                ContainsString("care"),
                ContainsString("caregiver")
            ),
            "location": ContainsString("Mombasa"),
            "company": ContainsString("family"),
            "timeline": {"start": "2022", "end": ContainsString("present")},
            "work_type": WorkType.UNSEEN_UNPAID.name,
        }]
    ),
    
    # 3. SELF-EMPLOYMENT (Informal Sector)
    # Represents: Informal work, no formal job title
    # Coverage: SELF_EMPLOYMENT
    GoldenTestCase(
        country_of_user=Country.KENYA,
        conversation_rounds=100,
        name='golden_self_employed_matatu_conductor',
        simulated_user_prompt=dedent("""
            You're a Gen Y living alone. You work as a Matatu conductor. A matatu conductor is a person who collects 
            fares from passengers in a matatu, a type of public transport. You have never had another job experience,
            never did any internship, never run your own business, never volunteered, never did any freelance work.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=2,
        expected_work_types={
            WorkType.SELF_EMPLOYMENT: (0, 1),
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
            WorkType.UNSEEN_UNPAID: (0, 1),
        }
    ),
    
    # 4. MULTI-EXPERIENCE DIVERSE (Complex)
    # Represents: Multiple work types, complex conversation
    # Coverage: FORMAL_SECTOR_WAGED_EMPLOYMENT, SELF_EMPLOYMENT, FORMAL_SECTOR_UNPAID_TRAINEE_WORK, UNSEEN_UNPAID
    GoldenTestCase(
        country_of_user=Country.SOUTH_AFRICA,
        conversation_rounds=100,
        name='golden_multi_experience_diverse',
        simulated_user_prompt=dedent("""
            You are a young person from South Africa with a diverse work history. You have multiple experiences across different work types.
            If asked if you want to start the conversation, agree to start without saying anything about your experiences.
            
            You have the following experiences:
            
            • Worked as a software developer at TechCorp from 2020 to 2022. It was a full-time paid job in Cape Town. I worked on web applications and mobile apps, then left to pursue freelance work.
            • I'm currently freelancing as a web designer since 2022. I'm self-employed, working with various clients. I'm based in Johannesburg but work remotely, and I specialize in e-commerce websites.
            • Volunteered at a local animal shelter from 2019 to 2021. It was unpaid volunteer work in Durban. I helped with animal care and adoption events, working weekends and holidays.
            • Did a summer internship at a marketing agency in 2019. It was in Johannesburg and I helped with social media campaigns. It was unpaid trainee work.
               
            When the agent asks about your experiences, provide information naturally as they ask questions. 
            Be specific about dates, locations, and work types when asked. You're proud of your diverse experience 
            and want to share it all. You can provide multiple experiences at once or individually as the agent asks.
            
            You can come up with specific activities and details for each experience when asked.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=4,
        expected_experiences_count_max=4,
        expected_work_types={
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
            WorkType.SELF_EMPLOYMENT: (1, 1),
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (1, 1),
            WorkType.UNSEEN_UNPAID: (1, 1),
        }
    ),
    
    # 5. CV UPLOAD STYLE (Edge Case)
    # Represents: User provides all info at once, tests context retention
    # Coverage: Multiple work types, information density
    GoldenTestCase(
        country_of_user=Country.UNSPECIFIED,
        conversation_rounds=100,
        name='golden_cv_upload_style',
        simulated_user_prompt=dedent("""
            You are a professional with diverse experiences. 
            If asked if you want to start the conversation, agree to start without saying anything about your experiences. 
            Only after agreeing to start, wait for the agent to ask you about your experiences, and then you will respond in CV format with bullet points:
            
            <Message>
                These are my experiences:
                • Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
                • Worked as a software architect at ProUbis GmbH in berlin, from 2010 to 2018. It was a full-time job.
                • You owned a bar/restaurant called Dinner For Two in Berlin from 2010 until covid-19, then you sold it.
                • In 1998 did an unpaid internship as a Software Developer for Ubis GmbH in Berlin. 
                • Between 2015-2017 volunteer, taught coding to kids in a community center in Berlin.
            </Message>
            
            You will provide all this information at once when asked about your experiences. Provide the information exactly as you see it in the <Message /> section
             
            Do not give the information again later in the conversation,
            but instead refer to the list of experiences you provided at the start of the conversation as "I have already shared the information".
            
            If they say they don't have access to that information skip the experience by saying, 
            "I don't have access to that information right now, let's skip it and move on."
            
            You can come up with activities you have done during each experience.
            """) + system_instruction_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count_min=5,
        expected_experiences_count_max=5,
        expected_work_types={
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (2, 2),
            WorkType.SELF_EMPLOYMENT: (1, 1),
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (1, 1),
            WorkType.UNSEEN_UNPAID: (1, 1),
        }
    ),
    
    # 6. PROCESS QUESTIONER (Edge Case)
    # Represents: User who asks questions about the process
    # Coverage: Router accuracy, welcome agent handling
    GoldenTestCase(
        country_of_user=Country.UNSPECIFIED,
        conversation_rounds=50,
        name='golden_process_questioner',
        simulated_user_prompt=dedent("""
            You're a Gen Y living alone. you have this single experience as an employee:
            - Selling Shoes at Shoe Soles, a shoe store in Tokyo, from 2023 to present.
            When asked you will reply with the information about this experience all at once, in a single message.
            You have never had another job experience beside the shoe salesperson job. Also never
            did any internship, never run your own business, never volunteered, never did any freelance work.
            Be as concise as possible, and do not make up any information.
            
            When asked if you are ready to start the conversation, 
            ask a question about the process before agreeing to start.
            
            Later when asked about the basic information about your experience,
            make sure to also ask a question about the process or your CV.
            
            During the part when you are asked about to describe the tasks you performed in your job,
            make sure to ask how long it will take to finish the conversation.
            """) + system_instruction_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={
            WorkType.SELF_EMPLOYMENT: (0, 0),
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
            WorkType.UNSEEN_UNPAID: (0, 0),
        },
        matchers=["llm", "matcher"],
        expected_experience_data=[{
            "experience_title": ContainsString("Shoe Salesperson"),
            "location": ContainsString("Tokyo"),
            "company": ContainsString("Shoe Soles"),
            "timeline": {"start": ContainsString("2023"), "end": AnyOf(ContainsString("present"), "")},
        }]
    ),
    
    # 7. VOLUNTEER WORK (Community Service)
    # Represents: Volunteer/community work, student profile
    # Coverage: UNSEEN_UNPAID (volunteer variant)
    GoldenTestCase(
        country_of_user=Country.SOUTH_AFRICA,
        conversation_rounds=100,
        name='golden_volunteer_student',
        simulated_user_prompt=dedent("""
            Let's put you in the shoes of Shiela! You're a Gen Z student living with your mom and three 
            brothers. Classes are mostly online for you, but you still hustle hard. You volunteer and love teaching 
            others graphic design, transcription, the whole digital skills thing. You even help people without fancy 
            degrees get started online.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=4,
        expected_work_types={
            WorkType.SELF_EMPLOYMENT: (0, 2),
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
            WorkType.UNSEEN_UNPAID: (1, 3),
        }
    ),
]


# Golden Test Set Metadata
GOLDEN_SET_METADATA = {
    "version": "1.0",
    "created_date": "2026-01-08",
    "total_tests": len(golden_test_cases),
    "expected_runtime_minutes": 25,
    "coverage": {
        "work_types": {
            "FORMAL_SECTOR_WAGED_EMPLOYMENT": 3,
            "SELF_EMPLOYMENT": 2,
            "FORMAL_SECTOR_UNPAID_TRAINEE_WORK": 1,
            "UNSEEN_UNPAID": 3,
        },
        "conversation_styles": {
            "concise": 4,
            "verbose": 1,
            "cv_upload": 1,
            "process_questioner": 1,
        },
        "complexity": {
            "simple": 3,
            "medium": 2,
            "complex": 2,
        },
        "countries": {
            "UNSPECIFIED": 3,
            "KENYA": 2,
            "SOUTH_AFRICA": 2,
        }
    },
    "quality_thresholds": {
        "skill_overlap_min": 0.85,  # 85% minimum skill overlap
        "turn_count_max_deviation": 0.20,  # Max 20% increase in turn count
        "conversation_time_max_deviation": 0.20,  # Max 20% increase in time
    },
    "description": """
    The golden test set consists of 7 carefully selected personas that represent
    the most important user types and conversation patterns. These tests are used
    for regression testing to ensure that changes don't degrade quality or performance.
    
    Test Selection Criteria:
    1. Coverage: All work types represented
    2. Complexity: Range from simple to complex
    3. Edge cases: CV upload, process questions, informal work
    4. Performance: Fast execution (< 30 minutes total)
    5. Stability: Consistent, reproducible results
    
    Usage:
        # Run golden test set
        pytest -m "golden_test" evaluation_tests/golden_test_cases.py
        
        # Run with repetitions for statistical significance
        pytest -m "golden_test" --repeat 3 evaluation_tests/golden_test_cases.py
        
        # Run specific golden test
        pytest -k "golden_simple_formal_employment" evaluation_tests/golden_test_cases.py
    """
}


def get_golden_test_by_name(name: str) -> GoldenTestCase:
    """
    Get a specific golden test case by name.
    
    Args:
        name: The name of the test case (e.g., "golden_simple_formal_employment")
        
    Returns:
        The golden test case with the given name
        
    Raises:
        ValueError: If no test case with the given name exists
    """
    for test_case in golden_test_cases:
        if test_case.name == name:
            return test_case
    raise ValueError(f"No golden test case found with name: {name}")


def get_golden_tests_by_work_type(work_type: WorkType) -> list[GoldenTestCase]:
    """
    Get all golden test cases that cover a specific work type.
    
    Args:
        work_type: The work type to filter by
        
    Returns:
        List of golden test cases that include the specified work type
    """
    matching_tests = []
    for test_case in golden_test_cases:
        if hasattr(test_case, 'expected_work_types'):
            if work_type in test_case.expected_work_types:
                expected_count = test_case.expected_work_types[work_type]
                if expected_count[0] > 0 or expected_count[1] > 0:
                    matching_tests.append(test_case)
    return matching_tests


def get_golden_tests_by_complexity(complexity: str) -> list[GoldenTestCase]:
    """
    Get all golden test cases of a specific complexity level.
    
    Args:
        complexity: One of "simple", "medium", "complex"
        
    Returns:
        List of golden test cases of the specified complexity
    """
    complexity_map = {
        "simple": ["golden_simple_formal_employment", "golden_unseen_unpaid_caregiver", "golden_process_questioner"],
        "medium": ["golden_self_employed_matatu_conductor", "golden_volunteer_student"],
        "complex": ["golden_multi_experience_diverse", "golden_cv_upload_style"],
    }
    
    if complexity not in complexity_map:
        raise ValueError(f"Invalid complexity: {complexity}. Must be one of: simple, medium, complex")
    
    test_names = complexity_map[complexity]
    return [get_golden_test_by_name(name) for name in test_names]


# Export for pytest
__all__ = [
    'golden_test_cases',
    'GoldenTestCase',
    'GOLDEN_SET_METADATA',
    'get_golden_test_by_name',
    'get_golden_tests_by_work_type',
    'get_golden_tests_by_complexity',
]


from textwrap import dedent

from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, Evaluation
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType

system_instruction_prompt = dedent("""
    You are going to be interacting with a GenAI-driven conversational agent to help you identify your past experiences. 
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


class CollectExperiencesAgentTestCase(EvaluationTestCase):
    expected_experiences_count: int = -1

    def __init__(self, name: str, simulated_user_prompt: str, evaluations: list[Evaluation],
                 expected_experiences_count: int = -1):
        super().__init__(name=name, simulated_user_prompt=simulated_user_prompt, evaluations=evaluations)
        self.expected_experiences_count = expected_experiences_count


test_cases = [
    CollectExperiencesAgentTestCase(
        name='withholding_student_e2e',
        simulated_user_prompt=dedent("""
            You are a Gen Z student living with your mom and three brothers in Johannesburg. You have the following experiences:
            1. Freelance graphic design teacher online, since June 2020.
            2. Volunteer English teacher during high-school in a Community Center of Johannesburg, between January 2017 and August 2020.
            3. Assist elderly people in nursing home without pay, every summer since 2020.
            You are resistant to getting help from the agent and withhold information when doing so.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count=3
    ),
    CollectExperiencesAgentTestCase(
        name='unexperienced_student_e2e',
        simulated_user_prompt=dedent("""
            You are a high-school student without previous work experiences. You live in Nairobi with your parents and your grandmother. 
            You like to help your neighbours tend their garden. You have a passion for music and dance and would like to pursue it. You also drive
            and help your grandmother with transportation.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        # The simulated user seems to report 3 experiences (help parent, drove grandma, helped neighbors)
        expected_experiences_count=3
    ),
    CollectExperiencesAgentTestCase(
        name='french_worker_typos_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from Paris, France looking for a job. You would like to work in retail and your previous experiences are as follows:
            1. Delivery job for Uber Eats in Paris, from Janary 2021 to March 2023. This was a paid job with a contract.
            2. Selling old furniture at the Flea Market of rue Jean Henri Fabre, every Wednesday and Friday. You started in 2019 with your older brother and are still doing it today. This is unformal labor, as you only get 100 euros at the end of the day, without any formal contract.
            You write with typos.
            """) + france_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count=2
    ),
    CollectExperiencesAgentTestCase(
        name='french_worker_infodump_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from Paris, France looking for a job. You would like to work in retail and your previous experiences are as follows:
            1. Delivery job for Uber Eats in Paris, from Janary 2021 to March 2023. This was a paid job with a contract.
            2. Selling old furniture at the Flea Market of rue Jean Henri Fabre, every Wednesday and Friday. You started in 2019 with your older brother and are still doing it today. This is unformal labor, as you only get 100 euros at the end of the day, without any formal contract.
            When asked about your experiences, answer with all the information at the same time. Do not add additional information or invent information.
            """) + france_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count=2

    ),
    CollectExperiencesAgentTestCase(
        name='single_experience_e2e',
        simulated_user_prompt=dedent("""
            You are a trained Dancer from Nairobi and would like to find a new job because the theatre you were working for is now closing.
            Your only previous experience is only one in the Chandaria Center for Performing Art, where you have been working since 2018 with a full time contract.
            Do not add additional information or invent information. You have never done volunteering or helped your community.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count=1
    ),
    CollectExperiencesAgentTestCase(
        name='single_experience_mistake_e2e',
        simulated_user_prompt=dedent("""
            You are a trained Dancer from Nairobi and would like to find a new job because the theatre you were working for is now closing.
            Your only previous experience is only one in the Chandaria Center for Performing Art, where you have been working since 2018 with a full time contract.
            Do not add additional information or invent information. You have never done volunteering or helped your community.
            When first asked about your experience, you mistake the dates and say that you have been working there since 2009. Only when asked about more information,
            you correct your mistake.
            """) + france_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count=1
    ),
]

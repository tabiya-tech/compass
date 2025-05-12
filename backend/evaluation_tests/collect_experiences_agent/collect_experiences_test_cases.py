from textwrap import dedent
from typing import Any

from pydantic import ConfigDict

from app.agent.experience import WorkType
from app.countries import Country
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
    expected_experiences_count_min: int
    """
    The minimum number of experiences that should be found.
    """

    expected_experiences_count_max: int
    """
    The maximum number of experiences that should be found.
    """

    expected_work_types: dict[WorkType, tuple[int, int]] = {}
    """
    The minimum and maximum number of experiences that should be found for each work type.
    """

    country_of_user: Country = Country.UNSPECIFIED

    def __init__(self, *, name: str, simulated_user_prompt: str, evaluations: list[Evaluation],
                 expected_experiences_count_min: int, expected_experiences_count_max: int, **data: Any):
        super().__init__(name=name, simulated_user_prompt=simulated_user_prompt, evaluations=evaluations,
                         expected_experiences_count_min=expected_experiences_count_min, expected_experiences_count_max=expected_experiences_count_max,
                         **data)

    model_config = ConfigDict(extra="forbid")


test_cases = [
    CollectExperiencesAgentTestCase(
        name='monther_of_two__e2e',
        simulated_user_prompt=dedent("""
            You are a young monther from Kenya Nairobi.
            You have never had a formal job, but you have been a stay-at-home mom since your first child was born in 2018.
            You have two children, and you have been taking care of them since they were born.
            You obviously also do household chores and general housework for your family but consider all of it as part of the same work experience.
            You have never done volunteering or helped your community or other families or friends.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=2,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (1, 2)},
        country_of_user=Country.KENYA
    ),
    CollectExperiencesAgentTestCase(
        name='taking_care_of_siblings_e2e',
        simulated_user_prompt=dedent("""
                    You are a young person from Mombasa.
                    You have never had a formal job, but you have been a taking care of your baby sister when your mother is ar work.
                    You obviously also do household chores and general housework for your family.
                    You have never done volunteering or helped your community.
                    """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=2,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (1, 2)},
        country_of_user=Country.KENYA
    ),
    CollectExperiencesAgentTestCase(
        name='mentor_kenya_disabled',
        simulated_user_prompt=dedent("""
            You are a young from Kenya Mombasa.
            You are a disabled person that suffered HIV/AIDS which occurred 2010 
            and you are under medication, so it has been very difficult for you since then.
            You are very open about your condition and complain about it now and then in your conversation.
                      
            You have only one sigle experience:  
                Volunteer Peer mentor, Educator and a mentor manager 2016 till you got sick in 2022. 
                You volunteered for different organizations such as the Mombasa Youth Empowerment Network, 
                the Kenya Red Cross Society, and the Mombasa County Government as part of this experience. 
                
                When asked for for experience, you will name the organizations separately when asked in a follow-up question.
                
                When talking about your experience, do not share all the information at once, expect followup questions to 
                give the rest of the information. 
            
            If presented in the recap with more that one experiences, make sure to correct the AI!
       
            Do not add additional information or invent information.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={WorkType.UNSEEN_UNPAID: (1, 1)},
        country_of_user=Country.KENYA
    ),
    CollectExperiencesAgentTestCase(
        name='university_of_oxford_manager',
        simulated_user_prompt=dedent("""
            You are a person without any personal background.
            You have one experience
            1. Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
            You have no other experiences
            You reply in the most concise way possible.
            When asked about your experiences, answer with all the information at the same time. Do not add additional information or invent information.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1)},
    ),
    CollectExperiencesAgentTestCase(
        name='no_experiences_at_all',
        simulated_user_prompt=dedent("""
            You are a person without any personal background.
            You have no experiences at all.
            You have never worked in your life and never helped your community or volunteered for anything.
            You think you are worthless and helpless and desperately need a job.
            Do not add additional information or invent information.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=0,
        expected_experiences_count_max=0,
        country_of_user=Country.UNSPECIFIED,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.UNSEEN_UNPAID: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0)},
    ),
    CollectExperiencesAgentTestCase(
        name='experiences_of_all_kinds',
        simulated_user_prompt=dedent("""
            You are an accomplished professional.
            You have all kind of experiences.
            1. Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
            2. Worked as a software architect at ProUbis GmbH in berlin, from 2010 to 2018. It was a full-time job.
            3. You owned  a bar/restaurant called Dinner For Two in Berlin from 2010 until covid-19, then you sold it.
            4. Co-founded Acme Inc. in 2022, a gen-ai startup based in DC, USA. You owned this business and your role was CEO.
            5. In 1998 did an unpaid internship as a Software Developer for Ubis GmbH in Berlin. 
            6. Between 2015-2017 volunteer, taught coding to kids in a community center in Berlin.
            7. Helped your elderly neighbor with groceries and cleaning every week since 2019.
            You have no other experiences than the above 7.
            You reply in the most concise way possible.
            When asked about your experiences, answer with one experience at a time, but give all the information of the experience at once.
            Do not add additional information or invent information.
            Make sure you mention all the experiences during the conversation.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=7,
        expected_experiences_count_max=7,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (2, 2),
                             WorkType.SELF_EMPLOYMENT: (2, 2),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (1, 1),
                             WorkType.UNSEEN_UNPAID: (2, 2)
                             },
        country_of_user=Country.UNSPECIFIED
    ),
    CollectExperiencesAgentTestCase(
        name='experiences_of_all_kinds_all_at_once',
        simulated_user_prompt=dedent("""
            You are an accomplished professional.
            You have all kind of experiences.
            1. Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
            2. Worked as a software architect at ProUbis GmbH in berlin, from 2010 to 2018. It was a full-time job.
            3. You owned  a bar/restaurant called Dinner For Two in Berlin from 2010 until covid-19, then you sold it.
            4. Co-founded Acme Inc. in 2022, a gen-ai startup based in DC, USA. You owned this business and your role was CEO.
            5. In 1998 did an unpaid internship as a Software Developer for Ubis GmbH in Berlin. 
            6. Between 2015-2017 volunteer, taught coding to kids in a community center in Berlin.
            7. Helped your elderly neighbor with groceries and cleaning every week since 2019.
            You have no other experiences
            You reply in the most concise way possible.
            When asked about your experiences, answer with all the information of every experience at the same time. 
            Do not add additional information or invent information.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=7,
        expected_experiences_count_max=7,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (2, 2),
                             WorkType.SELF_EMPLOYMENT: (2, 2),
                             WorkType.UNSEEN_UNPAID: (1, 1),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (2, 2)},
        country_of_user=Country.UNSPECIFIED
    ),
    CollectExperiencesAgentTestCase(
        name='withholding_student_e2e',
        simulated_user_prompt=dedent("""
            You are a Gen Z student living with your mom and three brothers in Johannesburg. You have the following experiences:
            1. Freelance graphic design teacher online, since June 2020.
            2. Volunteer English teacher during high-school in a Community Center of Johannesburg, between January 2017 and August 2020.
            3. Assist elderly people in nursing home without pay, every summer since 2020.
            You are resistant to getting help from the agent and withhold information when doing so.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=3,
        expected_experiences_count_max=3,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (1, 1),
                             WorkType.UNSEEN_UNPAID: (2, 2),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0)},
        country_of_user=Country.SOUTH_AFRICA
    ),
    CollectExperiencesAgentTestCase(
        name='mentions_type_first_student_e2e',
        simulated_user_prompt=dedent("""
            You are a Gen Z student living with your mom and three brothers in Johannesburg. You have the following experiences:
            1. Freelance graphic design teacher online, since June 2020.
            2. Volunteer English teacher during high-school in a Community Center of Johannesburg, between January 2017 and August 2020.
            3. Assist elderly people in nursing home without pay, every summer since 2020.
            When asked about your experiences, you will mention the type of experience first (e.g. "Yes, I freelanced", "I volunteered", or simply "Yes") and then the rest of the information.
            You are resistant to getting help from the agent and withhold information when doing so.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=3,
        expected_experiences_count_max=3,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (1, 1),
                             WorkType.UNSEEN_UNPAID: (2, 2),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0)},
        country_of_user=Country.SOUTH_AFRICA
    ),
    CollectExperiencesAgentTestCase(
        name='un_experienced_student_e2e',
        simulated_user_prompt=dedent("""
            You are a high-school student without previous work experiences. You live in Nairobi with your parents and your grandmother. 
            You like to help your neighbours tend their garden. You have a passion for music and dance and would like to pursue it. You also drive
            and help your grandmother with transportation.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        # The simulated user seems to report 3 experiences (help parent, drove grandma, helped neighbors)
        expected_experiences_count_min=2,
        expected_experiences_count_max=3,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.UNSEEN_UNPAID: (2, 3),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0)},
        country_of_user=Country.KENYA
    ),
    CollectExperiencesAgentTestCase(
        name='french_worker_typos_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from Paris, France looking for a job. You would like to work in retail and your previous experiences are as follows:
            1. Delivery job for Uber Eats in Paris, from Janary 2021 to March 2023. This was a paid job with a contract.
            2. Selling old furniture at the Flea Market of rue Jean Henri Fabre, every Wednesday and Friday.
               You started in 2019 with your older brother and are still doing it today.
               This is informal labor, as you only get 100 euros at the end of the day, without any formal contract.
            You write with typos.
            """) + france_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=2,
        expected_experiences_count_max=3,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (1, 1),
                             WorkType.UNSEEN_UNPAID: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0)},
        country_of_user=Country.FRANCE
    ),
    CollectExperiencesAgentTestCase(
        name='french_worker_infodump_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from Paris, France looking for a job. You would like to work in retail and your previous experiences are as follows:
            1. Delivery job for Uber Eats in Paris, from Janary 2021 to March 2023. This was a paid job with a contract.
            2. Selling old furniture at the Flea Market of rue Jean Henri Fabre, every Wednesday and Friday. You started in 2019 with your older brother and are still doing it today. This is informal labor, as you only get 100 euros at the end of the day, without any formal contract.
            When asked about your experiences, answer with all the information at the same time. Do not add additional information or invent information.
            """) + france_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=2,
        expected_experiences_count_max=3,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (1, 1),
                             WorkType.UNSEEN_UNPAID: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0)},
        country_of_user=Country.FRANCE
    ),
    CollectExperiencesAgentTestCase(
        name='single_experience_e2e',
        simulated_user_prompt=dedent("""
            You are a trained Dancer from Nairobi and would like to find a new job because the theatre you were working for is now closing.
            Your only previous experience is only one in the Chandaria Center for Performing Art, where you have been working since 2018 with a full time contract.
            Do not add additional information or invent information. You have never done volunteering or helped your community.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.UNSEEN_UNPAID: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0)},
        country_of_user=Country.KENYA
    ),
    CollectExperiencesAgentTestCase(
        name='single_experience_mistake_e2e',
        simulated_user_prompt=dedent("""
            You are a trained Dancer from Nairobi and would like to find a new job because the theatre you were working for is now closing.
            Your only previous experience is only one in the Chandaria Center for Performing Art, where you have been working since 2018 with a full time contract.
            Do not add additional information or invent information. You have never done volunteering or helped your community.
            When first asked about your experience, you mistake the dates and say that you have been working there since 2009. Only when asked about more information,
            you correct your mistake.
            Also when you initially talk about your experience, you lie and say that is was a volunteering experience. 
            When given an opportunity to correct yourself, you say that it was a paid contract job.
            """) + france_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.UNSEEN_UNPAID: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0)},
        country_of_user=Country.KENYA
    ),
    CollectExperiencesAgentTestCase(
        name='hobbyist_e2e',
        simulated_user_prompt=dedent("""
            You have a single hobby, blogging about your travels. You have been doing this since 2018 and have a small following.
            You do not do this professionally and have never made money from it. You do not have any other work experiences 
            of any kind neither have you volunteered or helped your community or family or friends.
            When asked you will not disclose that it is a hobby, but you will not lie about it being a job either.
            Let your conversation partner initially believe that you are a professional blogger and then explain it is a hobby and not a job.
            """),
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.UNSEEN_UNPAID: (1, 1),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0)},
        country_of_user=Country.UNSPECIFIED
    ),
]

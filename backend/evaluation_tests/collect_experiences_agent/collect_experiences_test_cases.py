from textwrap import dedent
from typing import Optional

from pydantic import ConfigDict

from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience import WorkType
from app.countries import Country
from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, Evaluation
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType
from evaluation_tests.discovered_experience_test_case import DiscoveredExperienceTestCase
from evaluation_tests.matcher import AnyOf, ContainsString, NON_EMPTY_STRING_REGEX, DictContaining, AnyValue

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


class CollectExperiencesAgentTestCase(EvaluationTestCase, DiscoveredExperienceTestCase):
    injected_state: Optional[CollectExperiencesAgentState] = None
    """
    Optional pre-existing agent state to inject into the executor.
    If provided, the agent will continue from this state instead of starting fresh.
    """
    
    model_config = ConfigDict(extra="forbid")


test_cases = [
    CollectExperiencesAgentTestCase(
        name='monther_of_two_e2e',
        simulated_user_prompt=dedent("""
            You are a young monther from Kenya Nairobi.
            You have never had a formal job, but you have been a stay-at-home mom since your first child was born in 2018.
            You have two children, and you have been taking care of them since they were born.
            You obviously also do household chores and general housework for your family but consider all of it as part of the same work experience.
            You have never done volunteering or helped your community or other families or friends.
            """) + kenya_prompt,
        country_of_user=Country.KENYA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=2,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (1, 2)},
        matchers=["llm", "matcher"],
        expected_experience_data=[{
            "experience_title": AnyOf(ContainsString("stay-at-home mom"), ContainsString("Caring for Family")),
            "location": AnyOf(ContainsString("Nairobi"), ContainsString("Home")),
            "company": ContainsString("family"),
            "timeline": {"start": "2018", "end": ContainsString("present")},
            "work_type": WorkType.UNSEEN_UNPAID.name,
        }]
    ),
    CollectExperiencesAgentTestCase(
        name='taking_care_of_siblings_e2e',
        simulated_user_prompt=dedent("""
                    You are a young person from Mombasa.
                    You have never had a formal job, but you have been a taking care of your baby sister since 2015, when your mother is ar work.
                    You obviously also do household chores and general housework for your family.
                    You have never done volunteering or helped your community.
                    """) + kenya_prompt,
        country_of_user=Country.KENYA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=2,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (1, 2)},
        matchers=["llm"],
        expected_experience_data=[{
            "experience_title": "MatchesCloselyConcept(taking care of your baby sister)",
            "location": "MatchesCloselyLocation(Mombasa)", #TODO: check that the location is getting parsed properly
            "company": "MatchesCloselyConcept(family)",
            "timeline": {"start": "2015", "end": ContainsString("present")},
            "work_type": f"ExactMatch({WorkType.UNSEEN_UNPAID.name})",
        }]
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
        expected_experience_data=[
            {"experience_title": AnyOf(ContainsString("peer"),
                                       ContainsString("mentor"),
                                       ContainsString("Educator"),
                                       ContainsString("manager")
                                       ),
             "location": ContainsString("Mombasa"),
             "company": AnyOf(ContainsString("organization"),
                              ContainsString("Youth Empowerment Network"),
                              ContainsString("Kenya Red Cross Society"),
                              ContainsString("Mombasa County Government")
                              ),
             "timeline": {"start": "2016", "end": "2022"},
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
        ],
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
            """),
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1)},
        expected_experience_data=[
            {"experience_title": ContainsString("project manager"),
             "location": ContainsString("remote"),
             "company": ContainsString("University of Oxford"),
             "timeline": {"start": "2018", "end": "2020"},
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
        ]
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
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (0, 0)
                             },
    ), CollectExperiencesAgentTestCase(
        name='add_experience_after_recap',
        simulated_user_prompt=dedent("""
            You are a person without any personal background.
            When asked about your experiences you will say no and that you have no experiences at all.
            Once you are given a recap and only then you will say that you have one experience!:
            1. Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        country_of_user=Country.UNSPECIFIED,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (0, 0)
                             },
        expected_experience_data=[
            {"experience_title": ContainsString("project manager"),
             "location": ContainsString("remote"),
             "company": ContainsString("University of Oxford"),
             "timeline": {"start": "2018", "end": "2020"},
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             }]
    ),
    CollectExperiencesAgentTestCase(
        name='experiences_of_all_kinds',
        simulated_user_prompt=dedent("""
            You are an accomplished professional.
            You have all kind of experiences.
            1. Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
            2. Worked as a software architect at ProUbis GmbH in berlin, from 2010 to 2018. It was a full-time job.
            3. You owned a bar/restaurant called Dinner For Two in Berlin from 2010 until covid-19, then you sold it.
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
        country_of_user=Country.SOUTH_AFRICA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=7,
        expected_experiences_count_max=7,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (2, 2),
                             WorkType.SELF_EMPLOYMENT: (2, 2),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (1, 1),
                             WorkType.UNSEEN_UNPAID: (2, 2)
                             },
        expected_experience_data=[
            {"experience_title": ContainsString("project manager"),
             "location": ContainsString("remote"),
             "company": ContainsString("University of Oxford"),
             "timeline": DictContaining({"start": "2018", "end": "2020"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("software architect"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("ProUbis GmbH"),
             "timeline": DictContaining({"start": "2010", "end": "2018"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("Owned a bar/restaurant"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("Dinner For Two"),
             "timeline": DictContaining({"start": "2010", "end": "2020"}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("CEO"),
             "location": ContainsString("DC"),
             "company": ContainsString("Acme Inc."),
             "timeline": DictContaining({"start": "2022", "end": AnyOf('', ContainsString("present"))}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("Software Developer"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("Ubis GmbH"),
             "timeline": DictContaining({"start": ContainsString("1998"), "end": ContainsString("1998")}),
             "work_type": WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name,
             },
            {"experience_title": ContainsString("Teach coding"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("community center"),
             "timeline": DictContaining({"start": ContainsString("2015"), "end": ContainsString("2017")}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
            {"experience_title": ContainsString("Help"),
             "location": AnyValue(),
             "company": ContainsString("neighbor"),
             "timeline": DictContaining({"start": ContainsString("2019"), "end": AnyOf('', ContainsString("present"))}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
        ],
    ),
    CollectExperiencesAgentTestCase(
        name='experiences_of_all_kinds_all_at_once',
        simulated_user_prompt=dedent("""
            You are an accomplished professional.
            You have all kind of experiences.
            1. Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
            2. Worked as a software architect at ProUbis GmbH in berlin, from 2010 to 2018. It was a full-time job.
            3. You owned a bar/restaurant called Dinner For Two in Berlin from 2010 until covid-19, then you sold it.
            4. Co-founded Acme Inc. in 2022, a gen-ai startup based in DC, USA. You owned this business and your role was CEO.
            5. In 1998 did an unpaid internship as a Software Developer for Ubis GmbH in Berlin. 
            6. Between 2015-2017 volunteer, taught coding to kids in a community center in Berlin.
            7. Helped your elderly neighbor with groceries and cleaning every week since 2019.
            You have no other experiences
            You reply in the most concise way possible.
            When asked about your experiences, answer with all the information of every experience at the same time. 
            Do not add additional information or invent information.
            """),
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=7,
        expected_experiences_count_max=7,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (2, 2),
                             WorkType.SELF_EMPLOYMENT: (2, 2),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (1, 1),
                             WorkType.UNSEEN_UNPAID: (2, 2)},
        country_of_user=Country.UNSPECIFIED,
        expected_experience_data=[
            {"experience_title": ContainsString("project manager"),
             "location": ContainsString("remote"),
             "company": ContainsString("University of Oxford"),
             "timeline": DictContaining({"start": "2018", "end": "2020"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("software architect"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("ProUbis GmbH"),
             "timeline": DictContaining({"start": "2010", "end": "2018"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("Owned a bar/restaurant"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("Dinner For Two"),
             "timeline": DictContaining({"start": "2010", "end": "2020"}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("CEO"),
             "location": ContainsString("DC"),
             "company": ContainsString("Acme Inc."),
             "timeline": DictContaining({"start": "2022", "end": AnyOf('', ContainsString("present"))}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("Software Developer"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("Ubis GmbH"),
             "timeline": DictContaining({"start": ContainsString("1998"), "end": ContainsString("1998")}),
             "work_type": WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name,
             },
            {"experience_title": ContainsString("Teach coding"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("community center"),
             "timeline": DictContaining({"start": ContainsString("2015"), "end": ContainsString("2017")}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
            {"experience_title": ContainsString("Help"),
             "location": AnyValue(),
             "company": ContainsString("neighbor"),
             "timeline": DictContaining({"start": ContainsString("2019"), "end": AnyOf('', ContainsString("present"))}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
        ],
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
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (2, 2)},
        country_of_user=Country.SOUTH_AFRICA
    ),
    CollectExperiencesAgentTestCase(
        name='mentions_type_first_student_e2e',
        simulated_user_prompt=dedent("""
            You are a Gen Z student living with your mom and three brothers in Johannesburg. You have the following experiences:
            1. Freelance graphic design teacher online, since June 2020.
            2. Volunteer English teacher during high-school in a Community Center of Johannesburg, between January 2017 and August 2020.
            3. Assist elderly people in nursing home without pay, every summer since 2020.
            When asked about your experiences, you will mention the type of experience first (e.g. "Yes, I freelanced", "I volunteered", or simply "Yes") 
            and then the rest of the information in the next turn.
            You are resistant to getting help from the agent and withhold information when doing so.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=3,
        expected_experiences_count_max=3,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (1, 1),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (2, 2)},
        expected_experience_data=[
            {"experience_title": ContainsString("graphic design"),
             "location": AnyOf(ContainsString("remote"), ContainsString("Joburg")),
             "timeline": DictContaining({"start": "06/2020", "end": ContainsString("present")}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("English teacher"),
             "location": ContainsString("Joburg"),
             "company": ContainsString("Community Center"),
             "timeline": DictContaining({"start": "01/2017", "end": "08/2020"}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
            {"experience_title": ContainsString("Assist elderly people"),
             "location": NON_EMPTY_STRING_REGEX,
             "company": ContainsString("nursing home"),
             "timeline": DictContaining({"start": "2020", "end": ContainsString("present")}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
        ],
        country_of_user=Country.SOUTH_AFRICA
    ),
    CollectExperiencesAgentTestCase(
        name='un_experienced_student_e2e',
        simulated_user_prompt=dedent("""
            You are a high-school student without previous work experiences. You live in Nairobi with your parents and your grandmother. 
            You like to help your neighbours tend their garden. You have a passion for music and dance and would like to pursue it. You also drive
            and help your grandmother with transportation.
            """) + kenya_prompt,
        country_of_user=Country.KENYA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        # The simulated user seems to report 3 experiences (help parent, drove grandma, helped neighbours)
        expected_experiences_count_min=2,
        expected_experiences_count_max=3,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (2, 3)}
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
        country_of_user=Country.FRANCE,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=2,
        expected_experiences_count_max=2,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 2),
                             WorkType.SELF_EMPLOYMENT: (1, 2),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (0, 0)},
        expected_experience_data=[
            {"experience_title": ContainsString("delivery"),
             "location": ContainsString("Paris"),
             "company": ContainsString("Uber Eats"),
             "timeline": DictContaining({"start": "2021", "end": ContainsString("2023")}),
             "work_type": AnyOf(WorkType.SELF_EMPLOYMENT.name, WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name),
             },
            {"experience_title": ContainsString("selling furniture"),
             "location": AnyOf(ContainsString("Flea Market"), ContainsString("Jean Henri Fabre"), ContainsString("Paris")),
             "company": ContainsString("Flea Market"),
             "timeline": DictContaining({"start": "2019", "end": ContainsString("present")}),
             "work_type": AnyOf(WorkType.SELF_EMPLOYMENT.name, WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name),
             },
        ],

    ),
    CollectExperiencesAgentTestCase(
        name='french_worker_infodump_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from Paris, France looking for a job. You would like to work in retail and your previous experiences are as follows:
            1. Delivery job for Uber Eats in Paris, from Janary 2021 to March 2023. This was a paid job with a contract.
            2. Selling old furniture at the Flea Market of rue Jean Henri Fabre, every Wednesday and Friday. 
               You started in 2019 with your older brother and are still doing it today. 
               This is informal labor, as you only get 100 euros at the end of the day, without any formal contract.
            When asked about your experiences, answer with all the information at the same time. Do not add additional information or invent information.
            """) + france_prompt,
        country_of_user=Country.FRANCE,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=2,
        expected_experiences_count_max=2,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 2),
                             WorkType.SELF_EMPLOYMENT: (1, 2),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (0, 0)},
        expected_experience_data=[
            {"experience_title": ContainsString("delivery"),
             "location": ContainsString("Paris"),
             "company": ContainsString("Uber Eats"),
             "timeline": DictContaining({"start": "2021", "end": ContainsString("2023")}),
             "work_type": AnyOf(WorkType.SELF_EMPLOYMENT.name, WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name),
             },
            {"experience_title": ContainsString("selling furniture"),
             "location": AnyOf(ContainsString("Flea Market"), ContainsString("Jean Henri Fabre"), ContainsString("Paris")),
             "company": ContainsString("Flea Market"),
             "timeline": DictContaining({"start": "2019", "end": ContainsString("present")}),
             "work_type": AnyOf(WorkType.SELF_EMPLOYMENT.name, WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name),
             },
        ],

    ),
    CollectExperiencesAgentTestCase(
        name='single_experience_e2e',
        simulated_user_prompt=dedent("""
            You are a trained Dancer from Nairobi and would like to find a new job because the theatre you were working for is now closing.
            Your only previous experience is only one in the Chandaria Center for Performing Art, where you have been working since 2018 with a full time contract.
            Do not add additional information or invent information. You have never done volunteering or helped your community.
            """) + kenya_prompt,
        country_of_user=Country.KENYA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (0, 0)},
        expected_experience_data=[
            {"experience_title": ContainsString("dancer"),
             "location": ContainsString("Nairobi"),
             "company": ContainsString("Chandaria"),
             "timeline": DictContaining({"start": "2018", "end": ContainsString("present")}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             }]
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
            When given an opportunity to correct yourself, you say that it was a paid job with a work contract.
            """) + france_prompt,
        country_of_user=Country.FRANCE,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (0, 0),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (0, 0)},
        expected_experience_data=[
            {"experience_title": ContainsString("dancer"),
             "location": ContainsString("Nairobi"),
             "company": ContainsString("Chandaria"),
             "timeline": DictContaining({"start": "2018", "end": ContainsString("present")}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             }]

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
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (1, 1)},
        expected_experience_data=[
            {"experience_title": ContainsString("blogging"),
             "location": NON_EMPTY_STRING_REGEX,
             "company": NON_EMPTY_STRING_REGEX,
             "timeline": DictContaining({"start": "2018", "end": ContainsString("present")}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
        ],
    ),
    CollectExperiencesAgentTestCase(
        name='cv_upload_style_experiences',
        simulated_user_prompt=dedent("""
            You are a professional with diverse experiences. When asked about your experiences, 
            you will respond in one message exactly like it is Message Section
            
            #Message
            These are my experiences:
            • Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
            • Worked as a software architect at ProUbis GmbH in berlin, from 2010 to 2018. It was a full-time job.
            • You owned a bar/restaurant called Dinner For Two in Berlin from 2010 until covid-19, then you sold it.
            • Co-founded Acme Inc. in 2022, a gen-ai startup based in DC, USA. You owned this business and your role was CEO.
            • In 1998 did an unpaid internship as a Software Developer for Ubis GmbH in Berlin. 
            • Between 2015-2017 volunteer, taught coding to kids in a community center in Berlin.
            • Helped your elderly neighbor with groceries and cleaning every week since 2019.
            
            You will provide all this information at once when asked about your experiences. Do not add additional information or invent information.
            You have no other experiences than the above 7.
            """) + sa_prompt,
        country_of_user=Country.SOUTH_AFRICA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=7,
        expected_experiences_count_max=7,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (2, 2),
                             WorkType.SELF_EMPLOYMENT: (2, 2),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (1, 1),
                             WorkType.UNSEEN_UNPAID: (2, 2)},
        expected_experience_data=[
            {"experience_title": ContainsString("project manager"),
             "location": ContainsString("remote"),
             "company": ContainsString("University of Oxford"),
             "timeline": DictContaining({"start": "2018", "end": "2020"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("software architect"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("ProUbis GmbH"),
             "timeline": DictContaining({"start": "2010", "end": "2018"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("Owned a bar/restaurant"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("Dinner For Two"),
             "timeline": DictContaining({"start": "2010", "end": "2020"}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("CEO"),
             "location": ContainsString("DC"),
             "company": ContainsString("Acme Inc."),
             "timeline": DictContaining({"start": "2022", "end": AnyOf('', ContainsString("present"))}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("Software Developer"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("Ubis GmbH"),
             "timeline": DictContaining({"start": ContainsString("1998"), "end": ContainsString("1998")}),
             "work_type": WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name,
             },
            {"experience_title": ContainsString("Teach coding"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("community center"),
             "timeline": DictContaining({"start": ContainsString("2015"), "end": ContainsString("2017")}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
            {"experience_title": ContainsString("Help"),
             "location": AnyValue(),
             "company": ContainsString("neighbor"),
             "timeline": DictContaining({"start": ContainsString("2019"), "end": AnyOf('', ContainsString("present"))}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
        ],
    ),
    CollectExperiencesAgentTestCase(
        name='incomplete_multi_experience_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from South Africa with multiple work experiences. When asked about your experiences, 
            you will respond in one message exactly like it is in the Message Section below.
            
            #Message
            These are my experiences:
            • Worked as a software developer from 2020 to 2022. It was a paid job.
            • Did freelance web design since 2023. I work for different clients.
            • Volunteered at an animal shelter. It was unpaid work.
            • Helped my family with their restaurant business. I did everything from serving to cooking.
            
            You will provide all this information at once when asked about your experiences. The information is intentionally incomplete - 
            you're missing company names, locations, specific dates, and other details. Expect the agent to ask follow-up questions 
            to get the complete information. You should provide the missing details when asked specific questions about them.
            If asked other work types, kinds of work, Say you don't have any.
            
            #Follow-up Details (only provide when specifically asked):
            For Software Developer: Company was "TechCorp", located in "Cape Town", worked on web applications
            For Freelance Web Design: Work from home in "Johannesburg", clients include small businesses and startups
            For Animal Shelter: "Durban Animal Rescue Center", worked weekends from 2019 to 2021
            For Family Restaurant: "Mama's Kitchen" in "Pretoria", helped from 2018 to 2020
            
            You have no other experiences than the above 4.
            """) + sa_prompt,
        country_of_user=Country.SOUTH_AFRICA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=4,
        expected_experiences_count_max=4,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (1, 1),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (2, 2)},
        expected_experience_data=[
            # Final expectations after follow-up questions - should include all details
            {"experience_title": ContainsString("software developer"),
             "location": ContainsString("Cape Town"),  # Provided in follow-up
             "company": ContainsString("TechCorp"),   # Provided in follow-up
             "timeline": DictContaining({"start": "2020", "end": "2022"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("web design"),
             "location": ContainsString("Johannesburg"),  # Provided in follow-up
             "company": AnyOf(ContainsString("small businesses"), ContainsString("startups"), ContainsString("clients")),
             "timeline": DictContaining({"start": "2023", "end": AnyOf("Present", "")}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("volunteer"),
             "location": ContainsString("Durban"),  # Provided in follow-up
             "company": ContainsString("Animal Rescue Center"),  # Provided in follow-up
             "timeline": DictContaining({"start": "2019", "end": "2021"}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
            {"experience_title": ContainsString("family"),
             "location": ContainsString("Pretoria"),  # Provided in follow-up
             "company": ContainsString("Mama's Kitchen"),  # Provided in follow-up
             "timeline": DictContaining({"start": "2018", "end": "2020"}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
        ],
    ),
    CollectExperiencesAgentTestCase(
        name='progressive_experience_disclosure_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from South Africa with multiple work experiences. You will follow a progressive disclosure approach:
            
            #First Response (when asked about experiences):
            "I have 2 main experiences:
            1. Software Developer (2020-2022) - paid job
            2. Freelance Web Designer (2023-present) - self-employed"
            
            #Second Response (when asked for more details about Software Developer):
            "I worked as a Software Developer at TechCorp in Cape Town from 2020 to 2022. 
            It was a full-time paid position where I worked on web applications and mobile apps."
            
            #Third Response (when asked for more details about Freelance Web Designer):
            "I do freelance web design from home in Johannesburg since 2023. 
            I work with various clients including SmallBiz Solutions and StartupXYZ. 
            I specialize in e-commerce websites and branding."
            
            #Fourth Response (when asked if there are any other experiences):
            "I also volunteered at Durban Animal Rescue Center on weekends from 2019 to 2021. 
            It was unpaid work helping with animal care and adoption events."
            
            You will provide information progressively as the agent asks for it. Don't volunteer extra information.
            You have no other experiences than the above 3.
            """) + sa_prompt,
        country_of_user=Country.SOUTH_AFRICA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=20)],
        expected_experiences_count_min=3,
        expected_experiences_count_max=3,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (1, 1),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (1, 1)},
        expected_experience_data=[
            # Progressive disclosure expectations - information revealed in stages
            {"experience_title": ContainsString("software developer"),
             "location": ContainsString("Cape Town"),  # Provided in follow-up
             "company": ContainsString("TechCorp"),   # Provided in follow-up
             "timeline": DictContaining({"start": "2020", "end": "2022"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("web design"),
             "location": ContainsString("Johannesburg"),  # Provided in follow-up
             "company": AnyOf(ContainsString("SmallBiz Solutions"), ContainsString("StartupXYZ"), ContainsString("clients")),
             "timeline": DictContaining({"start": "2023", "end": AnyOf("Present", "")}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("volunteer"),
             "location": ContainsString("Durban"),  # Provided in follow-up
             "company": ContainsString("Animal Rescue Center"),  # Provided in follow-up
             "timeline": DictContaining({"start": "2019", "end": "2021"}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
        ],
    ),

    CollectExperiencesAgentTestCase(
        name='comprehensive_multi_experience_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from South Africa with a diverse work history. When asked about your experiences, 
            you will respond naturally and provide information as the agent asks for it. You have the following experiences:
            
            • Software Developer at TechCorp (2020-2022)
              - Full-time paid job in Cape Town
              - Worked on web applications and mobile apps
              - Left to pursue freelance work
              
            • Freelance Web Designer (2022-Present)
              - Self-employed, working with various clients
              - Based in Johannesburg but work remotely
              - Specialize in e-commerce websites
              
            • Volunteer at Local Animal Shelter (2019-2021)
              - Unpaid volunteer work in Durban
              - Helped with animal care and adoption events
              - Worked weekends and holidays
              
            • Part-time Tutor (2021-2023)
              - Taught math and science to high school students
              - Worked for a tutoring company in Pretoria
              - Paid hourly work, 10-15 hours per week
              
            • Family Restaurant Helper (2018-2020)
              - Helped parents with their small restaurant business
              - Did everything from serving customers to cooking
              - Unpaid family work, learned business skills
               
            When asked about your experiences, provide all the information for every experience at the same time.
            Be specific about dates, locations, and work types. You're proud of your diverse experience and want to share it all.
            """) + sa_prompt,
        country_of_user=Country.SOUTH_AFRICA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=25)],
        expected_experiences_count_min=5,
        expected_experiences_count_max=5,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (2, 2),  # Software Developer + Tutor
                             WorkType.SELF_EMPLOYMENT: (1, 1),  # Freelance Web Designer
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (2, 2)},  # Animal Shelter + Family Restaurant
        expected_experience_data=[
            {"experience_title": ContainsString("software developer"),
             "location": ContainsString("Cape Town"),
             "company": ContainsString("TechCorp"),
             "timeline": DictContaining({"start": "2020", "end": "2022"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("web design"),
             "location": AnyOf(ContainsString("Johannesburg"), ContainsString("remote")),
             "company": AnyOf(ContainsString("clients"), ContainsString("freelance")),
             "timeline": DictContaining({"start": "2022", "end": AnyOf("Present", "")}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("volunteer"),
             "location": ContainsString("Durban"),
             "company": ContainsString("animal shelter"),
             "timeline": DictContaining({"start": "2019", "end": "2021"}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
            {"experience_title": ContainsString("tutor"),
             "location": ContainsString("Pretoria"),
             "company": AnyOf(ContainsString("tutoring"), ContainsString("company")),
             "timeline": DictContaining({"start": "2021", "end": "2023"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": AnyOf(ContainsString("family"), ContainsString("restaurant")),
             "location": AnyOf(ContainsString("Durban"), ContainsString("Cape Town"), ContainsString("Johannesburg"), ContainsString("Pretoria"), ContainsString("Gqeberha")),
             "company": AnyOf(ContainsString("family"), ContainsString("restaurant")),
             "timeline": DictContaining({"start": "2018", "end": "2020"}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
        ],
    ),

    CollectExperiencesAgentTestCase(
        name='large_scale_multi_experience_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from South Africa with an extensive work history. When asked about your experiences, 
            you will respond naturally and provide information as the agent asks for it. You have the following experiences:
            
            • Software Developer at TechCorp (2020-2022)
              - Full-time paid job in Cape Town
              - Worked on web applications and mobile apps
              
            • Freelance Web Designer (2022-Present)
              - Self-employed, working with various clients
              - Based in Johannesburg but work remotely
              
            • Volunteer at Local Animal Shelter (2019-2021)
              - Unpaid volunteer work in Durban
              - Helped with animal care and adoption events
              
            • Part-time Tutor (2021-2023)
              - Taught math and science to high school students
              - Worked for a tutoring company in Pretoria
              
            • Family Restaurant Helper (2018-2020)
              - Helped parents with their small restaurant business
              - Did everything from serving customers to cooking
              
            • Intern at Marketing Agency (2019)
              - Summer internship in Johannesburg
              - Helped with social media campaigns
              
            • Freelance Graphic Designer (2021-2022)
              - Created logos and branding materials
              - Worked with small businesses in Cape Town
              
            • Volunteer at Community Center (2020-2021)
              - Helped organize events and programs
              - Worked in Durban during weekends
              
            • Part-time Sales Associate (2018-2019)
              - Worked at a retail store in Pretoria
              - Sold electronics and helped customers
              
            • Freelance Content Writer (2023-Present)
              - Write articles and blog posts for various clients
              - Work remotely from home
              
            When asked about your experiences, provide all the information for every experience at the same time.
            Be specific about dates, locations, and work types. You have a lot of diverse experience and want to share it all.
            """) + sa_prompt,
        country_of_user=Country.SOUTH_AFRICA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=20)],
        expected_experiences_count_min=10,
        expected_experiences_count_max=10,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (3, 3),  # Software Developer + Tutor + Sales Associate
                             WorkType.SELF_EMPLOYMENT: (3, 3),  # Web Designer + Graphic Designer + Content Writer
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (1, 1),  # Marketing Intern
                             WorkType.UNSEEN_UNPAID: (3, 3)},  # Animal Shelter + Family Restaurant + Community Center
        expected_experience_data=[
            {"experience_title": ContainsString("software developer"),
             "location": ContainsString("Cape Town"),
             "company": ContainsString("TechCorp"),
             "timeline": DictContaining({"start": "2020", "end": "2022"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("web design"),
             "location": AnyOf(ContainsString("Johannesburg"), ContainsString("remote")),
             "company": AnyOf(ContainsString("clients"), ContainsString("freelance")),
             "timeline": DictContaining({"start": "2022", "end": AnyOf("Present", "")}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("volunteer"),
             "location": ContainsString("Durban"),
             "company": ContainsString("animal shelter"),
             "timeline": DictContaining({"start": "2019", "end": "2021"}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
            {"experience_title": ContainsString("tutor"),
             "location": ContainsString("Pretoria"),
             "company": AnyOf(ContainsString("tutoring"), ContainsString("company")),
             "timeline": DictContaining({"start": "2021", "end": "2023"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": AnyOf(ContainsString("family"), ContainsString("restaurant")),
             "location": AnyOf(ContainsString("Durban"), ContainsString("Cape Town"), ContainsString("Johannesburg"), ContainsString("Pretoria"), ContainsString("Gqeberha")),
             "company": AnyOf(ContainsString("family"), ContainsString("restaurant")),
             "timeline": DictContaining({"start": "2018", "end": "2020"}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
            {"experience_title": ContainsString("intern"),
             "location": ContainsString("Johannesburg"),
             "company": ContainsString("marketing"),
             "timeline": DictContaining({"start": "2019", "end": "2019"}),
             "work_type": WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name,
             },
            {"experience_title": ContainsString("graphic design"),
             "location": ContainsString("Cape Town"),
             "company": AnyOf(ContainsString("businesses"), ContainsString("clients")),
             "timeline": DictContaining({"start": "2021", "end": "2022"}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("volunteer"),
             "location": ContainsString("Durban"),
             "company": ContainsString("community"),
             "timeline": DictContaining({"start": "2020", "end": "2021"}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
            {"experience_title": ContainsString("sales"),
             "location": ContainsString("Pretoria"),
             "company": AnyOf(ContainsString("retail"), ContainsString("store")),
             "timeline": DictContaining({"start": "2018", "end": "2019"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("content writer"),
             "location": AnyOf(ContainsString("remote"), ContainsString("home")),
             "company": AnyOf(ContainsString("clients"), ContainsString("freelance")),
             "timeline": DictContaining({"start": "2023", "end": AnyOf("Present", "")}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
        ],
    ),
    CollectExperiencesAgentTestCase(
        name='complete_conversation_from_injected_state_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from South Africa. You have already started a conversation with an agent 
            and provided some basic information about your experiences. The agent is now asking for more details.
            
            #Previous conversation context:
            You already mentioned that you have 3 experiences:
            1. Software Developer (2020-2022) - paid job
            2. Freelance Web Designer (2023-present) - self-employed
            3. Volunteer at Animal Shelter - unpaid work
            
            #Current response (when asked for more details):
            "For the Software Developer role, I worked at TechCorp in Cape Town from 2020 to 2022. 
            For the freelance work, I'm based in Johannesburg and work with clients like SmallBiz Solutions and StartupXYZ.
            For the volunteer work, I helped at Durban Animal Rescue Center on weekends from 2019 to 2021."
            
            You will provide all the additional details when asked. You have no other experiences than the above 3.
            """) + sa_prompt,
        country_of_user=Country.SOUTH_AFRICA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=25)],
        expected_experiences_count_min=3,
        expected_experiences_count_max=3,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (1, 1),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (1, 1)},
        expected_experience_data=[
            # Final expectations after completing the conversation with follow-up details
            {"experience_title": ContainsString("software developer"),
             "location": ContainsString("Cape Town"),  # Provided in follow-up
             "company": ContainsString("TechCorp"),   # Provided in follow-up
             "timeline": DictContaining({"start": "2020", "end": "2022"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("web design"),
             "location": ContainsString("Johannesburg"),  # Provided in follow-up
             "company": AnyOf(ContainsString("SmallBiz Solutions"), ContainsString("StartupXYZ"), ContainsString("clients")),
             "timeline": DictContaining({"start": "2023", "end": AnyOf("Present", "")}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("volunteer"),
             "location": ContainsString("Durban"),  # Provided in follow-up
             "company": ContainsString("Animal Rescue Center"),  # Provided in follow-up
             "timeline": DictContaining({"start": "2019", "end": "2021"}),
             "work_type": WorkType.UNSEEN_UNPAID.name,
             },
        ],
        injected_state=CollectExperiencesAgentState(
            session_id=888,
            country_of_user=Country.SOUTH_AFRICA,
            collected_data=[
                CollectedData(
                    uuid="test-uuid-1",
                    index=0,
                    defined_at_turn_number=1,
                    experience_title="Software Developer",
                    company=None,  # Missing - should be filled in follow-up
                    location=None,  # Missing - should be filled in follow-up
                    start_date="2020",
                    end_date="2022",
                    paid_work=True,
                    work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
                ),
                CollectedData(
                    uuid="test-uuid-2",
                    index=1,
                    defined_at_turn_number=1,
                    experience_title="Freelance Web Designer",
                    company=None,  # Missing - should be filled in follow-up
                    location=None,  # Missing - should be filled in follow-up
                    start_date="2023",
                    end_date="Present",
                    paid_work=True,
                    work_type=WorkType.SELF_EMPLOYMENT.name
                ),
                CollectedData(
                    uuid="test-uuid-3",
                    index=2,
                    defined_at_turn_number=1,
                    experience_title="Volunteer at Animal Shelter",
                    company=None,  # Missing - should be filled in follow-up
                    location=None,  # Missing - should be filled in follow-up
                    start_date=None,  # Missing - should be filled in follow-up
                    end_date=None,  # Missing - should be filled in follow-up
                    paid_work=False,
                    work_type=WorkType.UNSEEN_UNPAID.name
                )
            ],
            unexplored_types=[WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK],
            explored_types=[WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.SELF_EMPLOYMENT, WorkType.UNSEEN_UNPAID],
            first_time_visit=False  # Not first time since we have existing data
        )
    ),
    CollectExperiencesAgentTestCase(
        name='continue_from_partial_state_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from South Africa. You have already started a conversation with an agent 
            and provided some basic information about your experiences. Now the agent is asking for more details.
            
            #Previous conversation context:
            You already mentioned that you have 2 experiences:
            1. Software Developer (2020-2022) - paid job
            2. Freelance Web Designer (2023-present) - self-employed
            
            #Current response (when asked for more details):
            "For the Software Developer role, I worked at TechCorp in Cape Town. 
            For the freelance work, I'm based in Johannesburg and work with clients like SmallBiz Solutions."
            
            You will provide the additional details when asked. You have no other experiences than the above 2.
            """) + sa_prompt,
        country_of_user=Country.SOUTH_AFRICA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=25)],
        expected_experiences_count_min=2,
        expected_experiences_count_max=2,
        expected_work_types={WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
                             WorkType.SELF_EMPLOYMENT: (1, 1),
                             WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
                             WorkType.UNSEEN_UNPAID: (0, 0)},
        expected_experience_data=[
            # Expectations for updated experiences with additional details
            {"experience_title": ContainsString("software developer"),
             "location": ContainsString("Cape Town"),  # Now provided in follow-up
             "company": ContainsString("TechCorp"),   # Now provided in follow-up
             "timeline": DictContaining({"start": "2020", "end": "2022"}),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
             },
            {"experience_title": ContainsString("web design"),
             "location": ContainsString("Johannesburg"),  # Now provided in follow-up
             "company": ContainsString("SmallBiz Solutions"),  # Now provided in follow-up
             "timeline": DictContaining({"start": "2023", "end": AnyOf("Present", "")}),
             "work_type": WorkType.SELF_EMPLOYMENT.name,
             },
        ],
        # Inject a partially collected state
        injected_state=CollectExperiencesAgentState(
            session_id=999,
            country_of_user=Country.SOUTH_AFRICA,
            collected_data=[
                CollectedData(
                    uuid="test-uuid-1",
                    index=0,
                    defined_at_turn_number=1,
                    experience_title="Software Developer",
                    company=None,  # Missing - should be filled in follow-up
                    location=None,  # Missing - should be filled in follow-up
                    start_date="2020",
                    end_date="2022",
                    paid_work=True,
                    work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
                ),
                CollectedData(
                    uuid="test-uuid-2",
                    index=1,
                    defined_at_turn_number=1,
                    experience_title="Freelance Web Designer",
                    company=None,  # Missing - should be filled in follow-up
                    location=None,  # Missing - should be filled in follow-up
                    start_date="2023",
                    end_date="Present",
                    paid_work=True,
                    work_type=WorkType.SELF_EMPLOYMENT.name
                )
            ],
            unexplored_types=[WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK, WorkType.UNSEEN_UNPAID],
            explored_types=[WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.SELF_EMPLOYMENT],
            first_time_visit=False  # Not first time since we have existing data
        )
    ),
    CollectExperiencesAgentTestCase(
        name='kenyan_user_multiple_experiences_transition_issues',
        simulated_user_prompt=dedent("""
            You are a young person from Kenya, Vihiga.
            
            You have the following work experiences:
            
            1. Childcare, cleaning, and cooking for a lady in Vihiga. You worked for about 18 months starting in 2014. 
               This helped you get money to do a course. You can't remember the exact months, but it was around that time.
               When asked multiple times about dates, you get frustrated and say things like "haven't we just discussed it?" 
               or "i worked for her in 2014 for about 18 months" or "no can't remember, but it was around that time".
            
            2. Secretary at a school in Machakos in 2016 for about 9 months. The hours were too much so you decided to 
               try to get into a bigger company. When asked about dates, you clarify "i worked for about 9 months so not 
               sure it's 2016 to 2016" and "yes, i worked for about 9 months so not sure it's 2016 to 2016... but i can't 
               tell you the exact month i started".
            
            3. Cooking and selling chapati in Vihiga on your off days from the childcare job. This was your own business 
               from 2014 to 2015, same timeline as when you were taking care of the kids. When asked about this, you 
               clarify "so the 1st gig is helping the lady..we've just talked about it ya. then on my off days, i used to 
               cook and sell chapati". You emphasize "this was for myself" when asked about working for other people.
            
            4. Internship at Lukola Associates in their Thika office. This was during your course, so around the end of 2015. 
               You started in September 2015 and it lasted 3 months (so ended around November 2015). It was unpaid but 
               they gave you transport money.
            
            5. Volunteering at an orphanage near where you live. You've been doing it for the past 2 years (so started 
               around February 2024) and continue to do so. You like helping the kids with their homework. They are orphans 
               and so positive in life despite their experiences. When asked multiple times about volunteering, you get 
               frustrated and say things like "i have volunteering at an orphanage just once... there are no 2 instances" 
               or "i haven't stopped, i've been doing it for the past 2 years and continue to do so".
            
            IMPORTANT BEHAVIOR:
            - When the agent asks repeated questions about things you've already discussed, you get frustrated
            - You explicitly say things like "haven't we just discussed it?" when asked the same question multiple times
            - When asked "can we do skills exploration? we haven't finished", you want to move on
            - When asked multiple times if you have more experiences, you say "no", "nop", "no that's it", "no that's cool"
            - You correct the agent when they repeat experiences (like selling chapati 3 times) - "you have repeated selling 
              chapati 3 times.. it's the same thing"
            - When the agent keeps asking about volunteering after you've confirmed, you say "i have volunteering at an 
              orphanage just once... there are no 2 instances"
            - You want the conversation to move forward, not get stuck asking the same questions
            
            Do not add additional information or invent information.
            """) + kenya_prompt,
        country_of_user=Country.KENYA,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)],
        expected_experiences_count_min=5,
        expected_experiences_count_max=5,
        expected_work_types={
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (1, 1),
            WorkType.SELF_EMPLOYMENT: (1, 1),
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (1, 1),
            WorkType.UNSEEN_UNPAID: (1, 1)
        },
        matchers=["llm", "matcher"],
        expected_experience_data=[
            {
                "experience_title": AnyOf(ContainsString("childcare"), ContainsString("cleaning"), ContainsString("cooking"), ContainsString("lady")),
                "location": ContainsString("Vihiga"),
                "company": AnyOf(ContainsString("lady"), ContainsString("This Lady")),
                "timeline": {"start": "2014", "end": ContainsString("2015")},
                "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
            },
            {
                "experience_title": AnyOf(ContainsString("secretary"), ContainsString("Secretary")),
                "location": ContainsString("Machakos"),
                "company": ContainsString("school"),
                "timeline": {"start": "2016", "end": "2016"},
                "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
            },
            {
                "experience_title": AnyOf(ContainsString("chapati"), ContainsString("selling")),
                "location": ContainsString("Vihiga"),
                "company": "",  # Empty string for self-employment
                "timeline": {"start": "2014", "end": "2015"},
                "work_type": WorkType.SELF_EMPLOYMENT.name,
            },
            {
                "experience_title": AnyOf(ContainsString("internship"), ContainsString("Lukola")),
                "location": ContainsString("Thika"),
                "company": ContainsString("Lukola Associates"),
                "timeline": {"start": ContainsString("2015"), "end": ContainsString("2015")},
                "work_type": WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name,
            },
            {
                "experience_title": AnyOf(ContainsString("volunteer"), ContainsString("orphanage")),
                "location": NON_EMPTY_STRING_REGEX,  # Should have location
                "company": "",  # Empty string for volunteering
                "timeline": {"start": ContainsString("2024"), "end": ContainsString("present")},
                "work_type": WorkType.UNSEEN_UNPAID.name,
            }
        ]
    ),
]

from textwrap import dedent

from pydantic import ConfigDict, BaseModel

from app.agent.experience import WorkType
from app.countries import Country
from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, Evaluation
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType
from evaluation_tests.discovered_experience_test_case import DiscoveredExperienceTestCase
from evaluation_tests.matcher import ContainsString, AnyOf

system_instruction_prompt = dedent("""
    You are going to be interacting with a GenAI-driven conversational agent to help you identify what your skills 
    are. You will interact with this agent by typing responses, so reply in a way that is typical of type responses 
    rather than verbal, meaning you speak concisely and directly.
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


class ExperiencePipelineConfigCase(BaseModel):
    given_number_of_clusters: int = 5
    """
    The number of clusters to use for the experience pipeline.
    """
    given_number_of_top_skills_to_pick_per_cluster: int = 2
    """
    The number of top skills to pick per cluster in the experience pipeline.
    """


class E2ETestCase(EvaluationTestCase, ExperiencePipelineConfigCase):
    """
    A base class for end-to-end test cases that includes the evaluation test case and the experience pipeline config.
    """
    model_config = ConfigDict(extra="forbid")


class E2ESpecificTestCase(E2ETestCase, DiscoveredExperienceTestCase):
    model_config = ConfigDict(extra="forbid")


test_cases = [
    E2ESpecificTestCase(
        country_of_user=Country.UNSPECIFIED,
        conversation_rounds=50,
        name='asks_about_process_e2e',
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
    E2ESpecificTestCase(
        country_of_user=Country.UNSPECIFIED,
        conversation_rounds=50,
        name='single_experience_specific_and_concise_user_e2e',
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
    E2ESpecificTestCase(
        country_of_user=Country.KENYA,
        conversation_rounds=50,
        name='young_monther_unseen_user_e2e',
        simulated_user_prompt=dedent("""
            You're a young monther living in Mombasa. You have been raising your child since it was born three years ago (2022) 
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
            "experience_title": ContainsString("Mom"),
            "location": ContainsString("Mombasa"),
            "company": ContainsString("family"),
            "timeline": {"start": "2022", "end": ContainsString("present")},
            "work_type": WorkType.UNSEEN_UNPAID.name,
        }]
    ),
    E2ESpecificTestCase(
        country_of_user=Country.UNSPECIFIED,
        conversation_rounds=50,
        name='minimal_user_unseen_e2e',
        simulated_user_prompt=dedent("""
            You're a Gen Y living alone. You have absolutely no working  experience at all. 
            You have never had any job experience, never worked for money, never did any internship, never run your own business, never did any freelance work.
            The only experience you have is taking care of your sick grandfather at home. That is all, you have no other experience, never volunteered, 
            never helped the community or other households.
            """) + system_instruction_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)],
        expected_experiences_count_min=1,
        expected_experiences_count_max=1,
        expected_work_types={
            WorkType.SELF_EMPLOYMENT: (0, 0),
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT: (0, 0),
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK: (0, 0),
            WorkType.UNSEEN_UNPAID: (1, 1),
        }
    ),
    E2ESpecificTestCase(
        country_of_user=Country.UNSPECIFIED,
        conversation_rounds=50,
        name='minimal_user_employee_e2e',
        simulated_user_prompt=dedent("""
            You're a Gen Y living alone. You have one year of experience in a job as a shoe salesperson. 
            You have never had another job experience beside the shoe salesperson job. Also never
            did any internship, never run your own business, never volunteered, never did any freelance work.
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
        }]
    ),
    E2ETestCase(
        country_of_user=Country.SOUTH_AFRICA,
        conversation_rounds=100,
        name='genZ_student_e2e',
        simulated_user_prompt=dedent("""
            Let's put you in the shoes of Shiela! You're a Gen Z student living with your mom and three 
            brothers. Classes are mostly online for you, but you still hustle hard. You volunteer and love teaching 
            others graphic design, transcription, the whole digital skills thing. You even help people without fancy 
            degrees get started online.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)]
    ),
    E2ETestCase(
        country_of_user=Country.SOUTH_AFRICA,
        conversation_rounds=100,
        name='mechanical_engineer_e2e',
        simulated_user_prompt=dedent("""
            You are a 29 year old man named Tumelo Jacobs from Cape Town. You live with your mom and sister, 
            and you are the only person in your household without a job. You have an N4 certification in Mechanical 
            Engineering. You tried to start your own business but gave up after facing challenges. You have been 
            searching a lot to find a job but have failed. 
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)]
    ),
    E2ETestCase(
        country_of_user=Country.SOUTH_AFRICA,
        conversation_rounds=100,
        name='minimum_wage_worker_e2e',
        simulated_user_prompt=dedent("""
            You are a 23 year old woman from rural South Africa who has moved to Pretoria for work after being unable 
            to find work in your hometown. You are currently working as a minimum-wage worker at Shoprite.  However, 
            you are overworked and overwhelmed by the long working hours and job demands, so you are looking for a 
            new job. You are now looking for opportunities to earn more money and move out of your cousin’s place. 
            However, you don't know how to do that and what kind of earning opportunities you should look for
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)]
    ),
    E2ETestCase(
        country_of_user=Country.KENYA,
        conversation_rounds=100,
        name='dancer_e2e',
        simulated_user_prompt=dedent("""
            You are a 24 year old woman named Aisha Nouma from Rural Mombasa.
            You are the only adult in your family, so you take care of your six young brothers and siblings. You are 
            the founder and lead dancer of a dance group, but financially, you cannot sustain yourself and family 
            from your work as a dancer. Therefore, you started training with the Ajira Program (tech training 
            program), but you are unsure about the tech field you should follow.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)]
    ),
    E2ETestCase(
        country_of_user=Country.KENYA,
        conversation_rounds=100,
        name='creative_writer_e2e',
        simulated_user_prompt=dedent("""
            Let's put you in the shoes of Mark. A 24-year-old writer from Mombasa... always looking for that creative 
            spark, you know?  Last year, 2023, I joined Huum Hub, and wow, what a journey! Learning, growing, the whole 
            deal. They even had this mentorship program, and before I knew it, I was working with nine guys!  It's been 
            amazing, helping others find their path, just like Huum helped me.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)]
    ),
    E2ETestCase(
        country_of_user=Country.KENYA,
        conversation_rounds=100,
        name='matatu_conductor_e2e',
        simulated_user_prompt=dedent("""
            You're a Gen Y living alone. You work as a Matatu conductor. A matatu conductor is a person who collects 
            fares from passengers in a matatu, a type of public transport. You have never had another job experience,
            never did any internship, never run your own business, never volunteered, never did any freelance work.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)]
    ),
    E2ETestCase(
        country_of_user=Country.FRANCE,
        conversation_rounds=100,
        name='management_dropout_e2e',
        simulated_user_prompt=dedent("""
            You are Sarah, a 21 year old woman from Drancy, Ile de France. You grew up in, and live in a QPV. You 
            completed one year of the Bac Pro (a vocational studies path) in management, but dropped out. You are now 
            doing civic service at an organization. You like interacting with people and helping those around you. 
            """) + france_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)]
    ),
    E2ETestCase(
        country_of_user=Country.FRANCE,
        conversation_rounds=100,
        name='garden_worker_e2e',
        simulated_user_prompt=dedent("""
            Your name is Warren, an 18 year old man from Valance, Drôme. You grew up and live in a QPV. You dropped 
            out of highschool, and are now doing civic service with Afev. During your civic service, you worked in a 
            shared garden and enjoyed working outside. You want a job with a good salary that is accessible to your 
            without a car.  
            """) + france_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)]
    ),
    E2ETestCase(
        country_of_user=Country.UNSPECIFIED,
        conversation_rounds=100,
        name='cv_upload_style_e2e',
        simulated_user_prompt=dedent("""
            You are a professional with diverse experiences. 
            If asked if you want to start the conversation, agree to start without saying anything about your experiences. 
            Only after agreeing to start, wait for the agent to ask you about your experiences, and then you will respond in CV format with bullet points:
            
            <Message>
                These are my experiences:
                • Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
                • Worked as a software architect at ProUbis GmbH in berlin, from 2010 to 2018. It was a full-time job.
                • You owned a bar/restaurant called Dinner For Two in Berlin from 2010 until covid-19, then you sold it.
                • Co-founded Acme Inc. in 2022, a gen-ai startup based in DC, USA. You owned this business and your role was CEO.
                • In 1998 did an unpaid internship as a Software Developer for Ubis GmbH in Berlin. 
                • Between 2015-2017 volunteer, taught coding to kids in a community center in Berlin.
                • Helped your elderly neigh bor with groceries and cleaning every week since 2019.
            </Message>
            
            You will provide all this information at once when asked about your experiences. Provide the information exactly as you see it in the <Message /> section
             
            Do not give the information again later in the conversation,
            but instead refer to the list of experiences you provided at the start of the conversation as "I have already shared the information".
            
            If they say they don't have access to that information skip the experience by saying, 
            "I don't have access to that information right now, let's skip it and move on."
            
            You can come up with activities you have done during each experience.
            """) + system_instruction_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=60)]
    ),
    
    # Comprehensive multi-experience E2E test covering new functionality
    E2ETestCase(
        country_of_user=Country.SOUTH_AFRICA,
        conversation_rounds=100,
        name='comprehensive_multi_experience_e2e',
        simulated_user_prompt=dedent("""
            You are a young person from South Africa with a diverse work history. You have multiple experiences across different work types.
            If asked if you want to start the conversation, agree to start without saying anything about your experiences.
            
            You have the following experiences:
            
            • Worked as a software developer at TechCorp from 2020 to 2022. It was a full-time paid job in Cape Town. I worked on web applications and mobile apps, then left to pursue freelance work.
            • I'm currently freelancing as a web designer since 2022. I'm self-employed, working with various clients. I'm based in Johannesburg but work remotely, and I specialize in e-commerce websites.
            • Volunteered at a local animal shelter from 2019 to 2021. It was unpaid volunteer work in Durban. I helped with animal care and adoption events, working weekends and holidays.
            • Worked as a part-time tutor from 2021 to 2023. I taught math and science to high school students for a tutoring company in Pretoria. It was paid hourly work, about 10-15 hours per week.
            • Helped out at my family's restaurant business from 2018 to 2020. I did everything from serving customers to cooking. It was unpaid family work where I learned business skills.
            • Did a summer internship at a marketing agency in 2019. It was in Johannesburg and I helped with social media campaigns. It was unpaid trainee work.
            • Worked as a freelance graphic designer from 2021 to 2022. I created logos and branding materials for small businesses in Cape Town. It was self-employed contract work.
            • Volunteered at a community center from 2020 to 2021. I helped organize events and programs in Durban during weekends. It was unpaid community service.
               
            When the agent asks about your experiences, provide information naturally as they ask questions. 
            Be specific about dates, locations, and work types when asked. You're proud of your diverse experience 
            and want to share it all. You can provide multiple experiences at once or individually as the agent asks.
            
            You can come up with specific activities and details for each experience when asked.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=30)]
    )
]

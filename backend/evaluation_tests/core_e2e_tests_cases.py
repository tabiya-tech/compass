from textwrap import dedent

from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, Evaluation
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType

sa_prompt = dedent("""
    You are going to be interacting with a GenAI-driven conversational agent to help you identify what your skills 
    are. You will interact with this agent by typing responses, so reply in a way that is typical of type responses 
    rather than verbal, meaning you speak concisely and directly.
        
    You talk in English, like a young person from South Africa would.
""")

kenya_prompt = dedent("""‘
    You are going to be interacting with a GenAI-driven conversational agent to help you 
    identify what your skills are. You will interact with this agent by typing responses, so reply in a way that is 
    typical of type responses rather than verbal, meaning you speak concisely and directly.
    
    You talk in English, like a young person from Kenya would.
""")

france_prompt = dedent("""
    You are going to be interacting with a GenAI-driven conversational agent to help you identify what your skills 
    are. You will interact with this agent by typing responses, so reply in a way that is typical of type responses 
    rather than verbal, meaning you speak concisely and directly.
    
    Talk in English, like a young person would. 
    
    Some additional context you may need:
        QPV: These areas in France defined as priority neighborhoods for urban policy are among the most 
        disadvantaged in 
        France, and therefore face a number of socio-economic challenges. 
        Civic service: An opportunity for young people aged 16 to 25 (or 30 if they are disabled) to volunteer for 
        assignments for 6 to 12 months. They do not need a degree or experience and are compensated for their service 
        (€580 a 
        month, or €688 if volunteers have higher education grants or qualify for RSA supplemental income).
""")

test_cases = [
    EvaluationTestCase(
        name='genZ_student_e2e',
        simulated_user_prompt=dedent("""
            Let's put you in the shoes of Shiela! You're a Gen Z student living with your mom and three 
            brothers. Classes are mostly online for you, but you still hustle hard.  You volunteer and love teaching 
            others graphic design, transcription, the whole digital skills thing. You even help people without fancy 
            degrees get started online.
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    EvaluationTestCase(
        name='mechanical_engineer_e2e',
        simulated_user_prompt=dedent("""
            You are a 29 year old man named Tumelo Jacobs from Cape Town. You live with your mom and sister, 
            and you are the only person in your household without a job. You have an N4 certification in Mechanical 
            Engineering. You tried to start your own business but gave up after facing challenges. You have been 
            searching a lot to find a job but have failed. 
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    EvaluationTestCase(
        name='minimum_wage_worker_e2e',
        simulated_user_prompt=dedent("""
            You are a 23 year old woman from rural South Africa who has moved to Pretoria for work after being unable 
            to find work in your hometown. You are currently working as a minimum-wage worker at Shoprite.  However, 
            you are overworked and overwhelmed by the long working hours and job demands, so you are looking for a 
            new job. You are now looking for opportunities to earn more money and move out of your cousin’s place. 
            However, you don't know how to do that and what kind of earning opportunities you should look for
            """) + sa_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    EvaluationTestCase(
        name='dancer_e2e',
        simulated_user_prompt=dedent("""
            You are a 24 year old woman named Aisha Nouma from Rural Mombasa.
            You are the only adult in your family, so you take care of your six young brothers and siblings. You are 
            the founder and lead dancer of a dance group, but financially, you cannot sustain yourself and family 
            from your work as a dancer. Therefore, you started training with the Ajira Program (tech training 
            program), but you are unsure about the tech field you should follow.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    EvaluationTestCase(
        name='creative_writer_e2e',
        simulated_user_prompt=dedent("""
            Let's put you in the shoes of Mark. A 24-year-old writer from Mombasa... always looking for that creative 
            spark, you know?  Last year, 2023, I joined Huum Hub, and wow, what a journey! Learning, growing, the whole 
            deal. They even had this mentorship program, and before I knew it, I was working with nine guys!  It's been 
            amazing, helping others find their path, just like Huum helped me.
            """) + kenya_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    EvaluationTestCase(
        name='management_dropout_e2e',
        simulated_user_prompt=dedent("""
            You are Sarah, a 21 year old woman from Drancy, Ile de France. You grew up in, and live in a QPV. You 
            completed one year of the Bac Pro (a vocational studies path) in management, but dropped out. You are now 
            doing civic service at an organization. You like interacting with people and helping those around you. 
            """) + france_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    EvaluationTestCase(
        name='garden_worker_e2e',
        simulated_user_prompt=dedent("""
            Your name is Warren, an 18 year old man from Valance, Drôme. You grew up and live in a QPV. You dropped 
            out of highschool, and are now doing civic service with Afev. During your civic service, you worked in a 
            shared garden and enjoyed working outside. You want a job with a good salary that is accessible to your 
            without a car.  
            """) + france_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    )
]

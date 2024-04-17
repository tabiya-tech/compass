from textwrap import dedent

from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, Evaluation
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType

common_prompt = dedent("""
        Talk in everyday African English, like a young person would. Keep it short and sweet! Use only short, 
        easy sentences and informal language.
        
        Respond in no more than 100 words.
        """)

test_cases = [
    EvaluationTestCase(
        name='kenya_student_e2e',
        simulated_user_prompt=dedent("""
            You are a young student from Kenya trying to find a job. 
            """) + common_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    EvaluationTestCase(
        name='genZ_student_e2e',
        simulated_user_prompt=dedent("""
            Let's put you in the shoes of Shiela! You're a Gen Z student living with your mom and three 
            brothers. Classes are mostly online for you, but you still hustle hard.  You volunteer and love teaching 
            others graphic design, transcription, the whole digital skills thing. You even help people without fancy 
            degrees get started online.
            """) + common_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    EvaluationTestCase(
        name='creative_writer_e2e',
        simulated_user_prompt=dedent("""
            Let's put you in the shoes of Mark. A 24-year-old writer from Mombasa... always looking for that creative 
            spark, you know?  Last year, 2023, I joined Huum Hub, and wow, what a journey! Learning, growing, the whole 
            deal. They even had this mentorship program, and before I knew it, I was working with nine guys!  It's been 
            amazing, helping others find their path, just like Huum helped me.
            """) + common_prompt,
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
]

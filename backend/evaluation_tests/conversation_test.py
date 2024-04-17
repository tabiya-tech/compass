import asyncio
import json
import pprint
from textwrap import dedent

from dotenv import load_dotenv
from langchain_google_vertexai import ChatVertexAI

from app.server import welcome
from evaluation_tests.evaluation_result import TestEvaluationRecord, ConversationRecord, Actor


# TODO(kingam): Make that into a pytest
async def create_conversation():
    prompt = """
        Pretend you are a young student from Kenya trying to find a job.
        Your task is to chat with another entity called COMPASS using that backstory.
        Make your messages specific and make sure to only act as the student. 
        Your messages should be concise and precise and you should never go out of character. You should talk like a
        human and make sure to answer only to the specific prompts you are asked. Answer like a human would answer chat
        messages, answer only what the student would write.
        
        Previous conversation: [{conversation_history}]
        
        Latest chat message: {current_question}
        """
    chain = ChatVertexAI(model_name="gemini-pro")
    conversation = ""
    conversation_history = ""
    evaluation_result = TestEvaluationRecord(simulated_user_prompt=prompt, test_case="E2E Test")
    # TODO(kingam): Also finish the conversation when Compass is done.
    for i in range(0, 4):
        agent_output = (await welcome(user_input=conversation)).last.message_for_user
        evaluation_result.add_conversation_record(
            ConversationRecord(message=agent_output, actor=Actor.EVALUATED_AGENT))
        conversation_history += "COMPASS:" + agent_output
        user_output = (await chain.ainvoke(dedent(prompt.format(conversation_history=conversation_history,
                                                                current_question=agent_output)))).content
        evaluation_result.add_conversation_record(
            ConversationRecord(message=user_output, actor=Actor.SIMULATED_USER))
        conversation_history += "You:" + user_output
    pprint.pprint(json.loads(evaluation_result.to_json()), indent=4)


load_dotenv()
asyncio.run(create_conversation())

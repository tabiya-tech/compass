from typing import Callable

from tqdm import tqdm

from app.agent.agent_types import AgentInput
from evaluation_tests.conversation_libs.agent_executors import ExecuteAgentCallable, CheckAgentFinishedCallable, \
    ExecuteSimulatedUserCallable
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationRecord, Actor


async def generate(*, max_iterations: int,
                   execute_evaluated_agent: Callable,
                   execute_simulated_user: Callable,
                   is_finished: Callable) -> list[ConversationRecord]:
    """
    Generates a complete conversation between a simulated_user and the actor.
    :param max_iterations: The maximum number of iterations for the conversions.
    :param execute_simulated_user: A function that is called to get output from the simulated user.
    :param execute_evaluated_agent: A function that is called to get output from the agent.
    :param is_finished: A function to indicate that the conversation finished, based on the output
        from the executed agent.
    :return: The full record of the conversation.
    """
    conversation = []
    simulated_user_output = ""
    for i in tqdm(range(0, max_iterations), desc='Conversation progress'):
        # Get a response from the evaluated agent.
        agent_output = await execute_evaluated_agent(agent_input=AgentInput(message=simulated_user_output))
        message_for_user = agent_output.message_for_user
        # Checks whether the chatbot is done. And finishes the loop if so.
        if is_finished(agent_output=agent_output):
            print(f'Conversation finished earlier, after {i} out of {max_iterations} iterations.')
            break
        conversation.append(
            ConversationRecord(message=message_for_user, actor=Actor.EVALUATED_AGENT))
        # Get a response from the simulated user.
        simulated_user_output = await execute_simulated_user(turn_number=i, message_for_user=message_for_user)
        conversation.append(
            ConversationRecord(message=simulated_user_output, actor=Actor.SIMULATED_USER))
    return conversation

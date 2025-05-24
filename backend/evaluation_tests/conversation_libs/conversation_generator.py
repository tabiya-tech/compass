import logging
from typing import Awaitable, Protocol

from tqdm import tqdm

from app.agent.agent_types import AgentInput, AgentOutput
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationRecord, Actor

logger = logging.getLogger()


class AgentCallable(Protocol):
    """
    An interface for the callback function that is called to get output from the evaluated agent.
    """
    def __call__(self, *, agent_input: AgentInput) -> Awaitable[AgentOutput]:
        ...


class SimulatedUserCallable(Protocol):
    """
    An interface for the callback function that is called to get output from the simulated user.
    """
    def __call__(self, *, turn_number: int, message_for_user: str) -> Awaitable[str]:
        ...


class FinishedCallable(Protocol):
    """
    An interface for the callback function that is called to check if the conversation is finished.
    """
    def __call__(self, *, agent_output: AgentOutput) -> bool:
        ...


async def generate(*, max_iterations: int,
                   execute_evaluated_agent: AgentCallable,  # Callable[[AgentInput], Awaitable[AgentOutput]],
                   execute_simulated_user: SimulatedUserCallable,  # Callable[[int, str], Awaitable[str]],
                   is_finished: FinishedCallable,  # Callable[[AgentInput], bool]
                   ) -> list[ConversationRecord]:
    """
    Generates a complete conversation between a simulated_user and the actor.
    :param max_iterations: The maximum number of iterations for the conversions.
    :param execute_simulated_user: A function that is called to get output from the simulated user.
    :param execute_evaluated_agent: A function that is called to get output from the agent.
    :param is_finished: A function to indicate that the conversation is finished, based on the output
        from the executed agent.
    :return: The full record of the conversation.
    """
    conversation = []
    simulated_user_output = ""
    for i in tqdm(range(0, max_iterations), desc='Conversation progress'):
        # Get a response from the evaluated agent.
        agent_output = await execute_evaluated_agent(agent_input=AgentInput(message=simulated_user_output))
        message_for_user = agent_output.message_for_user
        logger.info(f'Evaluated Agent: {message_for_user}')
        if message_for_user is None or message_for_user.strip() == "":
            raise ValueError('The evaluated agent did not return a message for the user.')
        conversation.append(ConversationRecord(message=message_for_user, actor=Actor.EVALUATED_AGENT))
        # Checks whether the chatbot is done. And finishes the loop if so.
        if is_finished(agent_output=agent_output):
            logger.info(f'Conversation finished earlier, after {i} out of {max_iterations} iterations.')
            break
        # Get a response from the simulated user.
        simulated_user_output = await execute_simulated_user(turn_number=i, message_for_user=message_for_user)
        simulated_user_output = simulated_user_output.strip()
        logger.info(f'Simulated User: {simulated_user_output}')
        conversation.append(
            ConversationRecord(message=simulated_user_output, actor=Actor.SIMULATED_USER))
    return conversation

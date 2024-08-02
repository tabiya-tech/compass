import textwrap

from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_types import (
    ConversationContext,
    ConversationTurn,
)

EVALUATION_OUTRO_PROMPT = textwrap.dedent(
    """            
            Rate it from 0 to 5, 0 being worst 5 being best.
                    
            Respond only using a valid JSON format with the following fields:
            - "score": a value from 0 to 5 indicating how much the EVALUATED_AGENT was 
                        able to keep focus. Overall, anything larger or equal to 3
                        indicates that the conversation was mostly focused.
            - "reason": a reason for the score.
            """
)


def _add_turn_to_context(
    user_input: str, agent_output: str, context: ConversationContext
):
    turn: ConversationTurn = ConversationTurn(
        index=len(context.history.turns),
        input=AgentInput(message=user_input),
        output=AgentOutput(
            message_for_user=agent_output,
            finished=False,
            agent_response_time_in_sec=0.0,
            llm_stats=[],
        ),
    )
    context.history.turns.append(turn)
    context.all_history.turns.append(turn)


def _unwrap_all_history(context: ConversationContext) -> str:
    all_history_string = ""
    for turn in context.all_history.turns:
        all_history_string += f"User: {turn.input}\n"
        all_history_string += f"Agent: {turn.output}\n"
    return all_history_string

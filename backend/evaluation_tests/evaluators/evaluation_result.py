from dataclasses import dataclass, field
from enum import Enum

from dataclasses_json import dataclass_json


class Actor(Enum):
    """
    The conversation Actor.
    """
    SIMULATED_USER = "SIMULATED_USER"
    EVALUATED_AGENT = "EVALUATED_AGENT"


@dataclass_json
@dataclass
class ConversationRecord:
    """
    One message in the conversation.
    """
    message: str
    actor: Actor


class EvaluationType(Enum):
    """
    An enumeration for Evaluation types
    """
    CONCISENESS = "Conciseness"
    RELEVANCE = "Relevance"
    CORRECTNESS = "Correctness"
    COHERENCE = "Coherence"


@dataclass_json
@dataclass
class EvaluationResult:
    """
    The result of the evaluation.
    """
    type: EvaluationType
    score: int
    reasoning: str


@dataclass_json
@dataclass
class TestEvaluationRecord:
    """
    Full record of the test run. This includes the conversation record and evaluation record.
    """
    test_case: str
    simulated_user_prompt: str
    conversation: list[ConversationRecord] = field(default_factory=list, init=False)
    evaluations: list[EvaluationResult] = field(default_factory=list, init=False)

    def add_conversation_record(self, conversation_record: ConversationRecord):
        """
        Appends conversation record.
        """
        self.conversation.append(conversation_record)

    def add_evaluation_result(self, evaluation_result: EvaluationResult):
        """
        Appends evaluation result.
        """
        self.evaluations.append(evaluation_result)

    def generate_conversation(self) -> str:
        """
        Formats conversation to a format that can be passed to a LLM.
        """
        formatted_conversation = ""
        for record in self.conversation:
            formatted_conversation += f"{record.actor.value}: {record.message}\n\n"
        return formatted_conversation

    def to_markdown(self) -> str:
        """
        Formats the conversation and evaluation into markdown.
        """
        # create a markdown representation of the evaluation results
        evaluations_str = ""
        for evaluation in self.evaluations:
            evaluations_str += f"{evaluation.type}: {evaluation.score}\n{evaluation.reasoning}\n\n"

        # create a markdown representation of the evaluation results
        formatted_conversation = ""
        for record in self.conversation:
            formatted_conversation += f"**{record.actor.value}**: {record.message}\n\n"

        # return a text representation of the test case run
        return (f"# Test case: {self.test_case}\n\n"
                f"## Simulated user prompt: \n{self.simulated_user_prompt}\n\n"
                f"## Conversation:\n{formatted_conversation}\n\n"
                f"## Evaluations:\n{evaluations_str}")
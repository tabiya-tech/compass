from dataclasses import dataclass, field
from enum import Enum

from dataclasses_json import dataclass_json


class Actor(Enum):
    SIMULATED_USER = "Human"
    EVALUATED_AGENT = "Bot"


@dataclass_json
@dataclass
class ConversationRecord:
    message: str
    actor: Actor


@dataclass_json
@dataclass
class EvaluationResult:
    type: str
    score: float
    reasoning: str


@dataclass_json
@dataclass
class TestEvaluationRecord:
    test_case: str
    simulated_user_prompt: str
    conversation: list[ConversationRecord] = field(default_factory=list, init=False)
    evaluations: list[EvaluationResult] = field(default_factory=list, init=False)

    def add_conversation_record(self, conversation_record: ConversationRecord):
        self.conversation.append(conversation_record)

    def add_evaluation_result(self, evaluation_result: EvaluationResult):
        self.evaluations.append(evaluation_result)

    def generate_conversation(self):
        formatted_conversation = ""
        for record in self.conversation:
            formatted_conversation += f"{record.actor.value}: {record.message}\n"
        return formatted_conversation

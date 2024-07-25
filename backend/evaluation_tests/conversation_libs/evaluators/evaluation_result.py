import json
import logging
import os
from enum import Enum
from typing import Callable, TextIO

from pydantic import BaseModel, Field

from app.conversation_memory.save_conversation_context import format_for_markdown, MD_NEW_LINE

logger = logging.getLogger()


class Actor(Enum):
    """
    The conversation Actor.
    """
    SIMULATED_USER = "SIMULATED_USER"
    EVALUATED_AGENT = "EVALUATED_AGENT"


class ConversationRecord(BaseModel):
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
    FOCUS = "Focus"
    SUMMARY_CONSISTENCY = "Summary Consistency"
    SUMMARY_RELEVANCE = "Summary Relevance"


class EvaluationResult(BaseModel):
    """
    The result of the evaluation.
    """
    type: EvaluationType
    score: int
    reasoning: str


class EvaluationRecord(BaseModel):
    test_case: str
    """
    The test case name.
    """

    conversation: list[ConversationRecord] = Field(default_factory=list)
    """
    The conversation records a perceived by the simulated user.
    """

    evaluations: list[EvaluationResult] = Field(default_factory=list)
    """
    The evaluation results.
    """

    def add_conversation_record(self, conversation_record: ConversationRecord):
        """
        Appends conversation record.
        """
        self.conversation.append(conversation_record)

    def add_conversation_records(self, records: list[ConversationRecord]):
        """
        Appends multiple conversation records.
        """
        self.conversation.extend(records)

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

    def _to_markdown(self) -> str:
        raise NotImplementedError()

    def save_data(self, folder: str, base_file_name: str):
        """
        Save the conversation and the evaluation in json (.json) and markdown (.md) formats
        in the specified folder and file name.
        :param folder: The folder to save the conversation and evaluation.
        :param base_file_name: The base file name to save the conversation and evaluation.
        :return:
        """
        base_path = os.path.join(folder, base_file_name)
        logger.info(f'The full conversation and evaluation is saved at file:///{base_path}.json \n file:///{base_path}.md')
        # Save the evaluation result to a json file
        _save_to_file(base_path + '.json',
                      lambda f: json.dump(json.loads(self.json()), f, ensure_ascii=False, indent=4))
        # Save the evaluation result to a markdown file
        _save_to_file(base_path + '.md', lambda f: f.write(self._to_markdown()))

    def _get_evaluations_str(self) -> str:
        """
        create a markdown representation of the evaluation results
        :return:
        """
        evaluations_str = ""
        for evaluation in self.evaluations:
            evaluations_str += f"**{evaluation.type}**: {evaluation.score}  \n**Reasoning**:{evaluation.reasoning}\n\n"
        return evaluations_str

    def _get_formatted_conversation(self) -> str:
        """
        create a markdown representation of the evaluation results
        :return:
        """
        formatted_conversation = ""
        for i, record in enumerate(self.conversation, start=1):
            if i % 2 == 0:
                suffix = "\n\n"
            else:
                suffix = f"{MD_NEW_LINE}"
            formatted_conversation += f"**{record.actor.value}**: {format_for_markdown(record.message)}{suffix}"
        return formatted_conversation


class ConversationEvaluationRecord(EvaluationRecord):
    """
    Full record of the conversation test run. This includes the conversation record and evaluation record.
    """

    simulated_user_prompt: str
    """
    The simulated user prompt.
    """

    def _to_markdown(self) -> str:
        """
        Formats the conversation and evaluation into markdown.
        """
        # return a text representation of the test case run
        return (f"# Test case: {self.test_case}\n\n"
                f"## Simulated user prompt:\n{self.simulated_user_prompt}\n\n"
                f"## Conversation:\n{self._get_formatted_conversation()}\n\n"
                f"## Evaluations:\n{self._get_evaluations_str()}")


class SummaryEvaluationRecord(EvaluationRecord):
    """
    Full record of the summary test run. This includes the summaries, the conversation record and evaluation record.
    """

    current_summary: str
    """
    The current summary of the conversation.
    """

    new_summary: str
    """
    The new generated summary of the conversation.
    """

    evaluations: list[EvaluationResult] = Field(default_factory=list)
    """
    The evaluation results.
    """

    def _to_markdown(self) -> str:
        """
        Formats the summary, conversation and evaluation into markdown.
        """
        # return a text representation of the test case run
        return (f"# Test case: {self.test_case}\n\n"
                f"## Current summary:\n{self.current_summary}\n\n"
                f"## Conversation:\n{self._get_formatted_conversation()}\n\n"
                f"## New summary:\n{self.new_summary}\n\n"
                f"## Evaluations:\n{self._get_evaluations_str()}")


def _save_to_file(file_path: str, callback: Callable[[TextIO], None]):
    """
    Save contents to a file.
    :param file_path: The path to the file, including the file name. If the paths do not exist, they will be created.
    :param callback: A callback function that should be called to write the content to the file.
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        callback(f)

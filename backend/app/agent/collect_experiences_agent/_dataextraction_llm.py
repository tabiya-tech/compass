import asyncio
import logging
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import AgentInput, LLMStats
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.collect_experiences_agent.data_extraction_llm import DataOperation
from app.agent.collect_experiences_agent.data_extraction_llm import EntityExtractionTool
from app.agent.collect_experiences_agent.data_extraction_llm import IntentAnalyzerTool
from app.agent.collect_experiences_agent.data_extraction_llm import OperationsProcessor
from app.agent.collect_experiences_agent.data_extraction_llm import \
    TemporalAndWorkTypeClassifierTool
from app.agent.llm_caller import LLMCaller
from app.conversation_memory.conversation_memory_types import ConversationContext


class _CollectedDataWithReasoning(CollectedData):
    data_extraction_references: Optional[str | dict] = ""
    dates_mentioned: Optional[str] = ""
    dates_calculations: Optional[str] = ""
    work_type_classification_reasoning: Optional[str] = ""
    data_operation_reasoning: Optional[str] = ""
    data_operation: Optional[str] = ""

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"


class _CollectedExperience(BaseModel):
    associations: Optional[str] = ""
    ignored_experiences: Optional[str] = None
    collected_experience_data: Optional[list[_CollectedDataWithReasoning]] = None

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"


class _DataExtractionLLM:
    def __init__(self, logger: logging.Logger):
        self._llm_caller = LLMCaller[_CollectedExperience](model_response_type=_CollectedExperience)
        self.logger = logger

        # initialize tools used by the LLM
        self._experience_data_processor = EntityExtractionTool(logger)
        self._intent_analyzer_tool = IntentAnalyzerTool(logger)
        self._temporal_classifier_tool = TemporalAndWorkTypeClassifierTool(logger)

        self._operations_processor = OperationsProcessor(logger)

    async def _get_extracted_experience_data(self,
                                             *,
                                             index: Optional[int],
                                             data_operation: DataOperation,
                                             turn_number: int,
                                             experience_title: str,
                                             conversation_context: ConversationContext,
                                             user_statement: str) -> tuple[_CollectedDataWithReasoning, list[LLMStats]]:

        [(experience_details, experience_llm_stats),
         (timestamps_and_work_type, time_llm_stats)] = await asyncio.gather(
            self._experience_data_processor.execute(
                conversation_context=conversation_context,
                users_last_input=user_statement
            ),
            self._temporal_classifier_tool.execute(
                conversation_context=conversation_context,
                users_last_input=user_statement,
                experience_title=experience_title)
        )

        return _CollectedDataWithReasoning(
            index=index,
            data_operation=data_operation.value,
            experience_title=experience_details.experience_title,
            defined_at_turn_number=turn_number if data_operation == DataOperation.ADD else None,
            company=experience_details.company,
            location=experience_details.location,
            paid_work=timestamps_and_work_type.paid_work,
            work_type=timestamps_and_work_type.work_type,
            start_date=timestamps_and_work_type.start_date,
            end_date=timestamps_and_work_type.end_date
        ), experience_llm_stats + time_llm_stats

    async def execute(self,
                      *,
                      user_input: AgentInput,
                      context: ConversationContext,
                      collected_experience_data_so_far: list[CollectedData]
                      ) -> tuple[int, list[LLMStats]]:
        """
        Given the last user input, a conversation history and the experience data collected so far.
        Extracts the experience data from the user input and conversation history and
        updates the collected experience data.

        :param user_input:  The user's last input
        :param context: The conversation context with the conversation history
        :param collected_experience_data_so_far: The collected experience data so far
        :return: Tuple of the last referenced experience index and the LLM stats
        """

        # 1. Get the list of operations from the user's input
        commands, llm_stats = await self._intent_analyzer_tool.execute(
            collected_experience_data_so_far=collected_experience_data_so_far,
            conversation_context=context,
            users_last_input=user_input)

        # 2. Construct the list of operations with full details,
        #    if missing data, we need to call respective tools to fill the operations.
        operations: list[_CollectedDataWithReasoning] = []
        update_tasks = []
        ids_to_delete = []
        new_experiences_counter = len(collected_experience_data_so_far) - 1  # start from the last index + 1
        for command in commands:
            if command.data_operation.lower() == DataOperation.DELETE.value.lower():
                if command.index is None:
                    self.logger.error(f"Invalid experience to delete, {command}")
                    continue

                current_index = command.index
                existing_experience = \
                list(filter(lambda exp: exp.index == current_index, collected_experience_data_so_far))[0] or {}
                operations.append(_CollectedDataWithReasoning(
                    **existing_experience.model_dump(exclude={"index"}),
                    data_operation=DataOperation.DELETE.value,
                    index=command.index
                ))
                ids_to_delete.append(command.index)
            else:
                if command.data_operation.lower() == DataOperation.ADD.value.lower():
                    new_experiences_counter += 1

                index = command.index if command.data_operation.lower() == DataOperation.UPDATE.value.lower() else new_experiences_counter
                if index is None:
                    self.logger.error(f"Invalid experience to update, {command}")
                    continue

                update_tasks.append(self._get_extracted_experience_data(
                    index=command.index if command.data_operation.lower() == DataOperation.UPDATE.value.lower() else new_experiences_counter,
                    turn_number=len(context.all_history.turns),
                    data_operation=DataOperation.from_string_key(command.data_operation),
                    experience_title=command.potential_new_experience_title,
                    conversation_context=context,
                    user_statement=command.users_statement
                ))

        update_results = await asyncio.gather(*update_tasks)
        for (result, _llm_stats) in update_results:
            llm_stats.extend(_llm_stats)

            operations.append(result)

        valid_operations = []
        for operation in operations:
            # if an index is both in to delete and we have another operation with the same index, we skip it.
            # And only prioritize the delete operations.
            if operation.index in ids_to_delete and operation.data_operation != DataOperation.DELETE.value:
                continue
            else:
                valid_operations.append(operation)

        operations = valid_operations

        self.logger.debug(f"Operations= {operations}")

        last_referenced_index, _ = self._operations_processor.process(
            operations,
            collected_experience_data_so_far=collected_experience_data_so_far,
            current_conversation_turn_index=len(context.all_history.turns))

        # Re-index the experiences
        index_counter = 0
        for collected_data in collected_experience_data_so_far:
            collected_data.index = index_counter
            index_counter += 1

        return last_referenced_index, llm_stats

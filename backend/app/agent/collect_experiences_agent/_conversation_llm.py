import logging

import time
from datetime import datetime
from textwrap import dedent

from app.agent.agent_types import AgentInput, AgentOutput, AgentType, LLMStats
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience import ExperienceEntity
from app.agent.experience.work_type import WORK_TYPE_DEFINITIONS_FOR_PROMPT, WorkType
from app.agent.penalty import get_penalty
from app.agent.prompt_template.agent_prompt_template import STD_AGENT_CHARACTER, STD_LANGUAGE_STYLE
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationHistory
from app.countries import Country
from app.i18n.translation_service import t
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LLMResponse, get_config_variation, LLMInput
from common_libs.retry import Retry

def _no_experience_collected(locale: str) -> str:
    return t("prompts", "collect_experiences_no_experience_collected", locale)


def _final_message(locale: str) -> str:
    return t("prompts", "collect_experiences_final_message", locale)


def _find_incomplete_experiences(collected_data: list[CollectedData]) -> list[tuple[int, CollectedData, list[str]]]:
    """
    Find incomplete experiences and return them with their index and missing fields.
    Returns a list of tuples: (index, experience, missing_fields)
    """
    incomplete_experiences = []
    for i, experience in enumerate(collected_data):
        if CollectedData.is_incomplete(experience):
            missing_fields = CollectedData.get_missing_fields(experience)
            incomplete_experiences.append((i, experience, missing_fields))
    return incomplete_experiences


def _get_incomplete_experiences_instructions(collected_data: list[CollectedData], locale: str) -> str:
    """
    Generate instructions for handling incomplete experiences.
    """
    incomplete_experiences = _find_incomplete_experiences(collected_data)
    
    if not incomplete_experiences:
        return ""

    incomplete_experiences_list = []
    for i, (index, experience, missing_fields) in enumerate(incomplete_experiences, 1):
        missing_fields_str = ", ".join(missing_fields)
        incomplete_experiences_list.append(
            t(
                "prompts",
                "collect_experiences_incomplete_item",
                locale,
                order=i,
                number=index + 1,
                title=experience.experience_title or "",
                missing_fields=missing_fields_str,
            )
        )
    
    incomplete_experiences_text = "\n".join(incomplete_experiences_list)
    
    instructions_template = t("prompts", "collect_experiences_incomplete_priority_header", locale)
    return replace_placeholders_with_indent(
        instructions_template,
        incomplete_experiences_list=incomplete_experiences_text,
    )


class ConversationLLMAgentOutput(AgentOutput):
    exploring_type_finished: bool = False


class _ConversationLLM:

    @staticmethod
    async def execute(*,
                      first_time_visit: bool,
                      user_input: AgentInput,
                      country_of_user: Country,
                      context: ConversationContext,
                      collected_data: list[CollectedData],
                      exploring_type: WorkType | None,
                      unexplored_types: list[WorkType],
                      explored_types: list[WorkType],
                      last_referenced_experience_index: int,
                      logger: logging.Logger,
                      locale: str) -> ConversationLLMAgentOutput:
        async def _callback(attempt: int, max_retries: int) -> tuple[ConversationLLMAgentOutput, float, BaseException | None]:
            # Call the LLM to get the next message for the user
            # Add some temperature and top_p variation to prompt the LLM to return different results on each retry.
            # Exponentially increase the temperature and top_p to avoid the LLM returning the same result every time.
            temperature_config = get_config_variation(start_temperature=0.25, end_temperature=0.5,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)
            logger.debug("Calling _ConversationLLM with temperature: %s, top_p: %s",
                         temperature_config["temperature"],
                         temperature_config["top_p"])
            return await _ConversationLLM._internal_execute(
                temperature_config=temperature_config,
                first_time_visit=first_time_visit,
                user_input=user_input,
                country_of_user=country_of_user,
                context=context,
                collected_data=collected_data,
                exploring_type=exploring_type,
                unexplored_types=unexplored_types,
                explored_types=explored_types,
                last_referenced_experience_index=last_referenced_experience_index,
                logger=logger,
                locale=locale
            )

        result, _result_penalty, _error = await Retry[ConversationLLMAgentOutput].call_with_penalty(callback=_callback, logger=logger)
        return result

    @staticmethod
    async def _internal_execute(*,
                                temperature_config: dict,
                                first_time_visit: bool,
                                user_input: AgentInput,
                                country_of_user: Country,
                                context: ConversationContext,
                                collected_data: list[CollectedData],
                                exploring_type: WorkType | None,
                                unexplored_types: list[WorkType],
                                explored_types: list[WorkType],
                                last_referenced_experience_index: int,
                                logger: logging.Logger,
                                locale: str) -> tuple[ConversationLLMAgentOutput, float, BaseException | None]:
        """
        Converses with the user and asks probing questions to collect experiences.
        :param first_time_visit: If this is the first time the user is visiting the agent.
        :param user_input: The user input.
        :param country_of_user: The country of the user.
        :param context: The conversation context.
        :param collected_data:
        :param exploring_type: The type of work experience the agent is exploring.
        :param unexplored_types: The types of work experience that have not been explored yet.
        :param explored_types: The types of work experience that have been explored.
        :param last_referenced_experience_index: The index of the last referenced experience in the collected data.
        :param logger: The logger.
        :return: The agent output with the next message for the user and finished flag
                 set to True if the conversation is
        finished.
        """
        if user_input.message == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"
            user_input.is_artificial = True
        msg = user_input.message.strip()  # Remove leading and trailing whitespaces
        llm_start_time = time.time()

        exploring_type_finished = False
        finished = False
        llm_response: LLMResponse
        llm_input: LLMInput | str
        system_instructions: list[str] | str | None = None
        if first_time_visit:
            # If this is the first time the user has visited the agent, the agent should get to the point
            # and not introduce itself or ask how the user is doing.
            llm = GeminiGenerativeLLM(
                system_instructions=None,
                config=LLMConfig(
                    generation_config=temperature_config
                ))
            llm_input = _ConversationLLM._get_first_time_generative_prompt(
                country_of_user=country_of_user,
                exploring_type=exploring_type,
                locale=locale)
            llm_response = await llm.generate_content(llm_input=llm_input)
        else:
            system_instructions = _ConversationLLM._get_system_instructions(country_of_user=country_of_user,
                                                                            collected_data=collected_data,
                                                                            exploring_type=exploring_type,
                                                                            unexplored_types=unexplored_types,
                                                                            explored_types=explored_types,
                                                                            last_referenced_experience_index=last_referenced_experience_index,
                                                                            locale=locale)
            llm = GeminiGenerativeLLM(
                system_instructions=system_instructions,
                config=LLMConfig(
                    generation_config=temperature_config
                ))
            # Drop the first message from the conversation history, which is the welcome message from the welcome agent.
            # This message is treated as an instruction and causes the conversation to go off track.
            filtered_history = [turn for turn in context.history.turns if turn.output.agent_type == AgentType.COLLECT_EXPERIENCES_AGENT]
            filtered_context = ConversationContext(all_history=ConversationHistory(turns=filtered_history),
                                                   history=ConversationHistory(turns=filtered_history),
                                                   summary=context.summary)
            # Filter all turns that are not from this agent
            llm_input = ConversationHistoryFormatter.format_for_agent_generative_prompt(
                model_response_instructions=None,
                context=filtered_context,
                user_input=msg)
            llm_response = await llm.generate_content(llm_input=llm_input)

        llm_output_empty_penalty_level = 1
        conversation_prematurely_ended_penalty_level = 0

        llm_end_time = time.time()
        llm_stats = LLMStats(prompt_token_count=llm_response.prompt_token_count,
                             response_token_count=llm_response.response_token_count,
                             response_time_in_sec=round(llm_end_time - llm_start_time, 2))

        llm_response.text = llm_response.text.strip()
        if llm_response.text == "":
            sys_instr_for_log = (
                system_instructions if isinstance(system_instructions, str)
                else ("\n".join(system_instructions) if isinstance(system_instructions, list) else "<none>")
            )
            logger.warning("LLM response is empty. "
                           "\n  - System instructions: %s"
                           "\n  - LLM input: %s",
                           sys_instr_for_log,
                           llm_input)
            return ConversationLLMAgentOutput(
                message_for_user=t("prompts", "collect_experiences_empty_response_message", locale),
                exploring_type_finished=False,
                finished=False,
                agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                agent_response_time_in_sec=round(llm_end_time - llm_start_time, 2),
                llm_stats=[llm_stats]), get_penalty(llm_output_empty_penalty_level), ValueError("Conversation LLM response is empty")

        penalty: float = 0
        error: BaseException | None = None

        # Test if the response is the same as the previous two
        if llm_response.text.find("<END_OF_WORKTYPE>") != -1:
            # We finished a work type (and it is not the last one) we need to move to the next one
            if llm_response.text != "<END_OF_WORKTYPE>":
                logger.warning("The response contains '<END_OF_WORKTYPE>' and additional text: %s", llm_response.text)
            exploring_type_finished = True
            finished = False
            llm_response.text = t("prompts", "collect_experiences_move_on_other_worktypes", locale)

        if llm_response.text.find("<END_OF_CONVERSATION>") != -1:
            if llm_response.text != "<END_OF_CONVERSATION>":
                logger.warning("The response contains '<END_OF_CONVERSATION>' and additional text: %s", llm_response.text)
            if len(unexplored_types) > 0:
                penalty = get_penalty(conversation_prematurely_ended_penalty_level)
                error = ValueError(f"LLM response contains '<END_OF_CONVERSATION>' but there are unexplored types: {unexplored_types}")
                logger.error(error)

            llm_response.text = _final_message(locale)
            exploring_type_finished = False
            finished = True

        return ConversationLLMAgentOutput(
            message_for_user=llm_response.text,
            exploring_type_finished=exploring_type_finished,
            finished=finished,
            agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
            agent_response_time_in_sec=round(llm_end_time - llm_start_time, 2),
            llm_stats=[llm_stats]), penalty, error

    @staticmethod
    def _get_system_instructions(*,
                                 country_of_user: Country,
                                 collected_data: list[CollectedData],
                                 exploring_type: WorkType | None,
                                 unexplored_types: list[WorkType],
                                 explored_types: list[WorkType],
                                 last_referenced_experience_index: int,
                                 locale: str) -> str:
        system_instructions_template = t("prompts", "collect_experiences_system_instructions", locale)

        return replace_placeholders_with_indent(system_instructions_template,
                                                country_of_user_segment=_get_country_of_user_segment(country_of_user, locale),
                                                agent_character=STD_AGENT_CHARACTER,
                                                language_style=STD_LANGUAGE_STYLE,
                                                exploring_type_instructions=_get_explore_experiences_instructions(
                                                    collected_data=collected_data,
                                                    exploring_type=exploring_type,
                                                    explored_types=explored_types,
                                                    locale=locale
                                                ),
                                                collected_experience_data=_get_collected_experience_data(collected_data, locale),
                                                incomplete_experiences_instructions=_get_incomplete_experiences_instructions(collected_data, locale),
                                                missing_fields=_get_missing_fields(collected_data, last_referenced_experience_index, locale),
                                                not_missing_fields=_get_not_missing_fields(collected_data, last_referenced_experience_index, locale),
                                                work_type_definitions=WORK_TYPE_DEFINITIONS_FOR_PROMPT,
                                                transition_instructions=_transition_instructions(
                                                    collected_data=collected_data,
                                                    exploring_type=exploring_type,
                                                    unexplored_types=unexplored_types,
                                                    locale=locale
                                                ),
                                                last_referenced_experience=_get_last_referenced_experience(collected_data, last_referenced_experience_index, locale),
                                                example_summary=_get_example_summary(),
                                                current_date=datetime.now().strftime("%Y/%m")
                                                )

    @staticmethod
    def _get_first_time_generative_prompt(*,
                                          country_of_user: Country,
                                          exploring_type: WorkType | None,
                                          locale: str):
        # Ideally, we want to include the language style in the prompt.
        # However, doing so seems to break the prompt.
        # So we're excluding it for now until we find a solution.
        first_time_generative_prompt = t("prompts", "collect_experiences_first_time_prompt", locale)
        question = _ask_experience_type_question(exploring_type, locale) if exploring_type is not None else t("prompts", "collect_experiences_question_generic", locale)
        return replace_placeholders_with_indent(first_time_generative_prompt,
                                               country_of_user_segment=_get_country_of_user_segment(country_of_user, locale),
                                               question_to_ask=question)


def _transition_instructions(*,
                             collected_data: list[CollectedData],
                             exploring_type: WorkType | None,
                             unexplored_types: list[WorkType],
                             locale: str):
    # Check if there are incomplete experiences that need to be completed first
    incomplete_experiences = _find_incomplete_experiences(collected_data)
    if incomplete_experiences:
        return t("prompts", "collect_experiences_transition_incomplete", locale)
    
    # if not all_fields_collected: # need to fill missing fields
    #    return dedent("""\
    #        To transition to the next phase you must ask questions to fill the missing fields for the experiences that I shared with you.
    #        Inspect the '#Collected Experience Data' to see which fields are missing and continue asking questions
    #        to fill the missing fields based on the '#Gather Details' instructions.
    #        """)
    # elif len(unexplored_types) > 0: # need to collect more experiences
    if len(unexplored_types) > 0:  # need to collect more experiences
        _instructions = t("prompts", "collect_experiences_transition_more_experiences", locale)
        return replace_placeholders_with_indent(
            _instructions,
            exploring_type=_get_experience_type(exploring_type, locale) if exploring_type is not None else "",
        )
    else:  # Summarize and confirm the collected data

        duplicate_hint = ""
        if len(collected_data) > 1:
            duplicate_hint = t("prompts", "collect_experiences_duplicate_hint", locale) + "\n"
        summarize_and_confirm = t("prompts", "collect_experiences_summarize_and_confirm", locale)
        return replace_placeholders_with_indent(summarize_and_confirm,
                                                summary_of_experiences=_get_summary_of_experiences(collected_data, locale),
                                                duplicate_hint=duplicate_hint)


def _get_collected_experience_data(collected_data: list[CollectedData], locale: str) -> str:
    if len(collected_data) == 0:
        return _no_experience_collected(locale)

    all_experiences = ",".join([_data.model_dump_json() for _data in collected_data])

    return dedent(f"[{all_experiences}]\n" + t("prompts", "collect_experiences_null_value_explanation", locale))


def _get_last_referenced_experience(collected_data: list[CollectedData], last_referenced_experience_index: int, locale: str) -> str:
    if last_referenced_experience_index < 0 or last_referenced_experience_index >= len(collected_data):
        return _no_experience_collected(locale)
    experience = collected_data[last_referenced_experience_index].model_dump_json()
    return dedent(f"{experience}\n" + t("prompts", "collect_experiences_null_value_explanation", locale))


def _get_missing_fields(collected_data: list[CollectedData], index: int, locale: str) -> str:
    if index < 0 or index >= len(collected_data):
        return _no_experience_collected(locale)

    experience_data: CollectedData = collected_data[index]

    missing_fields = []
    if experience_data.experience_title is None:
        missing_fields.append(t("prompts", "collect_experiences_field_experience_title", locale))
    # if experience_data.paid_work is None:
    #    missing_fields.append("paid_work")
    # if experience_data.work_type is None:
    #    missing_fields.append("work_type")
    if experience_data.start_date is None:
        missing_fields.append(t("prompts", "collect_experiences_field_start_date", locale))
    if experience_data.end_date is None:
        missing_fields.append(t("prompts", "collect_experiences_field_end_date", locale))
    if experience_data.company is None:
        missing_fields.append(t("prompts", "collect_experiences_field_company", locale))
    if experience_data.location is None:
        missing_fields.append(t("prompts", "collect_experiences_field_location", locale))
    if len(missing_fields) == 0:
        return t("prompts", "collect_experiences_all_fields_filled", locale)
    return ", ".join(missing_fields)


def _get_not_missing_fields(collected_data: list[CollectedData], index: int, locale: str) -> str:
    if index < 0 or index >= len(collected_data):
        return _no_experience_collected(locale)

    experience_data: CollectedData = collected_data[index]

    not_missing_fields = []
    if experience_data.experience_title is not None:
        not_missing_fields.append(t("prompts", "collect_experiences_field_experience_title", locale))
    # if experience_data.paid_work is not None:
    #    not_missing_fields.append("paid_work")
    # if WorkType.from_string_key(experience_data.work_type) is not None:
    #    not_missing_fields.append("work_type")
    if experience_data.start_date is not None:
        not_missing_fields.append(t("prompts", "collect_experiences_field_start_date", locale))
    if experience_data.end_date is not None:
        not_missing_fields.append(t("prompts", "collect_experiences_field_end_date", locale))
    if experience_data.company is not None:
        not_missing_fields.append(t("prompts", "collect_experiences_field_company", locale))
    if experience_data.location is not None:
        not_missing_fields.append(t("prompts", "collect_experiences_field_location", locale))
    if len(not_missing_fields) == 0:
        return t("prompts", "collect_experiences_all_fields_not_filled", locale)
    return ", ".join(not_missing_fields)


def _get_experience_type(work_type: WorkType | None, locale: str) -> str:
    if work_type == WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
        return t("prompts", "collect_experiences_work_type_waged_employment", locale)
    elif work_type == WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
        return t("prompts", "collect_experiences_work_type_unpaid_trainee", locale)
    elif work_type == WorkType.SELF_EMPLOYMENT:
        return t("prompts", "collect_experiences_work_type_self_employment", locale)
    elif work_type == WorkType.UNSEEN_UNPAID:
        return t("prompts", "collect_experiences_work_type_unseen_unpaid", locale)
    elif work_type is None:
        return t("prompts", "collect_experiences_work_type_none", locale)
    else:
        raise ValueError("The work type is not supported")


def _get_experience_types(work_type: list[WorkType], locale: str) -> str:
    return "\n".join([f"- '{_get_experience_type(_type, locale)}'" for _type in work_type])


def _get_excluding_experiences(work_type: WorkType, locale: str) -> str:
    excluding_experience_types: list[WorkType] = []
    if work_type == WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
        excluding_experience_types = [WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK, WorkType.SELF_EMPLOYMENT, WorkType.UNSEEN_UNPAID]
        #  return "unpaid trainee work, self-employment, or unpaid work such as community volunteering work etc."
    elif work_type == WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
        excluding_experience_types = [WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.SELF_EMPLOYMENT, WorkType.UNSEEN_UNPAID]
        #  return "waged employment, self-employment, or unpaid work such as community volunteering work etc."
    elif work_type == WorkType.SELF_EMPLOYMENT:
        excluding_experience_types = [WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK, WorkType.UNSEEN_UNPAID]
        #  return "waged employment, unpaid trainee work, or unpaid work such as community volunteering work etc."
    elif work_type == WorkType.UNSEEN_UNPAID:
        excluding_experience_types = [WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK, WorkType.SELF_EMPLOYMENT]
        #  return "waged employment, unpaid trainee work, or self-employment"
    else:
        raise ValueError("The work type is not supported")

    return _get_experience_types(excluding_experience_types, locale)


def _ask_experience_type_question(work_type: WorkType, locale: str) -> str:
    question_to_ask: str
    if work_type == WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
        question_to_ask = t("prompts", "collect_experiences_question_waged_employment", locale)
    elif work_type == WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
        question_to_ask = t("prompts", "collect_experiences_question_unpaid_trainee", locale)
    elif work_type == WorkType.SELF_EMPLOYMENT:
        question_to_ask = t("prompts", "collect_experiences_question_self_employment", locale)
    elif work_type == WorkType.UNSEEN_UNPAID:
        question_to_ask = t("prompts", "collect_experiences_question_unseen_unpaid", locale)
    else:
        raise ValueError("The exploring type is not supported")
    return question_to_ask


def _get_explore_experiences_instructions(*,
                                          collected_data: list[CollectedData],
                                          exploring_type: WorkType | None,
                                          explored_types: list[WorkType],
                                          locale: str) -> str:
    if exploring_type is not None:
        questions_to_ask: str = _ask_experience_type_question(exploring_type, locale)
        experiences_in_type = _get_experience_type(exploring_type, locale)
        # excluding_experiences = _get_excluding_experiences(exploring_type)
        # already_explored_types = _get_experience_types(explored_types)
        # not_explored_types = _get_experience_types(unexplored_types)
        experiences_summary = _get_summary_of_experiences(collected_data, locale)
        instructions_template = t("prompts", "collect_experiences_explore_instructions", locale)
        return replace_placeholders_with_indent(
            instructions_template,
            questions_to_ask=questions_to_ask,
            experiences_in_type=experiences_in_type,
            # excluding_experiences=excluding_experiences,
            # already_explored_types=already_explored_types,
            # not_explored_types=not_explored_types,
            experiences_summary=experiences_summary,
        )

    else:
        finished_template = t("prompts", "collect_experiences_finished_exploring_types", locale)
        return replace_placeholders_with_indent(finished_template, explored_types=_get_experience_types(explored_types, locale))


def _get_example_summary() -> str:
    return "• " + ExperienceEntity.get_structured_summary(
        experience_title="Crew Member",
        location="London",
        work_type=WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name,
        start_date="2020",
        end_date="2021",
        company="Acme Ltd") + "\n"


def _get_summary_of_experiences(collected_data: list[CollectedData], locale: str) -> str:
    summary = ""
    if len(collected_data) == 0:
        return "• " + t("prompts", "collect_experiences_no_work_experiences_so_far", locale)
    for experience in collected_data:
        summary += "• " + ExperienceEntity.get_structured_summary(
            experience_title=experience.experience_title or "",
            location=experience.location or "",
            work_type=experience.work_type or "",
            start_date=experience.start_date or "",
            end_date=experience.end_date or "",
            company=experience.company or "") + "\n"
    return summary


def _get_country_of_user_segment(country_of_user: Country, locale: str) -> str:
    if country_of_user == Country.UNSPECIFIED:
        return ""
    return t("prompts", "collect_experiences_country_of_user_segment", locale, country=country_of_user.value)

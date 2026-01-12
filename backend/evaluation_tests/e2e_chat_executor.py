from typing import Optional

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.experience import ExperienceEntity
from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.countries import Country
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from app.vector_search.vector_search_dependencies import SearchServices
from evaluation_tests.baseline_metrics_collector import BaselineMetricsCollector


class E2EChatExecutor:
    def __init__(self, *,
                 session_id: int,
                 default_country_of_user: Country,
                 search_services: SearchServices,
                 experience_pipeline_config: ExperiencePipelineConfig,
                 metrics_collector: Optional[BaselineMetricsCollector] = None
                 ):
        self._state = ApplicationState.new_state(session_id=session_id, country_of_user=default_country_of_user)
        self._conversation_memory_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
        self._conversation_memory_manager.set_state(self._state.conversation_memory_manager_state)

        self._agent_director = LLMAgentDirector(conversation_manager=self._conversation_memory_manager,
                                                experience_pipeline_config=experience_pipeline_config,
                                                search_services=search_services)
        self._agent_director.set_state(self._state.agent_director_state)
        self._agent_director.get_welcome_agent().set_state(self._state.welcome_agent_state)
        self._agent_director.get_explore_experiences_agent().set_state(self._state.explore_experiences_director_state)
        self._agent_director.get_explore_experiences_agent().get_collect_experiences_agent().set_state(
            self._state.collect_experience_state)
        self._agent_director.get_explore_experiences_agent().get_exploring_skills_agent().set_state(self._state.skills_explorer_agent_state)
        
        # Metrics collector (optional, for baseline testing)
        self._metrics_collector = metrics_collector

    def get_experiences_discovered(self) -> list[ExperienceEntity]:
        """
        Returns the experiences discovered
        """
        return self._agent_director.get_explore_experiences_agent().get_collect_experiences_agent().get_experiences()

    def get_experiences_explored(self) -> list[ExperienceEntity]:
        """
        Returns the experiences explored
        """
        experiences = []
        s = self._state.explore_experiences_director_state.experiences_state
        for es in s.values():
            experiences.append(es.experience)

        return experiences

    def get_application_state(self) -> ApplicationState:
        """
        Returns the current state of the application
        """
        return self._state

    def get_conversation_memory_manager(self) -> ConversationMemoryManager:
        """
        Returns the conversation memory manager
        """
        return self._conversation_memory_manager

    async def send_message(self, *, agent_input: AgentInput) -> AgentOutput:
        """
        Executes the application chat route
        """
        conversation_context = await self._conversation_memory_manager.get_conversation_context()
        current_index = len(conversation_context.all_history.turns)
        await self._agent_director.execute(agent_input)
        # get the context again after the history has been updated
        conversation_context = await self._conversation_memory_manager.get_conversation_context()
        agent_output = self._get_message_for_user(from_index=current_index, context=conversation_context)
        
        # Record metrics if collector is available
        if self._metrics_collector:
            self._record_turn_metrics(agent_output)
        
        return agent_output

    @staticmethod
    def _get_message_for_user(*, from_index: int, context: ConversationContext) -> AgentOutput:
        # Concatenate the message to the user into a single string
        # to produce a coherent conversation flow with all the messages that have been added to the history
        # during the last conversation turn with the user
        _hist = context.all_history
        _last = _hist.turns[-1]
        _new_output: AgentOutput = AgentOutput(message_for_user="",
                                               agent_type=_last.output.agent_type,
                                               finished=_last.output.finished,
                                               agent_response_time_in_sec=0,
                                               llm_stats=[]
                                               )
        for turn in _hist.turns[from_index:]:
            _new_output.message_for_user += turn.output.message_for_user + "\n\n"
            _new_output.llm_stats += turn.output.llm_stats
            _new_output.agent_response_time_in_sec += turn.output.agent_response_time_in_sec

        _new_output.message_for_user = _new_output.message_for_user.strip()
        return _new_output

    def conversation_is_complete(self, *, agent_output: AgentOutput) -> bool:
        """
        Checks if the conversation is complete
        """
        is_complete = self._state.agent_director_state.current_phase == ConversationPhase.ENDED
        
        # Finalize metrics if conversation is complete
        if is_complete and self._metrics_collector:
            self._finalize_metrics()
        
        return is_complete
    
    def _record_turn_metrics(self, agent_output: AgentOutput):
        """Record metrics for a conversation turn."""
        phase = self._state.agent_director_state.current_phase.name
        agent_type = agent_output.agent_type.name if hasattr(agent_output.agent_type, 'name') else str(agent_output.agent_type)
        
        # Record turn
        self._metrics_collector.record_turn(phase, agent_type)
        
        # Record LLM calls
        for llm_stat in agent_output.llm_stats:
            self._metrics_collector.record_llm_call(
                agent_type=agent_type,
                phase=phase,
                duration_sec=llm_stat.response_time_in_sec,
                prompt_tokens=llm_stat.prompt_token_count,
                response_tokens=llm_stat.response_token_count
            )
        
        # Extract and record agent questions from the message
        message = agent_output.message_for_user
        if message and '?' in message:
            # Simple extraction: split by common sentence endings and filter questions
            sentences = message.replace('?\n', '?|').replace('. ', '.|').split('|')
            for sentence in sentences:
                sentence = sentence.strip()
                if sentence.endswith('?'):
                    self._metrics_collector.record_agent_question(sentence)
    
    def _finalize_metrics(self):
        """Finalize metrics collection at end of conversation."""
        # Record experience metrics
        experiences_discovered = self.get_experiences_discovered()
        experiences_explored = self.get_experiences_explored()
        
        skills_data = []
        for exp in experiences_explored:
            if hasattr(exp, 'top_skills') and exp.top_skills:
                skills_data.append(len(exp.top_skills))
        
        self._metrics_collector.record_experiences(
            experiences_discovered=len(experiences_discovered),
            experiences_explored=len(experiences_explored),
            skills_data=skills_data
        )
        
        # Calculate repetition rate
        self._metrics_collector.calculate_repetition_rate()
        
        # Finalize
        self._metrics_collector.finalize()

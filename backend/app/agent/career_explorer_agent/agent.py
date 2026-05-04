import logging
import time

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput, AgentType, LLMStats, AgentOutputWithReasoning
from app.app_config import get_application_config
from app.i18n.translation_service import t

from .sector_relevance_classifier import SectorRelevance, SectorRelevanceClassifier
from .priority_sector_explorer import PrioritySectorExplorer
from .non_priority_sector_explorer import NonPrioritySectorExplorer
from .sector_search_service import SectorSearchService


def _get_sectors_list() -> str:
    config = get_application_config()
    sectors = config.career_explorer_config.sectors
    if not sectors:
        return ""
    return "\n".join(f"{s['name']} — {s.get('description', '')}" for s in sectors)


def _get_welcome_metadata() -> dict | None:
    """Build quick-reply metadata with sector buttons for the welcome message."""
    config = get_application_config()
    sectors = config.career_explorer_config.sectors
    sector_buttons = [{"label": s["name"]} for s in sectors] if sectors else None
    return {"quick_reply_options": sector_buttons} if sector_buttons else None


def _get_welcome_message() -> str:
    config = get_application_config()
    sectors = config.career_explorer_config.sectors
    sectors_list = _get_sectors_list()
    country_name = config.career_explorer_config.country
    return t(
        "messages",
        "careerExplorer.welcomeMessage",
        "Welcome to the Career Explorer! Based on {country}'s development priorities, there are {sector_count} key sectors where TEVET graduates are in high demand:\n\n{sectors_list}\n\nBesides these priority sectors, we can also discuss any careers you want to explore. Which sector interests you most?",
        country=country_name,
        sector_count=len(sectors) if sectors else 0,
        sectors_list=sectors_list,
    )


def _construct_output(
    message: str,
        finished: bool,
        agent_start: float,
        reasoning: str = "",
        llm_stats: list[LLMStats] | None = None,
    metadata: dict | None = None,
) -> AgentOutput:
    return AgentOutputWithReasoning(
        message_for_user=message,
        finished=finished,
        reasoning=reasoning,
        agent_type=AgentType.CAREER_EXPLORER_AGENT,
        agent_response_time_in_sec=round(time.time() - agent_start, 2),
        llm_stats=llm_stats or [],
        metadata=metadata,
    )


class CareerExplorerAgent(Agent):
    def __init__(self, sector_search_service: SectorSearchService):
        super().__init__(
            agent_type=AgentType.CAREER_EXPLORER_AGENT,
            is_responsible_for_conversation_history=False,
        )
        self._sector_search = sector_search_service
        self._classifier = SectorRelevanceClassifier()
        self._priority_explorer = PrioritySectorExplorer(sector_search_service)
        self._non_priority_explorer = NonPrioritySectorExplorer()
        self._user_profile_context: str | None = None
        self._logger = logging.getLogger(self.__class__.__name__)

    def set_user_profile_context(self, context: str | None) -> None:
        self._user_profile_context = context

    async def execute(self, user_input: AgentInput, context, existing_sectors: list[str] | None = None, pending_sectors: list[dict] | None = None) -> AgentOutput:
        agent_start = time.time()

        msg = (user_input.message or "").strip()
        if msg in ("", "(silence)"):
            return _construct_output(
                _get_welcome_message(),
                finished=False,
                agent_start=agent_start,
                metadata=_get_welcome_metadata(),
            )

        relevance, sector_name, is_priority, reasoning, classifier_stats, all_sectors = await self._classifier.classify(
            user_input=msg, context=context, existing_sectors=existing_sectors
        )

        self._logger.info(
            "Routing to %s explorer (reasoning: %s)",
            relevance.value,
            reasoning or "(none)",
        )

        effective_pending = list(pending_sectors or [])
        if all_sectors and sector_name:
            existing_pending_names = {p["sector_name"] for p in effective_pending}
            for s in all_sectors:
                if s.sector_name != sector_name and s.sector_name not in existing_pending_names:
                    effective_pending.append({"sector_name": s.sector_name, "is_priority": s.is_priority})

        # Periodic priority-sector nudge: only inject the bridge-back instruction every Nth user turn,
        # so the assistant does not steer the user toward priority sectors on every reply.
        # `context.all_history.turns` holds completed turns; the current user turn is len(...) + 1.
        nudge_every_n = get_application_config().career_explorer_config.priority_nudge_every_n_turns
        current_user_turn = len(context.all_history.turns) + 1
        should_nudge_priority = nudge_every_n > 0 and (current_user_turn % nudge_every_n == 0)

        if relevance == SectorRelevance.PRIORITY_SECTOR:
            message, finished, reasoning, explorer_stats, metadata = await self._priority_explorer.explore(
                msg, context, pending_sectors=effective_pending or None,
                user_profile_context=self._user_profile_context,
                should_nudge_priority=should_nudge_priority,
            )
        else:
            message, finished, reasoning, explorer_stats, metadata = await self._non_priority_explorer.explore(
                msg, context, pending_sectors=effective_pending or None,
                user_profile_context=self._user_profile_context,
                should_nudge_priority=should_nudge_priority,
            )

        all_stats = classifier_stats + explorer_stats

        if sector_name:
            metadata = metadata or {}
            metadata["sector_classification"] = {
                "sector_name": sector_name,
                "is_priority": is_priority,
            }
        if all_sectors:
            metadata = metadata or {}
            metadata["all_mentioned_sectors"] = [
                {"sector_name": s.sector_name, "is_priority": s.is_priority}
                for s in all_sectors
            ]

        return _construct_output(
            message,
            finished=finished,
            agent_start=agent_start,
            reasoning=reasoning,
            llm_stats=all_stats,
            metadata=metadata,
        )

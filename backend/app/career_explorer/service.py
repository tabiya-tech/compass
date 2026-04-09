import logging
from datetime import datetime, timezone
from typing import Callable

from bson import ObjectId

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.career_explorer_agent.agent import CareerExplorerAgent, _get_welcome_message, _get_welcome_metadata
from app.career_explorer.context_builder import build_windowed_context
from app.career_explorer.repository import ICareerExplorerConversationRepository
from app.context_vars import user_profile_context_var
from app.career_explorer.types import (
    CareerExplorerConversationDocument,
    CareerExplorerConversationResponse,
    CareerExplorerMessage,
    CareerExplorerMessageSender,
    PendingSector,
)
from app.metrics.services.service import IMetricsService
from app.metrics.types import SectorEngagementEvent
from app.user_profile.service import IUserProfileService


class CareerExplorerService:
    def __init__(
        self,
        repository: ICareerExplorerConversationRepository,
        agent_factory: Callable[[], CareerExplorerAgent],
        metrics_service: IMetricsService,
        user_profile_service: IUserProfileService,
    ):
        self._repository = repository
        self._agent_factory = agent_factory
        self._metrics_service = metrics_service
        self._user_profile_service = user_profile_service
        self._logger = logging.getLogger(self.__class__.__name__)

    async def get_or_create_conversation(self, user_id: str) -> CareerExplorerConversationResponse:
        return await self._repository.get_or_create_conversation(user_id, _get_welcome_message(), metadata=_get_welcome_metadata())

    async def send_message(self, user_id: str, user_input: str) -> CareerExplorerConversationResponse:
        conv = await self._repository.find_by_user(user_id)
        if conv is None:
            raise ValueError("Conversation not found")

        now = datetime.now(timezone.utc)
        user_msg = CareerExplorerMessage(
            message_id=str(ObjectId()),
            message=user_input,
            sent_at=now,
            sender=CareerExplorerMessageSender.USER,
        )
        await self._repository.append_message(user_id, user_msg)

        context, new_summary, new_num_turns = await build_windowed_context(
            conv.messages,
            summary=conv.summary,
            num_turns_summarized=conv.num_turns_summarized,
        )
        if new_summary != conv.summary or new_num_turns != conv.num_turns_summarized:
            await self._repository.update_memory_state(
                user_id,
                new_summary,
                new_num_turns,
            )

        existing_sectors = await self._metrics_service.get_sector_names_for_user(user_id)
        all_known_sectors = list(existing_sectors)
        for ps in conv.pending_sectors:
            if ps.sector_name not in all_known_sectors:
                all_known_sectors.append(ps.sector_name)

        profile = await self._user_profile_service.get_user_profile(user_id)
        user_profile_context = self._user_profile_service.format_for_prompt(profile) if profile else None

        # Combine user profile context with plain personal data context from context var
        plain_personal_data_context = user_profile_context_var.get()
        if plain_personal_data_context and user_profile_context:
            combined_context = plain_personal_data_context + "\n\n" + user_profile_context
        elif plain_personal_data_context:
            combined_context = plain_personal_data_context
        else:
            combined_context = user_profile_context

        agent = self._agent_factory()
        agent.set_user_profile_context(combined_context)
        agent_input = AgentInput(message=user_input, sent_at=now)
        agent_output = await agent.execute(
            agent_input,
            context,
            existing_sectors=all_known_sectors,
            pending_sectors=[ps.model_dump() for ps in conv.pending_sectors],
        )

        agent_msg = CareerExplorerMessage(
            message_id=agent_output.message_id or str(ObjectId()),
            message=agent_output.message_for_user,
            sent_at=datetime.now(timezone.utc),
            sender=CareerExplorerMessageSender.AGENT,
            metadata=agent_output.metadata,
        )
        await self._repository.append_message(user_id, agent_msg)

        try:
            sector_classification = (agent_output.metadata or {}).get("sector_classification")
            if sector_classification:
                await self._metrics_service.record_event(
                    SectorEngagementEvent(
                        user_id=user_id,
                        sector_name=sector_classification["sector_name"],
                        is_priority=sector_classification["is_priority"],
                    )
                )
        except Exception as e:
            self._logger.exception("Failed to record sector engagement metric: %s", e)

        try:
            await self._update_pending_sectors(conv, agent_output, user_id)
        except Exception as e:
            self._logger.exception("Failed to update pending sectors: %s", e)

        updated_response = await self._repository.find_response_by_user(user_id)
        if updated_response is None:
            raise ValueError("Conversation not found after appending message")
        updated_response.finished = agent_output.finished
        return updated_response

    async def _update_pending_sectors(
        self,
        conv: "CareerExplorerConversationDocument",
        agent_output: "AgentOutput",
        user_id: str,
    ) -> None:
        metadata = agent_output.metadata or {}
        all_mentioned = metadata.get("all_mentioned_sectors", [])
        current_sector = metadata.get("sector_classification", {}).get("sector_name")

        if not all_mentioned and not current_sector and not conv.pending_sectors:
            return

        existing_names = {ps.sector_name for ps in conv.pending_sectors}
        new_pending = list(conv.pending_sectors)

        now = datetime.now(timezone.utc)
        for mentioned in all_mentioned:
            name = mentioned["sector_name"]
            if name and name != current_sector and name not in existing_names:
                new_pending.append(PendingSector(
                    sector_name=name,
                    is_priority=mentioned["is_priority"],
                    mentioned_at=now,
                ))
                existing_names.add(name)

        if current_sector:
            new_pending = [ps for ps in new_pending if ps.sector_name != current_sector]

        old_names = {ps.sector_name for ps in conv.pending_sectors}
        new_names = {ps.sector_name for ps in new_pending}
        if new_names != old_names:
            await self._repository.update_pending_sectors(user_id, new_pending)

    async def get_conversation(self, user_id: str) -> CareerExplorerConversationResponse:
        response = await self._repository.find_response_by_user(user_id)
        if response is None:
            raise ValueError("Conversation not found")
        return response

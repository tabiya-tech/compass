import asyncio
import logging
import argparse
import os
import hashlib
from abc import ABC, abstractmethod

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.explore_experiences_agent_director import DiveInPhase, ConversationPhase as CounselingPhase
from app.application_state import ApplicationState
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Dict, Set, Tuple, cast

from app.app_config import set_application_config, ApplicationConfig
from app.countries import Country
from app.server_dependencies.database_collections import Collections

from app.store.database_application_state_store import DatabaseApplicationStateStore
from app.metrics.repository.repository import MetricsRepository
from app.metrics.types import (
    ConversationPhaseEvent, EventType,
    AbstractCompassMetricEvent, ConversationTurnEvent, ExperienceDiscoveredEvent, ExperienceExploredEvent,
    ConversationPhaseLiteral
)
from app.version.utils import load_version_info

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EventExporter(ABC):
    """Abstract base class for exporting specific types of events."""

    def __init__(self, metrics_repository: MetricsRepository, event_type: EventType):
        self.metrics_repository = metrics_repository
        self.existing_events: Set[Tuple[str, str]] = set()
        self.event_type = event_type
        self.skipped_count = 0

    @abstractmethod
    async def get_existing_metrics_events_in_target(self) -> Set[Tuple[str, str]]:
        """Get existing events of this type from the database."""
        pass

    @abstractmethod
    def create_event_key(self, user_id: str, session_id: int) -> Tuple[str, str]:
        """Create a unique key for this event type."""
        pass

    @abstractmethod
    async def generate_events(self, state: ApplicationState, user_id: str, session_id: int) -> list[
        AbstractCompassMetricEvent]:
        """Generate events of this type from the application state."""
        pass


class ConversationPhaseEventExporter(EventExporter):
    """Exporter for conversation phase events."""

    async def get_existing_metrics_events_in_target(self) -> Set[Tuple[str, str, str]]:
        try:
            cursor = self.metrics_repository.collection.find(
                {"event_type": EventType.CONVERSATION_PHASE.value},
                {"anonymized_user_id": 1, "anonymized_session_id": 1, "event_type": 1, "phase": 1}
            )
            self.existing_events = {(event["anonymized_user_id"], event["anonymized_session_id"], event["phase"]) for event in
                                    await cursor.to_list(length=None)}
            return self.existing_events
        except Exception as err:
            logger.error(f"Error getting existing conversation phase events: {str(err)}")
            return set()

    def create_event_key(self, user_id: str, session_id: int, phase: str = None) -> Tuple[str, str, str]:
        return (
            hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest(),
            hashlib.md5(str(session_id).encode(), usedforsecurity=False).hexdigest(),
            phase
        )

    async def generate_events(self, state: ApplicationState, user_id: str, session_id: int) -> list[
        AbstractCompassMetricEvent]:
        events: list[AbstractCompassMetricEvent] = []
        skipped_count = 0

        def add_phase_event(phase: str) -> None:
            phase_key = self.create_event_key(user_id, session_id, phase)
            
            # Check if this phase event is already in the existing events
            if phase_key in self.existing_events:
                nonlocal skipped_count
                skipped_count += 1
                return
                
            # Add the new phase event
            events.append(ConversationPhaseEvent(
                user_id=user_id,
                session_id=session_id,
                phase=cast(ConversationPhaseLiteral, phase)
            ))

        #  if the current phase is ENDED intuit that the user probably also went through the
        # - INTRO phase
        # - COUNSELING phase
        # - COLLECT_EXPERIENCES phase
        # - ENDED phase
        if state.agent_director_state.current_phase == ConversationPhase.ENDED:
            add_phase_event("INTRO")
            add_phase_event("COUNSELING")
            add_phase_event("COLLECT_EXPERIENCES")
            add_phase_event("DIVE_IN")
            add_phase_event("ENDED")


        # if the current phase is COUNSELING then intuit that the user probably also went through the
        # - INTRO phase
        # - COUNSELING phase
        # - COLLECT_EXPERIENCES phase
        elif state.agent_director_state.current_phase == ConversationPhase.COUNSELING:
            add_phase_event("INTRO")
            add_phase_event("COUNSELING")
            add_phase_event("COLLECT_EXPERIENCES")
            # if the phase is DIVE_IN then record COLLECT_EXPERIENCES and DIVE_IN phases
            if state.explore_experiences_director_state.conversation_phase == CounselingPhase.DIVE_IN:
                add_phase_event("DIVE_IN")

        # if the current phase is INTRO then the user only went through the
        # - INTRO phase
        elif state.agent_director_state.current_phase == ConversationPhase.INTRO:
            add_phase_event("INTRO")
        else:
            # unknown phase - log an error
            logger.error(f"Unknown phase: {state.agent_director_state.current_phase}")

        for event in events:
            event.timestamp = state.agent_director_state.conversation_conducted_at
            
        self.skipped_count = skipped_count
        return events


class ConversationTurnEventExporter(EventExporter):
    """Exporter for conversation turn events."""

    async def get_existing_metrics_events_in_target(self) -> Set[Tuple[str, str]]:
        try:
            cursor = self.metrics_repository.collection.find(
                {"event_type": EventType.CONVERSATION_TURN.value},
                {"anonymized_user_id": 1, "anonymized_session_id": 1}
            )
            self.existing_events = {
                (event["anonymized_user_id"], event["anonymized_session_id"])
                for event in await cursor.to_list(length=None)
            }
            return self.existing_events
        except Exception as e:
            logger.error(f"Error getting existing conversation turn events: {str(e)}")
            return set()

    def create_event_key(self, user_id: str, session_id: int) -> Tuple[str, str]:
        return (
            hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest(),
            hashlib.md5(str(session_id).encode(), usedforsecurity=False).hexdigest()
        )

    async def generate_events(self, state: ApplicationState, user_id: str, session_id: int) -> list[
        AbstractCompassMetricEvent]:
        events: list[AbstractCompassMetricEvent] = []
        skipped_count = 0
        compass_message_count: int = 0
        user_message_count: int = 0
        
        # Helper function to add a turn event if not already added
        def add_turn_event() -> None:
            # Create a unique key for this turn
            event_key = self.create_event_key(user_id, session_id)
            
            # Check if this turn event is already in the existing events
            if event_key in self.existing_events:
                nonlocal skipped_count
                skipped_count += 1
                return
                
            # Add the new turn event
            events.append(ConversationTurnEvent(
                user_id=user_id,
                session_id=session_id,
                user_message_count=user_message_count,
                compass_message_count=compass_message_count
            ))
        user_artificial_messages = 0

        for turn in state.conversation_memory_manager_state.all_history.turns:
            # skip artificial messages and empty user messages
            if turn.input.is_artificial:
                user_artificial_messages += 1
            else:
                user_message_count += 1
            # count compass messages regardless
            compass_message_count += 1

        # we need to add all the turn events because the conversation turn metric has an auto-incrementing counter for turn_count
        # so we need to ensure that we have an event for every turn
        # the turn count is basically equal to user_message_count + 1 (for the first empty user message which is not accounted for)
        turn_count = len(state.conversation_memory_manager_state.all_history.turns) - user_artificial_messages + 1

        for _ in range(turn_count):
            add_turn_event()

        self.skipped_count = skipped_count
        return events


class ExploreExperiencesEventExporter(EventExporter):
    """Exporter for explore experiences events."""

    async def get_existing_metrics_events_in_target(self) -> Set[Tuple[str, str]]:
        try:
            cursor = self.metrics_repository.collection.find(
                {"event_type": EventType.EXPERIENCE_EXPLORED.value},
                {"anonymized_user_id": 1, "anonymized_session_id": 1}
            )
            self.existing_events = {(event["anonymized_user_id"], event["anonymized_session_id"]) for event in
                                    await cursor.to_list(length=None)}
            return self.existing_events
        except Exception as err:
            logger.error(f"Error getting existing explore experiences events: {str(err)}")
            return set()

    def create_event_key(self, user_id: str, session_id: int) -> Tuple[str, str]:
        return (
            hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest(),
            hashlib.md5(str(session_id).encode(), usedforsecurity=False).hexdigest()
        )

    async def generate_events(self, state: ApplicationState, user_id: str, session_id: int) -> list[
        AbstractCompassMetricEvent]:
        events: list[AbstractCompassMetricEvent] = []
        skipped_count = 0
        experience_count: int = 0
        # go through the explored experiences and count the number of experiences that have been processed
        for experience in state.explore_experiences_director_state.experiences_state.values():
            if experience.dive_in_phase == DiveInPhase.PROCESSED:
                experience_count += 1
        # create an event for the number of experiences explored
        event = ExperienceExploredEvent(
            user_id=user_id,
            session_id=session_id,
            experience_count=experience_count
        )
        
        # Check if this event already exists
        event_key = self.create_event_key(user_id, session_id)
        if event_key in self.existing_events:
            skipped_count += 1
        else:
            events.append(event)
            
        self.skipped_count = skipped_count
        return events


class ExperienceDiscoveredEventExporter(EventExporter):
    """Exporter for experience discovered events."""

    async def get_existing_metrics_events_in_target(self) -> Set[Tuple[str, str]]:
        try:
            cursor = self.metrics_repository.collection.find(
                {"event_type": EventType.EXPERIENCE_DISCOVERED.value},
                {"anonymized_user_id": 1, "anonymized_session_id": 1}
            )
            self.existing_events = {(event["anonymized_user_id"], event["anonymized_session_id"]) for event in
                                    await cursor.to_list(length=None)}
            return self.existing_events
        except Exception as err:
            logger.error(f"Error getting existing experience discovered events: {str(err)}")
            return set()

    def create_event_key(self, user_id: str, session_id: int) -> Tuple[str, str]:
        return (
            hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest(),
            hashlib.md5(str(session_id).encode(), usedforsecurity=False).hexdigest()
        )

    async def generate_events(self, state: ApplicationState, user_id: str, session_id: int) -> list[
        AbstractCompassMetricEvent]:
        events: list[AbstractCompassMetricEvent] = []
        skipped_count = 0
        experience_count: int = 0
        # go through the experiences and count the number of experiences that have been discovered
        for _ in state.explore_experiences_director_state.experiences_state.keys():
            experience_count += 1
        # create an event for the number of experiences discovered
        event = ExperienceDiscoveredEvent(
            user_id=user_id,
            session_id=session_id,
            experience_count=experience_count
        )
        
        # Check if this event already exists
        event_key = self.create_event_key(user_id, session_id)
        if event_key in self.existing_events:
            skipped_count += 1
        else:
            events.append(event)
            
        self.skipped_count = skipped_count
        return events


async def get_user_preferences_map(db: AsyncIOMotorDatabase) -> Dict[int, str]:
    """
    Get all user preferences and create a map of session_id to user_id.
    """
    try:
        # Get all user preferences documents
        cursor = db.get_collection(Collections.USER_PREFERENCES).find({}, {"user_id": 1, "sessions": 1})
        user_prefs = await cursor.to_list(length=None)

        # Create a map of session_id to user_id
        session_to_user = {}
        for pref in user_prefs:
            user_id = pref["user_id"]
            for session_id in pref["sessions"]:
                session_to_user[session_id] = user_id

        return session_to_user

    except Exception as e:
        logger.error(f"Error getting user preferences: {str(e)}")
        return {}


async def export_metrics(*, input_mongo_uri: str, input_database_name: str, output_mongo_uri: str,
                         output_database_name: str, hot_run: bool = False):
    """
    Script to export metrics from application state data.
    
    Args:
        input_mongo_uri: MongoDB connection URI for reading application state (required)
        input_database_name: Name of the database to read from (required)
        output_mongo_uri: MongoDB connection URI for writing metrics (required)
        output_database_name: Name of the database to write to (required)
        hot_run: If True, save the metrics to the database, otherwise just simulate (dry run)
    """
    try:
        # Validate input parameters
        if not input_mongo_uri or not input_database_name or not output_mongo_uri or not output_database_name:
            raise ValueError("MongoDB URIs and database names are required for both hot run and dry run modes")

        logger.info(f"Starting metrics export {'(HOT RUN)' if hot_run else '(DRY RUN)'}")
        logger.info(f"Reading from: {input_database_name}")
        logger.info(f"Writing to: {output_database_name}")

        # set application configuration as metrics need the environment name and version info
        set_application_config(
            ApplicationConfig(
                environment_name=os.getenv("TARGET_ENVIRONMENT_NAME"),
                version_info=load_version_info(),
                enable_metrics=True,
                default_country_of_user=Country.UNSPECIFIED
            )
        )

        # Connect to input database
        input_client = AsyncIOMotorClient(input_mongo_uri, tlsAllowInvalidCertificates=True)
        input_db = input_client.get_database(input_database_name)
        state_store = DatabaseApplicationStateStore(input_db)

        # Connect to output database
        output_client = AsyncIOMotorClient(output_mongo_uri, tlsAllowInvalidCertificates=True)
        output_db = output_client.get_database(output_database_name)
        metrics_repository = MetricsRepository(db=output_db)

        # Initialize event exporters
        exporters: list[EventExporter] = [
            ConversationPhaseEventExporter(metrics_repository, EventType.CONVERSATION_PHASE),
            ConversationTurnEventExporter(metrics_repository, EventType.CONVERSATION_TURN),
            ExperienceDiscoveredEventExporter(metrics_repository, EventType.EXPERIENCE_DISCOVERED),
            ExploreExperiencesEventExporter(metrics_repository, EventType.EXPERIENCE_EXPLORED)
        ]

        # Pre-fetch user preferences
        logger.info("Fetching user preferences...")
        session_to_user = await get_user_preferences_map(input_db)
        logger.info(f"Found {len(session_to_user)} session to user mappings")

        # Pre-fetch existing events for each exporter
        for exporter in exporters:
            logger.info(f"Fetching existing {exporter.event_type.name} events...")
            await exporter.get_existing_metrics_events_in_target()
            logger.info(f"Found {len(exporter.existing_events)} existing events")

        # Counters for reporting
        errored = 0
        skipped_sessions = 0
        skipped_existing = 0
        events_by_type: Dict[str, int] = {exporter.event_type.name: 0 for exporter in exporters}

        # Collect all events to record at once
        all_events = []

        # loop through all sessions and get the state for each session
        for session_id, user_id in session_to_user.items():
            try:
                # Get application state
                # silence the logger for this operation as it can be noisy
                root_logger = logging.getLogger()
                original_level = root_logger.level
                root_logger.setLevel(logging.ERROR)
                state = await state_store.get_state(session_id)
                root_logger.setLevel(original_level)
                
                if not state:
                    skipped_sessions += 1
                    logger.info(f"Session {session_id} not found in application state, skipping")
                    continue
                else:
                    logger.info(f"Processing session {session_id} for user {user_id}")

                # Process each exporter
                for exporter in exporters:
                    # Generate events - event key checking is handled inside generate_events
                    events = await exporter.generate_events(state, user_id, session_id)
                    
                    # Update skipped count
                    skipped_existing += exporter.skipped_count

                    # record the number of events generated for this type
                    events_by_type[exporter.event_type.name] += len(events)

                    # Add to all events collection
                    all_events.extend(events)

            except Exception as err:
                errored += 1
                logger.error(f"Error processing session {session_id}: {str(err)}", exc_info=True)
                continue

        # Save all events at once
        if hot_run and all_events:
            logger.info(f"Saving all {len(all_events)} events...")
            await metrics_repository.record_event(all_events)
        else:
            logger.info(f"Would save {len(all_events)} events")

        # Log summary
        logger.info(f"Metrics export {'completed' if hot_run else 'simulated'}!")
        logger.info(f"Errors: {errored}")
        logger.info(f"Skipped sessions (no state): {skipped_sessions}")
        logger.info(f"Skipped existing events: {skipped_existing}")
        logger.info("Events generated by type:")
        for event_type, count in events_by_type.items():
            logger.info(f"  {event_type}: {count}")
        logger.info(f"Total events generated: {len(all_events)}")

    except Exception as err:
        logger.error(f"Metrics export failed: {err}", exc_info=True)
        raise


def parse_args():
    parser = argparse.ArgumentParser(description='Export metrics from application state data.')
    parser.add_argument('--input-mongo-uri', required=True, help='Input MongoDB connection string')
    parser.add_argument('--input-database-name', required=True, help='Input database name')
    parser.add_argument('--output-mongo-uri', required=True, help='Output MongoDB connection string')
    parser.add_argument('--output-database-name', required=True, help='Output database name')
    parser.add_argument('--hot-run', action='store_true',
                        help='Run in "hot mode" and save to the database (default is dry run)')
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    try:
        asyncio.run(export_metrics(
            input_mongo_uri=args.input_mongo_uri,
            input_database_name=args.input_database_name,
            output_mongo_uri=args.output_mongo_uri,
            output_database_name=args.output_database_name,
            hot_run=args.hot_run
        ))
    except Exception as e:
        logger.error(f"Failed to export metrics: {e}")
        print(f"Error: {e}")
        exit(1)

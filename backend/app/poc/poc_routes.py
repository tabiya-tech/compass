import base64
from pydantic import BaseModel, Field

from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.agent.agent_types import AgentOutput, AgentInput
from app.conversation_memory.conversation_memory_types import ConversationContext
import logging

from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.security import HTTPBearer
from fastapi.responses import JSONResponse

from app.application_state import ApplicationStateManager
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.sensitive_filter import sensitive_filter
from app.server_dependecies.agent_director_dependencies import get_agent_director
from app.server_dependecies.application_state_dependencies import get_application_state_manager
from app.server_dependecies.conversation_manager_dependencies import get_conversation_memory_manager
from app.users import Authentication
from app.vector_search.similarity_search_service import SimilaritySearchService
from app.vector_search.vector_search_dependencies import get_occupation_skill_search_service, get_all_search_services, SearchServices
from app.vector_search.occupation_search_routes import add_occupation_search_routes
from app.vector_search.skill_search_routes import add_skill_search_routes


class ConversationResponse(BaseModel):
    """
    The response model for the conversation endpoint.
    """
    # TODO: remove this field, as the complete conversation history should not be sent to the client because it leaks
    #  information about the agent's internal state
    last: AgentOutput
    """
    The last message from the agent in the conversation.
    """
    messages_for_user: list[str] = Field(default_factory=list)
    """
    The messages for the user.
    """
    # TODO: remove this field, as the complete conversation history should not be sent to the client because it leaks
    #  information about the agent's internal state
    conversation_context: ConversationContext
    """
    The complete conversation context.
    """

    @staticmethod
    async def from_conversation_manager(context: ConversationContext, from_index: int):
        """
        Construct the response to the user from the conversation context.
        """
        # concatenate the message to the user into a single string
        # to produce a coherent conversation flow with all the messages that have been added to the history
        # during this conversation turn with the user
        _hist = context.all_history
        _last = _hist.turns[-1]
        _new_output: AgentOutput = AgentOutput(message_for_user="",
                                               agent_type=_last.output.agent_type,
                                               finished=_last.output.finished,
                                               agent_response_time_in_sec=0,
                                               llm_stats=[]
                                               )
        _messages_for_user = []
        for turn in _hist.turns[from_index:]:
            _messages_for_user.append(turn.output.message_for_user)
            _new_output.message_for_user += turn.output.message_for_user + "\n\n"
            _new_output.llm_stats += turn.output.llm_stats
            _new_output.agent_response_time_in_sec += turn.output.agent_response_time_in_sec

        _new_output.message_for_user = _new_output.message_for_user.strip()
        return ConversationResponse(last=_new_output, messages_for_user=_messages_for_user,
                                    conversation_context=context)


def add_poc_route_endpoints(poc_router: APIRouter, auth: Authentication):
    """
    Add all routes related to user preferences to the users router.
    :param users_router: APIRouter: The router to add the user preferences routes to.
        This route contains all endpoints related to users module on the platform
    :param auth: Authentication: The authentication instance to use for the routes.
    """

    logger = logging.getLogger(__name__)

    router = APIRouter()

    HTTPBearer(auto_error=False, scheme_name="JWT_auth")
    HTTPBearer(scheme_name="firebase")
    HTTPBearer(scheme_name="google")

    ############################################
    # Add routes relevant for esco search
    ############################################

    add_occupation_search_routes(router)
    add_skill_search_routes(router)

    ############################################
    # Add routes relevant for pii filtering
    ############################################

    sensitive_filter.add_filter_routes(router)

    @router.get(path="/conversation",
                description="""The main conversation route used to interact with the agent.""", )
    async def conversation(request: Request, user_input: str, clear_memory: bool = False, filter_pii: bool = False,
                           session_id: int = 1,
                           conversation_memory_manager: ConversationMemoryManager = Depends(
                               get_conversation_memory_manager),
                           agent_director: LLMAgentDirector = Depends(get_agent_director),
                           application_state_manager: ApplicationStateManager = Depends(get_application_state_manager)):
        """
        Endpoint for conducting the conversation with the agent.
        """
        # Do not allow user input that is too long,
        # as a basic measure to prevent abuse.
        if len(user_input) > 1000:
            raise HTTPException(status_code=413, detail="To long user input")

        try:
            if clear_memory:
                await application_state_manager.delete_state(session_id)
                return {"msg": f"Memory cleared for session {session_id}!"}
            if filter_pii:
                user_input = await sensitive_filter.obfuscate(user_input)

            # set the state of the agent director, the conversation memory manager and all the agents
            state = await application_state_manager.get_state(session_id)

            agent_director.set_state(state.agent_director_state)
            agent_director.get_explore_experiences_agent().set_state(state.explore_experiences_director_state)
            agent_director.get_explore_experiences_agent().get_collect_experiences_agent().set_state(
                state.collect_experience_state)
            agent_director.get_explore_experiences_agent().get_exploring_skills_agent().set_state(state.skills_explorer_agent_state)
            conversation_memory_manager.set_state(state.conversation_memory_manager_state)

            # Handle the user input
            context = await conversation_memory_manager.get_conversation_context()
            # get the current index in the conversation history, so that we can return only the new messages
            current_index = len(context.all_history.turns)
            await agent_director.execute(AgentInput(message=user_input))
            # get the context again after updating the history
            context = await conversation_memory_manager.get_conversation_context()
            response = await ConversationResponse.from_conversation_manager(context, from_index=current_index)
            # save the state, before responding to the user
            await application_state_manager.save_state(session_id, state)
            return response
        except Exception as e:  # pylint: disable=broad-except
            logger.exception(
                "Error for request: %s %s?%s with session id: %s : %s",
                request.method,
                request.url.path,
                request.query_params,
                session_id,
                e
            )
            raise HTTPException(status_code=500, detail="Oops! something went wrong")

    @router.get(path="/conversation_sandbox/collect_experiences",
                description="""Temporary route used to interact with the conversation agent.""", )
    async def _test_conversation(request: Request, user_input: str, clear_memory: bool = False, filter_pii: bool = False,
                                 session_id: int = 1, only_reply: bool = False,
                                 similarity_search: SimilaritySearchService = Depends(get_occupation_skill_search_service),
                                 conversation_memory_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager),
                                 application_state_manager: ApplicationStateManager = Depends(get_application_state_manager)):
        """
        As a developer, you can use this endpoint to test the conversation agent with any user input.
        You can adjust the front-end to use this endpoint for testing locally an agent in a configurable way.
        """
        # Do not allow user input that is too long,
        # as a basic measure to prevent abuse.
        if len(user_input) > 1000:
            raise HTTPException(status_code=413, detail="To long user input")

        try:
            if clear_memory:
                await application_state_manager.delete_state(session_id)
            if filter_pii:
                user_input = await sensitive_filter.obfuscate(user_input)

            # set the state of the conversation memory manager
            state = await application_state_manager.get_state(session_id)
            conversation_memory_manager.set_state(state.conversation_memory_manager_state)

            # handle the user input
            context = await conversation_memory_manager.get_conversation_context()
            # get the current index in the conversation history, so that we can return only the new messages
            current_index = len(context.all_history.turns)

            from app.agent.agent import Agent
            agent: Agent
            # ##################### ADD YOUR AGENT HERE ######################
            # Initialize the agent you want to use for the evaluation
            # from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirector
            # agent = ExploreExperiencesAgentDirector(conversation_manager=conversation_memory_manager)
            # agent.set_state(state.explore_experiences_director_state)
            from app.agent.collect_experiences_agent import CollectExperiencesAgent
            agent = CollectExperiencesAgent()

            # ################################################################
            logger.debug("%s initialized for sandbox testing", agent.agent_type.value)
            agent_input = AgentInput(message=user_input)
            agent_output = await agent.execute(user_input=agent_input, context=context)
            if not agent.is_responsible_for_conversation_history():
                await conversation_memory_manager.update_history(agent_input, agent_output)

            # get the context again after updating the history
            context = await conversation_memory_manager.get_conversation_context()
            response = await ConversationResponse.from_conversation_manager(context, from_index=current_index)
            if only_reply:
                response = response.last.message_for_user

            # save the state, before responding to the user
            await application_state_manager.save_state(session_id, state)
            return response
        except Exception as e:  # pylint: disable=broad-except
            logger.exception(
                "Error for request: %s %s?%s with session id: %s : %s",
                request.method,
                request.url.path,
                request.query_params,
                session_id,
                e
            )
            raise HTTPException(status_code=500, detail="Oops! something went wrong")

    @router.get(path="/conversation_sandbox/skills_explorer",
                description="""Temporary route used to interact with the conversation agent.""", )
    async def _test_conversation(request: Request, user_input: str, clear_memory: bool = False, filter_pii: bool = False,
                                 session_id: int = 1, only_reply: bool = False,
                                 conversation_memory_manager: ConversationMemoryManager = Depends(get_conversation_memory_manager),
                                 application_state_manager: ApplicationStateManager = Depends(get_application_state_manager)):
        """
        As a developer, you can use this endpoint to test the conversation agent with any user input.
        You can adjust the front-end to use this endpoint for testing locally an agent in a configurable way.
        """
        # Do not allow user input that is too long,
        # as a basic measure to prevent abuse.
        if len(user_input) > 1000:
            raise HTTPException(status_code=413, detail="To long user input")

        try:
            if clear_memory:
                await application_state_manager.delete_state(session_id)
            if filter_pii:
                user_input = await sensitive_filter.obfuscate(user_input)

            # set the state of the conversation memory manager
            state = await application_state_manager.get_state(session_id)
            conversation_memory_manager.set_state(state.conversation_memory_manager_state)

            # handle the user input
            context = await conversation_memory_manager.get_conversation_context()
            # get the current index in the conversation history, so that we can return only the new messages
            current_index = len(context.all_history.turns)

            # ##################### ADD YOUR AGENT HERE ######################
            # Initialize the agent you want to use for the evaluation

            from app.agent.skill_explorer_agent import SkillsExplorerAgent
            agent = SkillsExplorerAgent()
            # Define a dummy experience entity if it is not set in the application state is not set
            from app.agent.experience.experience_entity import ExperienceEntity
            from app.agent.experience.work_type import WorkType
            if len(state.explore_experiences_director_state.experiences_state) == 0:
                experience_entity = ExperienceEntity(experience_title="Baker",
                                                     company="Baker's and Sons",
                                                     work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT)
                from app.agent.explore_experiences_agent_director import ExperienceState
                from app.agent.explore_experiences_agent_director import DiveInPhase
                state.explore_experiences_director_state.current_experience_uuid = experience_entity.uuid
                state.explore_experiences_director_state.experiences_state[experience_entity.uuid] = ExperienceState(
                    dive_in_phase=DiveInPhase.EXPLORING_SKILLS,
                    experience=experience_entity)

            experience_state = state.explore_experiences_director_state.experiences_state.get(state.explore_experiences_director_state.current_experience_uuid)
            agent.set_state(state.skills_explorer_agent_state)
            agent.set_experience(experience_state.experience)

            # ################################################################
            logger.debug("%s initialized for sandbox testing", agent.agent_type.value)
            agent_input = AgentInput(message=user_input)
            agent_output = await agent.execute(user_input=agent_input, context=context)
            if not agent.is_responsible_for_conversation_history():
                await conversation_memory_manager.update_history(agent_input, agent_output)

            if agent_output.finished:
                await conversation_memory_manager.update_history(AgentInput(message="", is_artificial=True), AgentOutput(
                    finished=True,
                    agent_response_time_in_sec=0,
                    llm_stats=[],
                    message_for_user=f"Found these skills: {experience_state.experience.responsibilities}"))

            # get the context again after updating the history
            context = await conversation_memory_manager.get_conversation_context()
            response = await ConversationResponse.from_conversation_manager(context, from_index=current_index)
            if only_reply:
                response = response.last.message_for_user

            # save the state, before responding to the user
            await application_state_manager.save_state(session_id, state)
            return response
        except Exception as e:  # pylint: disable=broad-except
            logger.exception(
                "Error for request: %s %s?%s with session id: %s : %s",
                request.method,
                request.url.path,
                request.query_params,
                session_id,
                e
            )
            raise HTTPException(status_code=500, detail="Oops! something went wrong")

    @router.get(path="/conversation_context",
                description="""Temporary route used to get the conversation context of a user.""", )
    async def get_conversation_context(
            session_id: int,
            conversation_memory_manager: ConversationMemoryManager = Depends(
                get_conversation_memory_manager),
                application_state_manager: ApplicationStateManager = Depends(get_application_state_manager)):
        """
        Get the conversation context of a user.
        """
        try:
            state = await application_state_manager.get_state(session_id)
            conversation_memory_manager.set_state(state.conversation_memory_manager_state)
            context = await conversation_memory_manager.get_conversation_context()
            return context
        except Exception as e:  # pylint: disable=broad-except
            # this is the main entry point, so we need to catch all exceptions
            logger.exception(e)
            return {"error": "oops! something went wrong!"}

    # Temporary REST API EP for returning the incoming authentication information
    # from the request. This is for testing purposes until the UI supports auth
    # and must be removed later.
    @router.get(path="/authinfo",
                description="Returns the authentication info (JWT token claims)")
    async def _get_auth_info(request: Request,
                             credentials=Depends(auth.provider)):
        auth_info_b64 = request.headers.get('x-apigateway-api-userinfo')
        # some python magic
        auth_info = base64.b64decode(auth_info_b64.encode() + b'==').decode()
        return JSONResponse(auth_info)

    poc_router.include_router(router, tags=["poc"])

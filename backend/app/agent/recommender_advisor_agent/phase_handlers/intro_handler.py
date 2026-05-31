"""
Intro Phase Handler for the Recommender/Advisor Agent.

Handles the introduction phase where we set expectations
and prepare recommendations.
"""

from app.agent.agent_types import LLMStats
from app.agent.recommender_advisor_agent.state import RecommenderAdvisorAgentState
from app.agent.recommender_advisor_agent.types import ConversationPhase
from app.agent.recommender_advisor_agent.llm_response_models import ConversationResponse
from app.agent.recommender_advisor_agent.phase_handlers.base_handler import BasePhaseHandler
from app.agent.recommender_advisor_agent.recommendation_interface import RecommendationInterface
from app.conversation_memory.conversation_memory_manager import ConversationContext


class IntroPhaseHandler(BasePhaseHandler):
    """
    Handles the INTRO phase.
    
    Responsibilities:
    - Set expectations about what's coming
    - Generate/load recommendations if not already set
    - Transition to PRESENT_RECOMMENDATIONS
    """
    
    def __init__(self, *args, recommendation_interface: RecommendationInterface, **kwargs):
        """
        Initialize the intro handler.
        
        Args:
            recommendation_interface: Interface for generating recommendations
            *args, **kwargs: Passed to BasePhaseHandler
        """
        super().__init__(*args, **kwargs)
        self._recommendation_interface = recommendation_interface
    
    async def handle(
        self,
        user_input: str,
        state: RecommenderAdvisorAgentState,
        context: ConversationContext
    ) -> tuple[ConversationResponse, list[LLMStats]]:
        """
        Handle the intro phase.
        
        Generates recommendations if needed and presents introduction message.
        """
        # Generate recommendations if not already set
        if state.recommendations is None:
            state.recommendations = await self._recommendation_interface.generate_recommendations(
                youth_id=state.youth_id,
                city=state.city,
                province=state.province,
                preference_vector=state.preference_vector,
                skills_vector=state.skills_vector,
                bws_scores=state.bws_scores,
                top_10_bws=state.top_10_bws,
            )
            self.logger.info(
                f"Generated recommendations for {state.youth_id}: "
                f"{len(state.recommendations.occupation_recommendations)} occupations, "
                f"{len(state.recommendations.opportunity_recommendations)} opportunities, "
                f"{len(state.recommendations.skillstraining_recommendations)} trainings"
            )
        
        # Build intro message
        intro_message = """Great! I've identified some career paths that could be a really good fit for you.

            I'll show you a few options, and we can discuss what appeals to you and what concerns you might have. There's no pressure - I just want to help you understand what's out there and find something worth pursuing.

            Ready to see what I found?
        """
        
        response = ConversationResponse(
            reasoning="Introducing the recommendation session, building rapport",
            message=intro_message,
            finished=False
        )
        
        # Transition to presenting recommendations
        state.conversation_phase = ConversationPhase.PRESENT_RECOMMENDATIONS
        
        return response, []

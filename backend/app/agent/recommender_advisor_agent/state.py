"""
State management for the Recommender/Advisor Agent.

This module defines the state model that tracks the conversation progress,
recommendations shown, user reactions, concerns, and action commitments.

Epic 3: Recommender Agent Implementation
"""

from typing import Any, Mapping, Optional
from pydantic import BaseModel, Field, field_serializer, field_validator, model_validator

from app.agent.recommender_advisor_agent.types import (
    ConversationPhase,
    Node2VecRecommendations,
    ActionCommitment,
    ConcernRecord,
    UserInterestLevel,
)

# Import PreferenceVector from Epic 2
from app.agent.preference_elicitation_agent.types import PreferenceVector

# Import Country enum for localization
from app.countries import Country


class RecommenderAdvisorAgentState(BaseModel):
    """
    State for the Recommender/Advisor Agent.
    
    Tracks the entire recommendation conversation flow, including:
    - Input data (skills, preferences, BWS scores)
    - Node2Vec recommendations
    - What has been presented to the user
    - User engagement signals (interest, rejection)
    - Concerns raised and addressed
    - Final action commitment
    """
    
    # === SESSION IDENTIFICATION ===
    session_id: int = Field(description="Unique session identifier")

    # === FLOW CONTROL ===
    discuss_recommendations: bool = Field(
        default=True,
        description=(
            "When True, runs the full conversational recommender flow. "
            "When False (set during manual whitelisting), skips the multi-phase "
            "discussion and returns a single structured message with career and job "
            "recommendations only."
        )
    )

    conversation_phase: ConversationPhase = Field(
        default=ConversationPhase.INTRO,
        description="Current phase of the conversation"
    )
    conversation_turn_count: int = Field(
        default=0, ge=0,
        description="Number of conversation turns"
    )

    # === INPUT DATA ===
    youth_id: Optional[str] = Field(
        default=None,
        description="User/youth identifier (auto-generated from session_id if not provided)"
    )

    country_of_user: Country = Field(
        default=Country.UNSPECIFIED,
        description="Country of the user for localization (e.g., KENYA, SOUTH_AFRICA)"
    )

    city: Optional[str] = Field(
        default=None,
        description="User's city (e.g., 'Johannesburg', 'Nairobi') - required by matching service"
    )

    province: Optional[str] = Field(
        default=None,
        description="User's province/state (e.g., 'Gauteng', 'Nairobi County') - required by matching service"
    )

    skills_vector: Optional[dict[str, Any]] = Field(
        default=None,
        description="Skills vector from Epic 4 (skill IDs + proficiency levels)"
    )

    education_experiences: list = Field(
        default_factory=list,
        description="Education experiences (CollectedData with source='education') for matching service"
    )
    
    preference_vector: Optional[PreferenceVector] = Field(
        default=None,
        description="Preference vector from Epic 2"
    )
    
    bws_scores: Optional[dict[str, float]] = Field(
        default=None,
        description="BWS ranking scores from Epic 2 (code → score, works for occupations or tasks)"
    )

    top_10_bws: Optional[list[str]] = Field(
        default=None,
        description="HB-ranked list of WA_Element_IDs (best → worst). Forwarded to matching service."
    )

    # === NODE2VEC RECOMMENDATIONS ===
    recommendations: Optional[Node2VecRecommendations] = Field(
        default=None,
        description="Complete Node2Vec algorithm output"
    )
    
    # === PRESENTATION TRACKING ===
    presented_occupations: list[str] = Field(
        default_factory=list,
        description="IDs of occupation recommendations shown to user"
    )
    presented_opportunities: list[str] = Field(
        default_factory=list,
        description="IDs of opportunity recommendations shown to user"
    )
    presented_trainings: list[str] = Field(
        default_factory=list,
        description="IDs of training recommendations shown to user"
    )
    
    # === USER ENGAGEMENT TRACKING ===
    user_interest_signals: dict[str, str] = Field(
        default_factory=dict,
        description="Interest level per recommendation ID: {id: 'interested'|'exploring'|'neutral'|'rejected'|'committed'}"
    )
    
    # Rejection counters (for Skills Upgrade Pivot logic)
    rejected_occupations: int = Field(
        default=0, ge=0,
        description="Number of occupations rejected by user"
    )
    rejected_opportunities: int = Field(
        default=0, ge=0,
        description="Number of opportunities rejected by user"
    )
    rejected_trainings: int = Field(
        default=0, ge=0,
        description="Number of trainings rejected by user"
    )
    
    # === CURRENT FOCUS ===
    current_recommendation_type: str = Field(
        default="occupation",
        description="Current focus: 'occupation' | 'opportunity' | 'training'"
    )
    current_focus_id: Optional[str] = Field(
        default=None,
        description="ID of recommendation currently being discussed"
    )
    explored_items: list[str] = Field(
        default_factory=list,
        description="All recommendation IDs that have been explored in depth"
    )
    
    # === CONCERNS & RESISTANCE ===
    concerns_raised: list[ConcernRecord] = Field(
        default_factory=list,
        description="All concerns raised during the conversation"
    )
    addressed_concerns: list[str] = Field(
        default_factory=list,
        description="IDs of concerns that have been addressed"
    )
    
    # === SKILLS UPGRADE PIVOT ===
    pivoted_to_training: bool = Field(
        default=False,
        description="Whether we pivoted to training due to occupation rejections"
    )
    
    # === TRADEOFFS TRACKING ===
    tradeoffs_discussed_for: list[str] = Field(
        default_factory=list,
        description="IDs of occupations for which tradeoffs have been discussed"
    )

    # === OUT-OF-LIST OCCUPATION TRACKING ===
    pending_out_of_list_occupation: Optional[str] = Field(
        default=None,
        description="Name of out-of-list occupation user inquired about (e.g., 'DJ'). Set when we ask if they want to explore it."
    )
    pending_out_of_list_occupation_entity: Optional[dict] = Field(
        default=None,
        description="Stored occupation entity data for pending out-of-list occupation (if found in taxonomy)"
    )
    educational_guidance_shown: bool = Field(
        default=False,
        description="True if we've shown educational career path guidance for the pending out-of-list occupation. Reset when pending occupation is cleared."
    )

    # === ACTION COMMITMENT ===
    action_commitment: Optional[ActionCommitment] = Field(
        default=None,
        description="User's final action commitment"
    )
    
    # === LABOR DEMAND CONTEXT ===
    labor_demand_data: dict[str, dict[str, Any]] = Field(
        default_factory=dict,
        description="Labor demand context per occupation (loaded from config)"
    )
    
    # === CONVERSATION LOG ===
    conversation_log: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Full conversation log for DB6 persistence"
    )
    
    # === DB6 INTEGRATION ===
    db6_snapshot: Optional[dict[str, Any]] = Field(
        default=None,
        description="Snapshot of user profile from DB6 at session start"
    )

    @model_validator(mode='after')
    def auto_generate_youth_id(self) -> 'RecommenderAdvisorAgentState':
        """Auto-generate youth_id from session_id if not provided."""
        if self.youth_id is None:
            self.youth_id = f"youth_{self.session_id}"
        return self

    class Config:
        extra = "forbid"

    # ==================== SERIALIZATION ====================

    @field_serializer("country_of_user")
    def serialize_country_of_user(self, country_of_user: Country, _info):
        """Serialize Country enum to string for MongoDB storage."""
        return country_of_user.name

    @field_validator("country_of_user", mode='before')
    @classmethod
    def deserialize_country_of_user(cls, value: str | Country) -> Country:
        """Deserialize country from string (MongoDB) or enum."""
        if isinstance(value, str):
            return Country[value]
        return value

    # ==================== HELPER METHODS ====================
    
    @classmethod
    def from_document(cls, doc: Mapping[str, Any]) -> "RecommenderAdvisorAgentState":
        """
        Create a RecommenderAdvisorAgentState from a MongoDB document.
        
        Args:
            doc: MongoDB document containing state data
            
        Returns:
            RecommenderAdvisorAgentState instance
        """
        # Convert conversation_phase from string if needed
        data = dict(doc)
        if "conversation_phase" in data and isinstance(data["conversation_phase"], str):
            data["conversation_phase"] = ConversationPhase(data["conversation_phase"])
        
        # Convert preference_vector from dict if present
        if "preference_vector" in data and isinstance(data["preference_vector"], dict):
            data["preference_vector"] = PreferenceVector(**data["preference_vector"])
        
        # Convert recommendations from dict if present
        if "recommendations" in data and isinstance(data["recommendations"], dict):
            data["recommendations"] = Node2VecRecommendations(**data["recommendations"])
        
        # Convert action_commitment from dict if present
        if "action_commitment" in data and isinstance(data["action_commitment"], dict):
            data["action_commitment"] = ActionCommitment(**data["action_commitment"])
        
        # Convert concerns_raised list
        if "concerns_raised" in data:
            data["concerns_raised"] = [
                ConcernRecord(**c) if isinstance(c, dict) else c
                for c in data["concerns_raised"]
            ]
        
        # Backward compatibility: rename bws_occupation_scores → bws_scores
        if "bws_occupation_scores" in data and "bws_scores" not in data:
            data["bws_scores"] = data.pop("bws_occupation_scores")
        elif "bws_occupation_scores" in data:
            data.pop("bws_occupation_scores")

        return cls(**data)
    
    def should_pivot_to_training(self) -> bool:
        """
        Check if we should pivot to training recommendations.

        Returns:
            True if user has rejected 3+ occupations AND trainings are available
        """
        # Only pivot if we have training recommendations available
        has_trainings = (
            self.recommendations is not None
            and len(self.recommendations.skillstraining_recommendations) > 0
        )

        return (
            self.rejected_occupations >= 3
            and not self.pivoted_to_training
            and has_trainings
        )
    
    def can_complete(self) -> bool:
        """
        Check if the recommender session can be completed.
        
        Returns:
            True if minimum requirements are met for completion
        """
        # Must have presented at least 1 occupation
        if len(self.presented_occupations) == 0:
            return False
        
        # Should have some user engagement
        if len(self.user_interest_signals) == 0:
            return False
        
        return True
    
    def get_recommendation_by_id(self, rec_id: str) -> Optional[Any]:
        """
        Get a recommendation by its UUID across all types.

        Args:
            rec_id: Recommendation UUID to find

        Returns:
            Recommendation object or None if not found
        """
        if self.recommendations is None:
            return None

        # Search occupations
        for occ in self.recommendations.occupation_recommendations:
            if occ.uuid == rec_id:
                return occ

        # Search opportunities
        for opp in self.recommendations.opportunity_recommendations:
            if opp.uuid == rec_id:
                return opp

        # Search trainings (may be empty in v1)
        for trn in self.recommendations.skillstraining_recommendations:
            if trn.uuid == rec_id:
                return trn

        return None
    
    def mark_interest(self, rec_id: str, level: UserInterestLevel) -> None:
        """
        Mark user's interest level for a recommendation.
        
        Args:
            rec_id: Recommendation ID
            level: Interest level
        """
        self.user_interest_signals[rec_id] = level.value
        
        # Update rejection counters if rejected
        if level == UserInterestLevel.REJECTED:
            rec = self.get_recommendation_by_id(rec_id)
            if rec is not None:
                # Determine type by checking which list has it (using uuid)
                if self.recommendations:
                    if any(o.uuid == rec_id for o in self.recommendations.occupation_recommendations):
                        self.rejected_occupations += 1
                    elif any(o.uuid == rec_id for o in self.recommendations.opportunity_recommendations):
                        self.rejected_opportunities += 1
                    elif any(o.uuid == rec_id for o in self.recommendations.skillstraining_recommendations):
                        self.rejected_trainings += 1
    
    def add_concern(self, concern: ConcernRecord) -> None:
        """
        Add a user concern to the state.
        
        Args:
            concern: ConcernRecord to add
        """
        self.concerns_raised.append(concern)
    
    def mark_concern_addressed(self, concern_index: int, response: str) -> None:
        """
        Mark a concern as addressed.
        
        Args:
            concern_index: Index of concern in concerns_raised list
            response: Response that addressed the concern
        """
        if 0 <= concern_index < len(self.concerns_raised):
            self.concerns_raised[concern_index].addressed = True
            self.concerns_raised[concern_index].response_given = response
            self.addressed_concerns.append(self.concerns_raised[concern_index].item_id)
    
    def increment_turn_count(self) -> None:
        """Increment the conversation turn counter."""
        self.conversation_turn_count += 1
    
    def set_action_commitment(self, commitment: ActionCommitment) -> None:
        """
        Set the user's action commitment.
        
        Args:
            commitment: ActionCommitment from the user
        """
        self.action_commitment = commitment
        
        # Also update interest signal to committed
        self.user_interest_signals[commitment.recommendation_id] = UserInterestLevel.COMMITTED.value
    
    def get_unexplored_occupations(self) -> list[str]:
        """
        Get occupation UUIDs that haven't been explored yet.

        Returns:
            List of unexplored occupation UUIDs
        """
        if self.recommendations is None:
            return []

        all_occ_ids = [o.uuid for o in self.recommendations.occupation_recommendations]
        return [oid for oid in all_occ_ids if oid not in self.explored_items]
    
    def get_session_summary(self) -> dict[str, Any]:
        """
        Get a summary of the session for DB6 logging.
        
        Returns:
            Dictionary suitable for DB6 RecommenderSessionLog
        """
        return {
            "session_id": self.session_id,
            "youth_id": self.youth_id,
            "recommendations_presented": {
                "occupations": self.presented_occupations,
                "opportunities": self.presented_opportunities,
                "trainings": self.presented_trainings
            },
            "user_engagement": {
                "occupations_explored": self._filter_explored_by_type("occupation"),
                "occupations_rejected": self._filter_rejected_by_type("occupation"),
                "opportunities_explored": self._filter_explored_by_type("opportunity"),
                "opportunities_rejected": self._filter_rejected_by_type("opportunity"),
                "trainings_explored": self._filter_explored_by_type("training"),
                "trainings_rejected": self._filter_rejected_by_type("training")
            },
            "concerns_raised": [
                {
                    "item_id": c.item_id,
                    "concern": c.concern,
                    "type": c.resistance_type.value
                }
                for c in self.concerns_raised
            ],
            "concerns_addressed": len(self.addressed_concerns),
            "action_commitment": self.action_commitment.model_dump() if self.action_commitment else None,
            "turns_count": self.conversation_turn_count,
            "pivoted_to_training": self.pivoted_to_training,
            "recommendation_flow": self._get_recommendation_flow()
        }
    
    def _filter_explored_by_type(self, rec_type: str) -> list[str]:
        """
        Filter explored items by recommendation type.

        Args:
            rec_type: Type to filter ('occupation', 'opportunity', 'training')

        Returns:
            List of UUIDs of explored items of that type
        """
        if self.recommendations is None:
            return []

        explored = []
        for item_id in self.explored_items:
            rec = self.get_recommendation_by_id(item_id)
            if rec is None:
                continue

            # Check type by which list contains it
            if rec_type == "occupation" and any(
                o.uuid == item_id for o in self.recommendations.occupation_recommendations
            ):
                explored.append(item_id)
            elif rec_type == "opportunity" and any(
                o.uuid == item_id for o in self.recommendations.opportunity_recommendations
            ):
                explored.append(item_id)
            elif rec_type == "training" and any(
                o.uuid == item_id for o in self.recommendations.skillstraining_recommendations
            ):
                explored.append(item_id)

        return explored

    def _filter_rejected_by_type(self, rec_type: str) -> list[str]:
        """
        Filter rejected items by recommendation type.

        Args:
            rec_type: Type to filter ('occupation', 'opportunity', 'training')

        Returns:
            List of UUIDs of rejected items of that type
        """
        if self.recommendations is None:
            return []

        rejected = []
        for item_id, level in self.user_interest_signals.items():
            if level != "rejected":
                continue

            rec = self.get_recommendation_by_id(item_id)
            if rec is None:
                continue

            # Check type by which list contains it
            if rec_type == "occupation" and any(
                o.uuid == item_id for o in self.recommendations.occupation_recommendations
            ):
                rejected.append(item_id)
            elif rec_type == "opportunity" and any(
                o.uuid == item_id for o in self.recommendations.opportunity_recommendations
            ):
                rejected.append(item_id)
            elif rec_type == "training" and any(
                o.uuid == item_id for o in self.recommendations.skillstraining_recommendations
            ):
                rejected.append(item_id)

        return rejected

    def _get_recommendation_flow(self) -> list[str]:
        """
        Determine the recommendation flow path taken.

        Returns:
            List representing the path (e.g., ['occupation', 'opportunity', 'action'])
        """
        flow = []

        if len(self.presented_occupations) > 0:
            flow.append("occupation")

        if len(self.presented_opportunities) > 0:
            flow.append("opportunity")

        if self.pivoted_to_training:
            flow.append("training_pivot")
        elif len(self.presented_trainings) > 0:
            flow.append("training")

        if self.action_commitment is not None:
            flow.append("action")

        return flow

"""
State management for the Preference Elicitation Agent.

This module defines the state model that tracks the conversation progress,
vignettes shown, responses collected, and the evolving preference vector.
"""

from typing import Any, Literal, Mapping, Optional
from pydantic import BaseModel, Field

from app.agent.preference_elicitation_agent.types import (
    PreferenceVector,
    VignetteResponse
)
from app.agent.experience.experience_entity import ExperienceEntity


class PreferenceElicitationAgentState(BaseModel):
    """
    State for the Preference Elicitation Agent.

    Tracks the entire preference elicitation conversation flow,
    including which vignettes have been shown, user responses,
    and the current preference vector.
    """
    session_id: int
    """Unique session identifier"""

    # DB6 Integration (Hybrid Approach)
    initial_experiences_snapshot: Optional[list[ExperienceEntity]] = None
    """
    Snapshot of experiences at agent start (IMMUTABLE during conversation).

    Sources:
    - CV upload: Parsed experiences from uploaded CV
    - Prior Compass session: Copied from explored_experiences at agent start
    - DB6: Fetched from youth profile if available
    - None: No prior experiences available (will use generic questions)

    This snapshot provides consistency during the conversation - it doesn't change
    even if the user edits experiences in the UI.
    """

    use_db6_for_fresh_data: bool = False
    """
    Enable fetching fresh experiences from DB6 (Epic 1's Youth Database).

    Default: False (works without Epic 1 dependency, uses snapshot only)
    Set to True: Fetch fresh data from DB6 if available, fall back to snapshot if not

    This flag allows smooth transition from Epic 2 development (no Epic 1) to
    production (with Epic 1 DB6 available).
    """

    conversation_phase: Literal["INTRO", "EXPERIENCE_QUESTIONS", "VIGNETTES", "FOLLOW_UP", "WRAPUP", "COMPLETE"] = "INTRO"
    """Current phase of the preference elicitation conversation"""

    completed_vignettes: list[str] = Field(default_factory=list)
    """List of vignette IDs that have been completed"""

    current_vignette_id: Optional[str] = None
    """ID of the currently active vignette (if any)"""

    vignette_responses: list[VignetteResponse] = Field(default_factory=list)
    """All vignette responses collected so far"""

    preference_vector: PreferenceVector = Field(default_factory=PreferenceVector)
    """The evolving preference vector being built"""

    conversation_turn_count: int = 0
    """Number of conversation turns in this session"""

    experience_based_preferences: dict[str, Any] = Field(default_factory=dict)
    """Preferences extracted from experience-based questions"""

    categories_covered: list[str] = Field(default_factory=list)
    """Preference categories that have been explored (e.g., ["financial", "work_environment"])"""

    categories_to_explore: list[str] = Field(default_factory=lambda: [
        "financial",
        "work_environment",
        "job_security",
        "career_advancement",
        "work_life_balance",
        "task_preferences"
    ])
    """Categories that still need to be explored"""

    needs_follow_up: bool = False
    """Whether current vignette needs a follow-up probe question"""

    follow_up_question: Optional[str] = None
    """Current follow-up question being asked (if any)"""

    follow_ups_asked: list[str] = Field(default_factory=list)
    """List of vignette IDs we've already asked follow-ups for (max one per vignette)"""

    last_experience_question_asked: Optional[str] = None
    """The last experience question that was asked (for extraction context)"""

    user_has_indicated_completion: bool = False
    """Whether user has indicated they want to finish"""

    minimum_vignettes_completed: int = 5
    """Minimum number of vignettes required before allowing completion"""

    notes: str = ""
    """Any additional notes or context about this session"""

    class Config:
        extra = "forbid"

    @staticmethod
    def from_document(doc: Mapping[str, Any]) -> "PreferenceElicitationAgentState":
        """
        Create a PreferenceElicitationAgentState from a MongoDB document.

        Args:
            doc: MongoDB document containing state data

        Returns:
            PreferenceElicitationAgentState instance
        """
        return PreferenceElicitationAgentState(
            session_id=doc["session_id"],
            initial_experiences_snapshot=[
                ExperienceEntity(**exp) for exp in doc.get("initial_experiences_snapshot", [])
            ] if doc.get("initial_experiences_snapshot") else None,
            use_db6_for_fresh_data=doc.get("use_db6_for_fresh_data", False),
            conversation_phase=doc.get("conversation_phase", "INTRO"),
            completed_vignettes=doc.get("completed_vignettes", []),
            current_vignette_id=doc.get("current_vignette_id"),
            vignette_responses=[
                VignetteResponse(**resp) for resp in doc.get("vignette_responses", [])
            ],
            preference_vector=PreferenceVector(**doc.get("preference_vector", {})),
            conversation_turn_count=doc.get("conversation_turn_count", 0),
            experience_based_preferences=doc.get("experience_based_preferences", {}),
            categories_covered=doc.get("categories_covered", []),
            categories_to_explore=doc.get("categories_to_explore", [
                "financial",
                "work_environment",
                "job_security",
                "career_advancement",
                "work_life_balance",
                "task_preferences"
            ]),
            needs_follow_up=doc.get("needs_follow_up", False),
            follow_up_question=doc.get("follow_up_question"),
            follow_ups_asked=list(doc.get("follow_ups_asked", [])),
            last_experience_question_asked=doc.get("last_experience_question_asked"),
            user_has_indicated_completion=doc.get("user_has_indicated_completion", False),
            minimum_vignettes_completed=doc.get("minimum_vignettes_completed", 5),
            notes=doc.get("notes", "")
        )

    def can_complete(self) -> bool:
        """
        Check if the preference elicitation session can be completed.

        Returns:
            True if minimum requirements are met for completion
        """
        return (
            len(self.completed_vignettes) >= self.minimum_vignettes_completed
            and len(self.categories_covered) >= 6
            and self.preference_vector.confidence_score > 0.3
        )

    def get_next_category_to_explore(self) -> Optional[str]:
        """
        Get the next preference category to explore.

        Returns:
            Category name or None if all covered
        """
        if not self.categories_to_explore:
            return None
        return self.categories_to_explore[0]

    def mark_category_covered(self, category: str) -> None:
        """
        Mark a category as covered and remove from explore list.

        Args:
            category: Category name to mark as covered
        """
        if category not in self.categories_covered:
            self.categories_covered.append(category)
        if category in self.categories_to_explore:
            self.categories_to_explore.remove(category)

    def add_vignette_response(self, response: VignetteResponse) -> None:
        """
        Add a vignette response to the state.

        Args:
            response: VignetteResponse to add
        """
        self.vignette_responses.append(response)
        if response.vignette_id not in self.completed_vignettes:
            self.completed_vignettes.append(response.vignette_id)
        self.current_vignette_id = None

    def increment_turn_count(self) -> None:
        """Increment the conversation turn counter."""
        self.conversation_turn_count += 1

    def mark_follow_up_asked(self, vignette_id: str) -> None:
        """
        Mark that we've asked a follow-up for this vignette.

        Args:
            vignette_id: ID of the vignette we asked a follow-up for
        """
        if vignette_id not in self.follow_ups_asked:
            self.follow_ups_asked.append(vignette_id)

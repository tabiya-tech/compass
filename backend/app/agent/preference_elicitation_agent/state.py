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

    # Youth Database Integration (Hybrid Approach)
    initial_experiences_snapshot: Optional[list[ExperienceEntity]] = None
    """
    Snapshot of experiences at agent start (IMMUTABLE during conversation).

    Sources:
    - CV upload: Parsed experiences from uploaded CV
    - Prior Compass session: Copied from explored_experiences at agent start
    - Youth database: Fetched from youth profile if available
    - None: No prior experiences available (will use generic questions)

    This snapshot provides consistency during the conversation - it doesn't change
    even if the user edits experiences in the UI.
    """

    use_db6_for_fresh_data: bool = False
    """
    Enable fetching fresh experiences from youth database.

    Default: False (works without database dependency, uses snapshot only)
    Set to True: Fetch fresh data from database if available, fall back to snapshot if not

    This flag allows smooth transition from development (no database) to
    production (with youth database available).
    """

    conversation_phase: Literal["INTRO", "EXPERIENCE_QUESTIONS", "BWS", "VIGNETTES", "FOLLOW_UP", "WRAPUP", "COMPLETE"] = "INTRO"
    """Current phase of the preference elicitation conversation"""

    # ========== BWS (Best-Worst Scaling) Phase ==========
    bws_phase_complete: bool = False
    """Whether the BWS occupation ranking phase is complete"""

    bws_tasks_completed: int = 0
    """Number of BWS tasks completed (out of 12)"""

    bws_responses: list[dict[str, Any]] = Field(default_factory=list)
    """
    BWS responses collected.
    Format: [{"task_id": 0, "alts": ["11","21","31","41","51"], "best": "21", "worst": "41"}, ...]
    """

    occupation_scores: Optional[dict[str, float]] = None
    """
    Simple scoring for each occupation (code → score).
    Score = count(best) - count(worst)
    """

    top_10_occupations: list[str] = Field(default_factory=list)
    """Top 10 occupation codes ranked by BWS scores"""

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

    # ========== NEW: Adaptive D-Efficiency Fields ==========
    use_adaptive_selection: bool = False
    """Feature flag: Enable adaptive D-efficiency optimization"""

    # Bayesian posterior (only used if adaptive mode)
    posterior_mean: Optional[list[float]] = None
    """Posterior mean vector (μ) - 7 dimensions"""

    posterior_covariance: Optional[list[list[float]]] = None
    """Posterior covariance matrix (Σ) - 7x7"""

    # Fisher Information Matrix (7×7)
    fisher_information_matrix: Optional[list[list[float]]] = None
    """Fisher Information Matrix tracking information gain"""

    # Per-dimension uncertainty tracking
    uncertainty_per_dimension: Optional[dict[str, float]] = None
    """Variance for each preference dimension"""

    # Information gain tracking
    information_gain_per_vignette: Optional[list[float]] = None
    """Information gain from each vignette shown"""

    # Stopping criterion state
    fim_determinant: Optional[float] = None
    """Determinant of Fisher Information Matrix"""

    stopped_early: bool = False
    """Whether elicitation stopped early due to low uncertainty"""

    stopping_reason: Optional[str] = None
    """Reason for stopping (if stopped early)"""

    # Adaptive vignette flow tracking
    adaptive_phase_complete: bool = False
    """Whether the adaptive selection phase has completed"""

    adaptive_vignettes_shown_count: int = 0
    """Number of adaptive vignettes shown (between static beginning and end)"""

    class Config:
        extra = "forbid"

    @staticmethod
    def _normalize_experience_for_deserialization(exp_dict: dict) -> dict:
        """
        Normalize experience dict for deserialization, handling tuple-format skills.

        This handles backward compatibility where top_skills might be stored as:
        - Old format: [[score, skill_dict], ...] (tuples from explored_experiences)
        - New format: [skill_dict_with_score, ...] (plain dicts)

        Args:
            exp_dict: Raw experience dictionary from MongoDB

        Returns:
            Normalized experience dictionary safe for ExperienceEntity(**dict)
        """
        # Make a copy to avoid mutating the input
        normalized = exp_dict.copy()

        # Handle top_skills if present
        if "top_skills" in normalized and normalized["top_skills"]:
            normalized_skills = []
            for skill in normalized["top_skills"]:
                # Check if skill is a tuple [score, skill_dict]
                if isinstance(skill, list) and len(skill) == 2:
                    # Extract just the skill dict, ignoring the score
                    # (score is not part of ExperienceEntity schema for initial_experiences_snapshot)
                    normalized_skills.append(skill[1])
                else:
                    # Already in correct format
                    normalized_skills.append(skill)
            normalized["top_skills"] = normalized_skills

        return normalized

    @staticmethod
    def from_document(doc: Mapping[str, Any]) -> "PreferenceElicitationAgentState":
        """
        Create a PreferenceElicitationAgentState from a MongoDB document.

        Args:
            doc: MongoDB document containing state data

        Returns:
            PreferenceElicitationAgentState instance
        """
        # Normalize experiences to handle tuple-format skills from explored_experiences
        initial_experiences_snapshot = None
        if doc.get("initial_experiences_snapshot"):
            initial_experiences_snapshot = [
                ExperienceEntity(**PreferenceElicitationAgentState._normalize_experience_for_deserialization(exp))
                for exp in doc.get("initial_experiences_snapshot", [])
            ]

        return PreferenceElicitationAgentState(
            session_id=doc["session_id"],
            initial_experiences_snapshot=initial_experiences_snapshot,
            use_db6_for_fresh_data=doc.get("use_db6_for_fresh_data", False),
            conversation_phase=doc.get("conversation_phase", "INTRO"),
            # BWS fields
            bws_phase_complete=doc.get("bws_phase_complete", False),
            bws_tasks_completed=doc.get("bws_tasks_completed", 0),
            bws_responses=list(doc.get("bws_responses", [])),
            occupation_scores=doc.get("occupation_scores"),
            top_10_occupations=list(doc.get("top_10_occupations", [])),
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
            notes=doc.get("notes", ""),
            # Adaptive D-efficiency fields
            use_adaptive_selection=doc.get("use_adaptive_selection", False),
            posterior_mean=doc.get("posterior_mean"),
            posterior_covariance=doc.get("posterior_covariance"),
            fisher_information_matrix=doc.get("fisher_information_matrix"),
            uncertainty_per_dimension=doc.get("uncertainty_per_dimension"),
            information_gain_per_vignette=doc.get("information_gain_per_vignette"),
            fim_determinant=doc.get("fim_determinant"),
            stopped_early=doc.get("stopped_early", False),
            stopping_reason=doc.get("stopping_reason"),
            adaptive_phase_complete=doc.get("adaptive_phase_complete", False),
            adaptive_vignettes_shown_count=doc.get("adaptive_vignettes_shown_count", 0)
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

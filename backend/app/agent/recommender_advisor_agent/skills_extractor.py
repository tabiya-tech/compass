"""
Skills Extractor for Recommender/Advisor Agent.

Extracts and aggregates skills from user experiences to create a skills vector
suitable for Node2vec recommendation algorithm.
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

from app.agent.experience.experience_entity import ExperienceEntity
from app.vector_search.esco_entities import SkillEntity

PROFICIENCY_WEIGHT_AVG_SCORE = 0.60
PROFICIENCY_WEIGHT_FREQUENCY = 0.25
PROFICIENCY_WEIGHT_TOP_SKILL_RATIO = 0.15


@dataclass
class SkillAggregation:
    """
    Aggregated skill data across multiple experiences.

    Tracks skill occurrence, sources, and scores to calculate
    overall proficiency.
    """
    skill_entity: SkillEntity
    """The skill entity with core data (id, uuid, preferred_label, etc.)"""

    scores: List[float] = field(default_factory=list)
    """List of all scores assigned to this skill across experiences"""

    frequency: int = 0
    """Number of times this skill appears across all experiences"""

    source_experiences: List[str] = field(default_factory=list)
    """UUIDs of experiences where this skill was mentioned"""

    from_top_skills: int = 0
    """Count of times skill appeared in top_skills"""

    from_remaining_skills: int = 0
    """Count of times skill appeared in remaining_skills"""

    def calculate_proficiency(self, total_experiences: int) -> float:
        """
        Calculate proficiency score for this skill.

        Formula: PROFICIENCY_WEIGHT_AVG_SCORE * avg_score + PROFICIENCY_WEIGHT_FREQUENCY * frequency_norm + PROFICIENCY_WEIGHT_TOP_SKILL_RATIO * top_skill_ratio

        Where:
        - avg_score: Average of all skill scores
        - frequency_norm: Normalized frequency (capped at 1.0)
        - top_skill_ratio: Proportion of appearances in top_skills vs total

        Args:
            total_experiences: Total number of experiences in snapshot

        Returns:
            Proficiency score between 0.0 and 1.0
        """
        if not self.scores:
            return 0.0

        # Component 1: Average score (60% weight)
        avg_score = sum(self.scores) / len(self.scores)

        # Component 2: Frequency normalized (25% weight)
        # Normalize by total experiences, cap at 1.0
        frequency_norm = min(self.frequency / total_experiences, 1.0) if total_experiences > 0 else 0.0

        # Component 3: Top skill ratio (15% weight)
        # Ratio of top_skills appearances vs total appearances
        top_skill_ratio = self.from_top_skills / self.frequency if self.frequency > 0 else 0.0

        proficiency = (
            PROFICIENCY_WEIGHT_AVG_SCORE * avg_score
            + PROFICIENCY_WEIGHT_FREQUENCY * frequency_norm
            + PROFICIENCY_WEIGHT_TOP_SKILL_RATIO * top_skill_ratio
        )

        return round(proficiency, 4)

    def to_dict(self, total_experiences: int) -> Dict[str, Any]:
        """
        Convert to dictionary format for skills vector.

        Args:
            total_experiences: Total number of experiences in snapshot

        Returns:
            Dictionary with skill data and proficiency
        """
        return {
            "skill_id": self.skill_entity.id,
            "uuid": self.skill_entity.UUID,
            "preferred_label": self.skill_entity.preferredLabel,
            "skill_type": self.skill_entity.skillType,
            "origin_uuid": self.skill_entity.originUUID,
            "proficiency": self.calculate_proficiency(total_experiences),
            "frequency": self.frequency,
            "source_experiences": self.source_experiences,
            "from_top_skills": self.from_top_skills,
            "from_remaining_skills": self.from_remaining_skills,
            "avg_score": round(sum(self.scores) / len(self.scores), 4) if self.scores else 0.0
        }


class SkillsExtractor:
    """
    Extracts and aggregates skills from experience entities.

    Processes ExperienceEntity.top_skills and .remaining_skills to create
    a unified skills vector with proficiency scores.
    """

    def extract_skills_vector(self, experiences: Optional[List[ExperienceEntity]]) -> Dict[str, Any]:
        """
        Extract skills vector from experiences snapshot.

        Args:
            experiences: List of ExperienceEntity objects with skills

        Returns:
            Dictionary containing:
            - skills: List of skill dicts with proficiency scores
            - total_experiences: Number of experiences processed
            - extraction_metadata: Metadata about extraction process
        """
        if not experiences:
            return {
                "skills": [],
                "total_experiences": 0,
                "extraction_metadata": {
                    "top_skills_processed": 0,
                    "remaining_skills_processed": 0,
                    "unique_skills": 0
                }
            }

        # Aggregate skills by UUID
        skill_aggregations: Dict[str, SkillAggregation] = {}
        top_skills_count = 0
        remaining_skills_count = 0

        for experience in experiences:
            experience_uuid = experience.uuid

            # Process top_skills
            if experience.top_skills:
                for skill in experience.top_skills:
                    if not isinstance(skill, SkillEntity):
                        continue

                    skill_uuid = skill.UUID

                    # Initialize aggregation if first occurrence
                    if skill_uuid not in skill_aggregations:
                        skill_aggregations[skill_uuid] = SkillAggregation(
                            skill_entity=skill
                        )

                    agg = skill_aggregations[skill_uuid]
                    agg.scores.append(skill.score if hasattr(skill, 'score') and skill.score is not None else 0.5)
                    agg.frequency += 1
                    agg.from_top_skills += 1

                    if experience_uuid not in agg.source_experiences:
                        agg.source_experiences.append(experience_uuid)

                    top_skills_count += 1

            # Process remaining_skills
            if experience.remaining_skills:
                for skill in experience.remaining_skills:
                    if not isinstance(skill, SkillEntity):
                        continue

                    skill_uuid = skill.UUID

                    # Initialize aggregation if first occurrence
                    if skill_uuid not in skill_aggregations:
                        skill_aggregations[skill_uuid] = SkillAggregation(
                            skill_entity=skill
                        )

                    agg = skill_aggregations[skill_uuid]
                    agg.scores.append(skill.score if hasattr(skill, 'score') and skill.score is not None else 0.3)
                    agg.frequency += 1
                    agg.from_remaining_skills += 1

                    if experience_uuid not in agg.source_experiences:
                        agg.source_experiences.append(experience_uuid)

                    remaining_skills_count += 1

        # Convert aggregations to skill dicts
        total_experiences = len(experiences)
        skills_list = [
            agg.to_dict(total_experiences)
            for agg in skill_aggregations.values()
        ]

        # Sort by proficiency (highest first)
        skills_list.sort(key=lambda x: x["proficiency"], reverse=True)

        return {
            "skills": skills_list,
            "total_experiences": total_experiences,
            "extraction_metadata": {
                "top_skills_processed": top_skills_count,
                "remaining_skills_processed": remaining_skills_count,
                "unique_skills": len(skill_aggregations)
            }
        }

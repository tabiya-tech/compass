import logging
from typing import List

from pydantic import BaseModel

from ._relevance_classifier_llm import _RelevanceClassifierLLM
from app.agent.agent_types import LLMStats
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_entities import OccupationSkillEntity, SkillEntity
from app.vector_search.esco_search_service import SkillSearchService


class SkillsLinkingToolResponse(BaseModel):
    """
    The response of the SkillsLinkingTool.
    """
    top_skills: list[SkillEntity]
    llm_stats: list[LLMStats]


class _SkillStat(BaseModel):
    """

    """
    skill: SkillEntity
    count: int
    score_sum: float = 0.0


class SkillLinkingTool:

    def __init__(self, skill_search_service: SkillSearchService):
        self._skill_search_service = skill_search_service
        self._relevance_tool = _RelevanceClassifierLLM()
        self._logger = logging.getLogger(__class__.__name__)

    async def execute(self, *,
                      experience_title: str,
                      contextual_title: str,
                      esco_occupations: List[OccupationSkillEntity],
                      responsibilities: list[str],
                      only_essential: bool = True,
                      top_k: int = 5,
                      top_p: int = 10) -> SkillsLinkingToolResponse:
        """
        Return the top_k that are linked to the responsibilities.

        First find the top_p most similar skills for each responsibility that are withing the list of skills of the esco_occupations,
        then rank them based on the similarity score and the number of occurrences, and return the top_k highest ranked skills.

        Additionally, if only_essential is True, only the essential skills will be considered associated with the given occupations.

        If the esco_occupations list is empty, the search will consider all the skills in the ESCO database.

        Here is the output of the algorithm:
        # 1. Generate the embeddings for the responsibilities (responsibilities_data.responsibilities)
        # 2. For each responsibility (embedding),
        # 2.1 Find the top_p most similar skills that are
            if esco_occupations is empty
                within all the skills in the database
            if esco_occupations is not empty
                within the list of skills of the esco_occupations
        # 2.2 Discard the skills that are not relevant by using the relevance classifier
        # 2.3 Count the number of occurrences of each skill and update the ranking
        # 3. Return the top_k highest ranked skills
        """
        # Prepare the data
        skill_stats: dict[str, _SkillStat] = {}  # The uuid is the key

        # Get the uuids of the skills of the esco_occupations
        esco_skills_uuids = []
        for occupation in esco_occupations:
            # Add the uuids of the skills of the occupation
            # if only_essential is True, only add the essential skills
            for associated_skill in occupation.associated_skills:
                if only_essential and associated_skill.relationType == "essential":
                    esco_skills_uuids.append(associated_skill.UUID)
        # remove duplicates
        esco_skills_uuids = list(set(esco_skills_uuids))
        if len(esco_skills_uuids) == 0:
            self._logger.debug("No skills found in the esco_occupations. The search will consider all the skills in the ESCO database.")

        # 1. Generate the embeddings for the responsibilities (responsibilities_data.responsibilities)
        embeddings_service = GoogleGeckoEmbeddingService()
        responsibilities_embeddings = await embeddings_service.embed_batch(responsibilities)
        # 2. For each responsibility (embedding),
        all_llm_stats: list[LLMStats] = []
        for responsibility_text, responsibility_embedding in zip(responsibilities, responsibilities_embeddings):
            # 2.1 Find the top_p most similar skills that are within the list of skills of the esco_occupations
            filter_spec = {"UUID": {"$in": esco_skills_uuids}} if len(esco_skills_uuids) > 0 else None
            similar_skills = await self._skill_search_service.search(query=responsibility_embedding, filter_spec=filter_spec, k=top_p)
            # 2.2  Discard the skills that are not relevant by using the relevance classifier
            relevance_response, llm_stats = await self._relevance_tool.execute(
                experience_title=experience_title,
                contextual_title=contextual_title,
                responsibility=responsibility_text,
                skills=similar_skills,
                top_k=top_k
            )
            all_llm_stats.extend(llm_stats)

            # 2.3 Count the number of occurrences of each skill and update the ranking
            for skill in relevance_response.most_relevant_skills:
                if skill.UUID in skill_stats:
                    skill_stats[skill.UUID].count += 1
                    skill_stats[skill.UUID].score_sum += skill.score
                else:
                    skill_stats[skill.UUID] = _SkillStat(skill=skill, count=1, score_sum=skill.score)

        # 3. Return the top_k highest ranked skills
        # sorted_skills_freq = sorted(skill_stats.values(), key=lambda x: x.count, reverse=True)
        sorted_skills_score = sorted(skill_stats.values(), key=lambda x: x.score_sum, reverse=True)
        return SkillsLinkingToolResponse(
            top_skills=[skill_stat.skill for skill_stat in sorted_skills_score[:top_k]],
            llm_stats=all_llm_stats)
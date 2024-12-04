import asyncio
import logging
from typing import List, Coroutine, Any

from pydantic import BaseModel

from app.vector_search.similarity_search_service import FilterSpec
from ._relevant_skills_classifier_llm import _RelevantSkillsClassifierLLM
from app.agent.agent_types import LLMStats
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_entities import OccupationSkillEntity, SkillEntity
from app.vector_search.esco_search_service import SkillSearchService


class SkillsLinkingToolOutput(BaseModel):
    """
    The response of the SkillsLinkingTool.
    """
    top_skills: list[SkillEntity]
    llm_stats: list[LLMStats]


class _SkillStat(SkillEntity):
    """

    """
    count: int
    score_sum: float = 0.0

    def __init__(self, skill: SkillEntity, count: int, score_sum: float):
        super().__init__(count=count, score_sum=score_sum, **skill.model_dump())


class SkillLinkingTool:

    def __init__(self, skill_search_service: SkillSearchService):
        self._skill_search_service = skill_search_service
        self._relevant_skills_tool = _RelevantSkillsClassifierLLM()
        self._logger = logging.getLogger(__class__.__name__)

    async def execute(self, *,
                      job_titles: list[str],
                      esco_occupations: List[OccupationSkillEntity],
                      responsibilities: list[str],
                      only_essential: bool = True,
                      ignore_occupations: bool = False,
                      top_k: int,
                      top_p: int) -> SkillsLinkingToolOutput:
        """
        Finds the top_k matching skills to the experience title, contextual title, responsibilities that associated with the esco_occupations.
        # 1. Generate the embeddings for the responsibilities (responsibilities_data.responsibilities)
        # 2. For each responsibility (embedding),
        # 2.1 Find the top_p most similar skills that are
            if esco_occupations is empty or ignore_occupations is True
                within all the skills in the database
            elseif esco_occupations is not empty
                within the list of skills of the esco_occupations
        # 2.2 Discard the skills that are not relevant by using the relevance classifier
        # 2.3 Count the number of occurrences of each skill and update the ranking
        # 3. Return the top_k the highest ranked relevant skills
        """
        # Prepare the data
        skill_stats: dict[str, _SkillStat] = {}  # The uuid is the key

        # Get the uuids of the skills of the esco_occupations
        esco_skills_uuids = []
        if not ignore_occupations:
            for occupation in esco_occupations:
                # Add the uuids of the skills of the occupation
                # if only_essential is True, only add the essential skills
                for associated_skill in occupation.associated_skills:
                    if not only_essential or (associated_skill.relationType == "essential") or not associated_skill.relationType:
                        esco_skills_uuids.append(associated_skill.UUID)
            # remove duplicates
            esco_skills_uuids = list(set(esco_skills_uuids))
            if len(esco_skills_uuids) == 0:
                self._logger.info("No skills found in the esco_occupations. The skills search will consider all the skills in the ESCO database.")
        else:
            self._logger.info("Ignoring the occupations. The skills search will consider all the skills in the ESCO database "
                              "and will not be limited to the skills associated with the occupations provided.")

        # 1. Generate the embeddings for the responsibilities (responsibilities_data.responsibilities)
        embeddings_service = GoogleGeckoEmbeddingService()
        responsibilities_embeddings = await embeddings_service.embed_batch(responsibilities)
        # 2. For each responsibility (embedding),
        # Find the top_p most similar skills that are within the list of skills of the esco_occupations and get the top_k most relevant skills
        # Parallelize the process to speed up the execution
        tasks: list[Coroutine[Any, Any, tuple[list[SkillEntity], list[LLMStats]]]] = []
        for responsibility_text, responsibility_embedding in zip(responsibilities, responsibilities_embeddings):
            tasks.append(self._responsibility_to_skills(
                responsibility_text=responsibility_text,
                responsibility_embedding=responsibility_embedding,
                esco_skills_uuids=esco_skills_uuids,
                job_titles=job_titles,
                top_k=top_k,
                top_p=top_p
            ))
        self._logger.debug(f"Executing {len(tasks)} tasks in parallel to find the most relevant skills for the responsibilities.")
        most_relevant_skills_of_each_responsibility: list[tuple[list[SkillEntity], list[LLMStats]]] = await asyncio.gather(*tasks)
        # get the llm_stats and the scores of the skills from the executed tasks
        all_llm_stats = []
        for most_relevant_skills, llm_stats in most_relevant_skills_of_each_responsibility:
            all_llm_stats.extend(llm_stats)

            # 2.3 Count the number of occurrences of each skill and update the ranking
            for skill in most_relevant_skills:
                if skill.UUID in skill_stats:
                    skill_stats[skill.UUID].count += 1
                    skill_stats[skill.UUID].score_sum += skill.score
                else:
                    skill_stats[skill.UUID] = _SkillStat(skill=skill, count=1, score_sum=skill.score)

        # 3. Return the top_k the highest ranked relevant skills
        # 3.1 Get the skills relevant to all the responsibilities
        # sorted_skills_freq = sorted(skill_stats.values(), key=lambda x: x.count, reverse=True)
        # 3.2 Order the based on their score
        top_skills = [skill_stat for skill_stat in skill_stats.values()]
        if len(skill_stats) >= top_k:
            # Return the top_k most relevant skills
            top_k_relevant_skills_output = await self._relevant_skills_tool.execute(
                job_titles=job_titles,
                responsibilities=responsibilities,
                skills=top_skills,
                top_k=top_k
            )
            top_skills = top_k_relevant_skills_output.most_relevant

        sorted_skills_score = sorted(top_skills, key=lambda x: x.score_sum, reverse=True)
        return SkillsLinkingToolOutput(
            top_skills=[skill_stat for skill_stat in sorted_skills_score[:top_k]],
            llm_stats=all_llm_stats)

    async def _responsibility_to_skills(self, *, responsibility_text: str, responsibility_embedding: list[float], esco_skills_uuids: list[str],
                                        job_titles: list[str], top_k: int, top_p: int) -> tuple[list[SkillEntity], list[LLMStats]]:
        # 2.1 Find the top_p most similar skills that are within the list of skills of the esco_occupations
        filter_spec = FilterSpec(UUID=esco_skills_uuids) if len(esco_skills_uuids) > 0 else None
        similar_skills = await self._skill_search_service.search(query=responsibility_embedding, filter_spec=filter_spec, k=top_p)
        # 2.2  Discard the skills that are not relevant by using the relevance classifier and return the top_k most relevant skills for the responsibility
        relevant_skills_output = await self._relevant_skills_tool.execute(
            job_titles=job_titles,
            responsibilities=[responsibility_text],
            skills=similar_skills,
            top_k=top_k
        )
        return relevant_skills_output.most_relevant, relevant_skills_output.llm_stats

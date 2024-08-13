import asyncio
import json
import logging
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.experience.work_type import WorkType
from app.agent.linking_and_ranking_pipeline.cluster_responsibilities_tool import ClusterResponsibilitiesTool
from .infer_occupation_tool import InferOccupationTool
from .skill_linking_tool import SkillLinkingTool
from app.vector_search.esco_entities import SkillEntity, OccupationSkillEntity
from app.vector_search.vector_search_dependencies import SearchServices
from ...countries import Country

_NUMBER_OF_CLUSTERS: int = 5
_NUMBER_OF_OCCUPATION_ALT_TITLES: int = 5
_NUMBER_OF_OCCUPATIONS_PER_CLUSTER: int = 15
_NUMBER_OF_OCCUPATIONS_CANDIDATES_PER_CLUSTER: int = 2 * _NUMBER_OF_OCCUPATIONS_PER_CLUSTER
_NUMBER_OF_SKILLS_PER_CLUSTER: int = 5
_NUMBER_OF_SKILL_CANDIDATES_PER_RESPONSIBILITY: int = 3 * _NUMBER_OF_SKILLS_PER_CLUSTER


class ClusterPipelineResult(BaseModel):
    responsibilities: list[str]
    contextual_titles: list[str]
    esco_occupations: list[OccupationSkillEntity]
    unranked_skills: list[SkillEntity]
    ranked_skills: list[SkillEntity]
    llm_stats: list[LLMStats]

    class Config:
        extra = "forbid"


class ExperiencePipelineResponse(BaseModel):
    top_skills: list[SkillEntity]
    llm_stats: list[LLMStats]
    cluster_results: list[ClusterPipelineResult]

    class Config:
        extra = "forbid"


class ExperiencePipeline:
    def __init__(self, search_services: SearchServices):
        self._search_services = search_services
        self._cluster_responsibilities_tool = ClusterResponsibilitiesTool()
        self._infer_occupations_tool = InferOccupationTool(search_services.occupation_skill_search_service)
        self._skills_linking_tool = SkillLinkingTool(search_services.skill_search_service)
        self._logger = logging.getLogger(__class__.__name__)

    async def execute(self, *,
                      experience_title: str,
                      responsibilities: list[str],
                      company_name: Optional[str],
                      country_of_interest: Country,
                      work_type: WorkType) -> ExperiencePipelineResponse:
        """
        The pipeline for finding the top skills for the given experience.

        The pipeline consists of the following steps:
        1 Cluster the responsibilities into N clusters
        2. For each cluster
        2.1 Infer the occupations and associated skills
        2.2 Link responsibilities to the associated skills
        # 2.3 Rank the skills to get the top skills of the cluster
        3. Return the top skills of each cluster
        """
        llm_stats = []
        if len(responsibilities) == 0:
            self._logger.warning("No responsibilities found for experience title: '%s' and company: '%s'", experience_title, company_name)
            return ExperiencePipelineResponse(
                top_skills=[],
                llm_stats=llm_stats,
                cluster_results=[]
            )

            # 1 Cluster the responsibilities into N clusters
        cluster_tool_response = await self._cluster_responsibilities_tool.execute(responsibilities=responsibilities,
                                                                                  number_of_clusters=_NUMBER_OF_CLUSTERS)
        llm_stats.extend(cluster_tool_response.llm_stats)
        # 2. For each cluster
        # 2.1 Infer the occupations and associated skills
        # 2.2 Link responsibilities to the associated skills
        # 2.3 Rank the skills to get the top skills of the cluster
        tasks = []
        for cluster in cluster_tool_response.clusters_of_responsibilities:
            tasks.append(self.handle_cluster(responsibilities=cluster,
                                             experience_title=experience_title,
                                             company_name=company_name,
                                             country_of_interest=country_of_interest,
                                             work_type=work_type))

        cluster_results: list[ClusterPipelineResult] = await asyncio.gather(*tasks)
        # 3. Return the top skill of each cluster
        top_skills = []
        for cluster_result in cluster_results:
            # get the top skill of the cluster
            # if the skill is already in the top_skills then get the next one
            index = 0
            top_skill = cluster_result.ranked_skills[index]
            while ExperiencePipeline.skill_in_list(top_skill, top_skills) and index < len(cluster_result.ranked_skills) - 1:
                index += 1
                top_skill = cluster_result.ranked_skills[index]
            top_skills.append(top_skill)
            llm_stats.extend(cluster_result.llm_stats)

        return ExperiencePipelineResponse(
            top_skills=top_skills,
            llm_stats=llm_stats,
            cluster_results=cluster_results
        )

    @staticmethod
    def skill_in_list(skill: SkillEntity, skills: list[SkillEntity]) -> bool:
        for s in skills:
            if s.UUID == skill.UUID:
                return True
        return False

    async def handle_cluster(self,
                             responsibilities: list[str],
                             experience_title: str,
                             company_name: Optional[str],
                             country_of_interest: Country,
                             work_type: WorkType) -> ClusterPipelineResult:
        llm_stats = []
        # 2.1 Infer the occupations and associated skills

        inferred_occupations_response = await self._infer_occupations_tool.execute(experience_title=experience_title,
                                                                                   company=company_name,
                                                                                   work_type=work_type,
                                                                                   responsibilities=responsibilities,
                                                                                   country_of_interest=country_of_interest,
                                                                                   number_of_titles=_NUMBER_OF_OCCUPATION_ALT_TITLES,
                                                                                   top_k=_NUMBER_OF_OCCUPATIONS_PER_CLUSTER,
                                                                                   top_p=_NUMBER_OF_OCCUPATIONS_CANDIDATES_PER_CLUSTER
                                                                                   )
        llm_stats.extend(inferred_occupations_response.llm_stats)
        occupation_labels = [esco_occupation.occupation.preferredLabel for esco_occupation in inferred_occupations_response.esco_occupations]
        # 2.2 Link responsibilities to the associated skills
        top_skills_response = await self._skills_linking_tool.execute(
            job_titles=inferred_occupations_response.contextual_titles,
            esco_occupations=inferred_occupations_response.esco_occupations,
            responsibilities=responsibilities,
            only_essential=True,
            top_k=_NUMBER_OF_SKILLS_PER_CLUSTER,
            top_p=_NUMBER_OF_SKILL_CANDIDATES_PER_RESPONSIBILITY
        )
        top_skills = top_skills_response.top_skills
        llm_stats.extend(top_skills_response.llm_stats)
        top_skills_labels = [skill.preferredLabel for skill in top_skills]
        if self._logger.isEnabledFor(logging.INFO):
            self._logger.info("Top skills: %s based on inferred job titles: %s, linked occupations: %s for responsibilities : %s",
                              top_skills_labels,
                              json.dumps(inferred_occupations_response.contextual_titles),
                              json.dumps(occupation_labels),
                              json.dumps(responsibilities))
        # 2.3 Rank the skills to get the top skill of the cluster
        # TODO: Use RCA to rank the skills
        # For now, just return the unranked skills
        return ClusterPipelineResult(
            responsibilities=responsibilities,
            contextual_titles=inferred_occupations_response.contextual_titles,
            esco_occupations=inferred_occupations_response.esco_occupations,
            unranked_skills=top_skills.copy(),
            ranked_skills=top_skills.copy(),
            llm_stats=llm_stats
        )

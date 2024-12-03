import asyncio
import json
import logging
from logging import Logger
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.agent.agent_types import LLMStats
from app.agent.experience.work_type import WorkType
from app.agent.linking_and_ranking_pipeline.cluster_responsibilities_tool import ClusterResponsibilitiesTool
from .infer_occupation_tool import InferOccupationTool
from .pick_top_skills_tool import PickTopSkillsTool
from .skill_linking_tool import SkillLinkingTool
from app.vector_search.esco_entities import SkillEntity, OccupationSkillEntity
from app.vector_search.vector_search_dependencies import SearchServices
from ...app_config import ApplicationConfig
from ...countries import Country


class ExperiencePipelineConfig(BaseModel):
    number_of_clusters: int = 5
    """
    Default is 5
    
    The number of clusters to group the responsibilities. 
    Each cluster of responsibilities will contribute to N top skills (where N = number_of_top_skills_to_pick_per_cluster).
    """

    number_of_top_skills_to_pick_per_cluster: int = 1
    """
    Default is 1
    The number of top skills to pick for each cluster among the top skills candidates of the cluster.
    """

    top_skills_threshold: int = 7
    """
    Default is 7
    When scoring the top skills of each cluster, the top skills with a score lower than this threshold will be ignored.
    See PickTopSkillsTool for more details.
    """

    number_of_occupation_alt_titles: int = 5
    """
    Default is 5 
    The number of alternative titles to infer from the experience title, company, work type and responsibilities and country of interest
    Each alternative title will be linked to a set of occupations.
    """

    number_of_occupations_per_cluster: int = 15
    """
    Default is 15
    The number of The number of most relevant occupations chosen from all the occupation candidates that where linked to each alternative title.
    This is the number of occupations that will be used by the skill linking tool to find the top skills for each cluster. 
    """

    number_of_occupations_candidates_per_title: int = 30
    """
    Default is 30
    The number of occupation candidates to consider for each alternative title. 
    This refers to the number of occupations retrieved from the search service for each alternative title.
    """

    number_of_top_skills_candidates_per_cluster: int = 5
    """
    Default is 5
    The number of top skills candidates to return for each cluster.
    It also corresponds to the number of skills selected from each responsibility among all the skill candidates returned by the search service.
    """

    number_of_skill_candidates_per_responsibility: int = 15
    """
    Default is 15
    The number of skill candidates to consider for each responsibility.
    These are the number of skills that are retrieved from the search service for each responsibility.
    """

    only_essential_skills: bool = True
    """
    Default is True
    If True, only the essential skills will be considered when linking the responsibilities to the skills.
    This applies to the skills associated with esco occupations.
    """

    only_high_signal_skills: bool = True
    """
    Default is True
    If True, only skills with "high" signaling values will be considered when linking the responsibilities to the skills.
    This applies to the skills associated with icatus occupations.
    """

    ignore_occupations: bool = False
    """
    Default is False
    If True, the skills search will consider all the skills in the ESCO database and will not be limited 
    to the skills associated with the occupations found."
    """

    model_config = ConfigDict(
        extra="forbid"
    )

    @staticmethod
    def from_application_config(*,
                                application_config: ApplicationConfig,
                                logger: Logger) -> "ExperiencePipelineConfig":
        if application_config is None or application_config.experience_pipeline_config is None:
            logger.warning("No experience pipeline config found in the application config. Using default config.")
            return ExperiencePipelineConfig()

        # merge the application config with the default config
        try:
            return ExperiencePipelineConfig.model_validate(application_config.experience_pipeline_config)
        except Exception as e:
            logger.error("Falling back to the default experience pipeline config due to an error: %s", e)
            return ExperiencePipelineConfig()


class ClusterPipelineResult(BaseModel):
    responsibilities_cluster_name: str
    responsibilities: list[str]
    contextual_titles: list[str]
    esco_occupations: list[OccupationSkillEntity]
    skills: list[SkillEntity]
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
    def __init__(self, *, config: ExperiencePipelineConfig, search_services: SearchServices):
        self._config = config
        self._search_services = search_services
        self._cluster_responsibilities_tool = ClusterResponsibilitiesTool()
        self._infer_occupations_tool = InferOccupationTool(search_services.occupation_skill_search_service)
        self._skills_linking_tool = SkillLinkingTool(search_services.skill_search_service)
        self._top_skills_picker = PickTopSkillsTool()
        self._logger = logging.getLogger(__class__.__name__)
        if self._logger.isEnabledFor(logging.INFO):
            self._logger.info("ExperiencePipeline initialized with config: %s", config.model_dump_json())

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
                                                                                  number_of_clusters=self._config.number_of_clusters)
        if len(cluster_tool_response.clusters) == 0:
            self._logger.warning("No clusters found for experience title: '%s' and company: '%s'", experience_title, company_name)
            return ExperiencePipelineResponse(
                top_skills=[],
                llm_stats=llm_stats,
                cluster_results=[]
            )
        llm_stats.extend(cluster_tool_response.llm_stats)
        # 2. For each cluster
        # 2.1 Infer the occupations and associated skills
        # 2.2 Link responsibilities to the associated skills
        # 2.3 Rank the skills to get the top skills of the cluster
        tasks = []
        for cluster in cluster_tool_response.clusters:
            tasks.append(self.handle_cluster(
                config=self._config,
                responsibilities_cluster_name=cluster.cluster_name,
                responsibilities=cluster.responsibilities,
                experience_title=experience_title,
                company_name=company_name,
                country_of_interest=country_of_interest,
                work_type=work_type))

        cluster_results: list[ClusterPipelineResult] = await asyncio.gather(*tasks)
        # 3. Return the top skill of each cluster
        top_skills = []
        for cluster_result in cluster_results:
            # exclude the skills that have already been picked
            skills_to_consider = ExperiencePipeline._exclude_skills_from_list(top_skills, cluster_result.skills)
            if len(skills_to_consider) == 0:
                top_skills_labels = [skill.preferredLabel for skill in skills_to_consider]
                skills_to_rank_labels = [skill.preferredLabel for skill in cluster_result.skills]
                self._logger.warning("No skills to pick for"
                                     "\n  - responsibilities group: '%s'"
                                     "\n  - with responsibilities: %s"
                                     "\n  - job titles: %s"
                                     "\n  - skills to rank: %s"
                                     "\nAlready picked skills: %s",
                                     cluster_result.responsibilities_cluster_name,
                                     json.dumps(cluster_result.responsibilities, ensure_ascii=False),
                                     json.dumps(cluster_result.contextual_titles, ensure_ascii=False),
                                     json.dumps(skills_to_rank_labels, ensure_ascii=False),
                                     json.dumps(top_skills_labels, ensure_ascii=False)
                                     )

                continue

            # get the top skills of the cluster
            picker_result = await self._top_skills_picker.execute(
                job_titles=cluster_result.contextual_titles,
                responsibilities_group_name=cluster_result.responsibilities_cluster_name,
                responsibilities=cluster_result.responsibilities,
                skills_to_rank=skills_to_consider,
                top_k=self._config.number_of_top_skills_to_pick_per_cluster,
                threshold=self._config.top_skills_threshold,
            )
            if len(picker_result.picked_skills) == 0:
                skills_to_consider_labels = [skill.preferredLabel for skill in skills_to_consider]
                self._logger.error("No skills picked for"
                                   "\n  - responsibilities group: '%s'"
                                   "\n  - with responsibilities: %s"
                                   "\n  - job titles: %s"
                                   "\n  - skills to rank: %s"
                                   "\n  - threshold: %s",
                                   cluster_result.responsibilities_cluster_name,
                                   json.dumps(cluster_result.responsibilities, ensure_ascii=False),
                                   json.dumps(cluster_result.contextual_titles, ensure_ascii=False),
                                   json.dumps(skills_to_consider_labels, ensure_ascii=False),
                                   self._config.top_skills_threshold
                                   )

            top_skills.extend(picker_result.picked_skills)
            llm_stats.extend(cluster_result.llm_stats)
            llm_stats.extend(picker_result.llm_stats)

        return ExperiencePipelineResponse(
            top_skills=top_skills,
            llm_stats=llm_stats,
            cluster_results=cluster_results
        )

    @staticmethod
    def _exclude_skills_from_list(skills_to_exclude: list[SkillEntity], list_of_skills: list[SkillEntity]) -> list[SkillEntity]:
        if skills_to_exclude is None or len(skills_to_exclude) == 0:
            return list_of_skills

        included_skills = []
        for skill in list_of_skills:
            s = ExperiencePipeline._skill_in_list(skill, skills_to_exclude)
            if not s:
                included_skills.append(skill)
        return included_skills

    @staticmethod
    def _skill_in_list(skill: SkillEntity, skills: list[SkillEntity]) -> Optional[SkillEntity]:
        for s in skills:
            if s.UUID == skill.UUID:
                return s
        return None

    async def handle_cluster(self, *,
                             config: ExperiencePipelineConfig,
                             responsibilities_cluster_name: str,
                             responsibilities: list[str],
                             experience_title: str,
                             company_name: Optional[str],
                             country_of_interest: Country,
                             work_type: WorkType) -> ClusterPipelineResult:
        llm_stats = []
        # 2.1 Infer the occupations and associated skills

        if work_type == WorkType.UNSEEN_UNPAID:
            inferred_occupations_response = await self._infer_icatus_activities_tool.execute(
                                                                                    experience_title=experience_title,
                                                                                    company=company_name,
                                                                                    work_type=work_type,
                                                                                    responsibilities=responsibilities,
                                                                                    country_of_interest=country_of_interest,
                                                                                    number_of_titles=config.number_of_occupation_alt_titles,
                                                                                    top_k=config.number_of_occupations_per_cluster,
                                                                                    top_p=config.number_of_occupations_candidates_per_title
                                                                                    )
        else:
            inferred_occupations_response = await self._infer_occupations_tool.execute(experience_title=experience_title,
                                                                                    company=company_name,
                                                                                    work_type=work_type,
                                                                                    responsibilities=responsibilities,
                                                                                    country_of_interest=country_of_interest,
                                                                                    number_of_titles=config.number_of_occupation_alt_titles,
                                                                                    top_k=config.number_of_occupations_per_cluster,
                                                                                    top_p=config.number_of_occupations_candidates_per_title)
        llm_stats.extend(inferred_occupations_response.llm_stats)
        occupation_labels = [esco_occupation.occupation.preferredLabel for esco_occupation in inferred_occupations_response.esco_occupations]
        # 2.2 Link responsibilities to the associated skills
        top_skills_response = await self._skills_linking_tool.execute(
            job_titles=inferred_occupations_response.contextual_titles,
            occupation_skills_entities=inferred_occupations_response.esco_occupations,
            responsibilities=responsibilities,
            only_essential_skills=config.only_essential_skills,
            ignore_occupations=config.ignore_occupations,
            top_k=config.number_of_top_skills_candidates_per_cluster,
            top_p=config.number_of_skill_candidates_per_responsibility
        )
        top_skills = top_skills_response.top_skills
        llm_stats.extend(top_skills_response.llm_stats)
        top_skills_labels = [skill.preferredLabel for skill in top_skills]
        if self._logger.isEnabledFor(logging.INFO):
            self._logger.info("Skills_linking_tool for:"
                              "\n  - responsibilities group: %s "
                              "\n  - responsibilities: %s"
                              "\n  - job titles: %s"
                              "\n  - linked occupations: %s "
                              "\nreturned top skills: %s",
                              responsibilities_cluster_name,
                              json.dumps(responsibilities, ensure_ascii=False),
                              json.dumps(inferred_occupations_response.contextual_titles, ensure_ascii=False),
                              json.dumps(occupation_labels, ensure_ascii=False),
                              json.dumps(top_skills_labels, ensure_ascii=False)
                              )
        # 2.3 Rank the skills to get the top skill of the cluster
        # For now, return the unranked skills
        return ClusterPipelineResult(
            responsibilities_cluster_name=responsibilities_cluster_name,
            responsibilities=responsibilities,
            contextual_titles=inferred_occupations_response.contextual_titles,
            esco_occupations=inferred_occupations_response.esco_occupations,
            skills=top_skills,
            llm_stats=llm_stats
        )

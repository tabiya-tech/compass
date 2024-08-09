import json
import logging
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import ZERO_TEMPERATURE_GENERATION_CONFIG, LLMConfig, JSON_GENERATION_CONFIG


class ClusterResponsibilitiesLLMResponse(BaseModel):
    reasoning: Optional[str]
    clusters_of_responsibilities: list[list[str]]

    class Config:
        extra = "forbid"


class ClusterResponsibilitiesResponse(BaseModel):
    clusters_of_responsibilities: list[list[str]]
    llm_stats: list[LLMStats]

    class Config:
        extra = "forbid"


# You are an expert in clustering.
#        You will be given a list of responsibilities and a number of clusters,
#        you must cluster all the responsibilities based on their similarity into the exact given number of cluster.
#        Each cluster must have at least one responsibility, and each responsibility can belong to only one cluster,
#        and every responsibility must be in a cluster.

def _get_system_instructions():
    system_prompt_template = dedent("""\
        <System Instructions>
            You are an expert in clustering.
            You will be given a list of responsibilities and a specified number of clusters.
            Your task is to group the responsibilities into the exact number of clusters based on their similarities.
            Each cluster must contain at least one responsibility, and each responsibility can belong to only one cluster.
            Additionally, every responsibility must be included in a cluster.
        
            
            #Input Structure
            The input structure is composed of: 
            'Responsibilities' : A list of responsibilities 
            'Number of clusters': The number of clusters to return
            #JSON Output instructions
                Your response must always be a JSON object with the following schema:
                {
                    "reasoning": why the items are similar
                    "clusters_of_responsibilities": [[..., ...],[..., ...],...] an array of arrays of a json strings, 
                        the outer array represents the clusters and the inner array represents the responsibilities in the cluster     	    
                }
        </System Instructions>
        """)
    return system_prompt_template


def _get_prompt(responsibilities: list[str], number_of_clusters: int = 5):
    prompt_template = dedent("""\
                            <Input>
                            'Responsibilities': {responsibilities}
                            'Number of clusters': {number_of_clusters}
                            </Input>
                            """)
    # make json array from list of strings
    return replace_placeholders_with_indent(prompt_template,
                                            responsibilities=json.dumps(responsibilities),
                                            number_of_clusters=f"{number_of_clusters}")


class ClusterResponsibilitiesTool:
    def __init__(self):
        self._llm = GeminiGenerativeLLM(
            system_instructions=_get_system_instructions(),
            config=LLMConfig(generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG)
        )
        self._llm_caller: LLMCaller[ClusterResponsibilitiesLLMResponse] = LLMCaller[ClusterResponsibilitiesLLMResponse](
            model_response_type=ClusterResponsibilitiesLLMResponse)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def execute(
            self,
            *,
            responsibilities: list[str],
            number_of_clusters: int = 5
    ) -> ClusterResponsibilitiesResponse:
        """
        Cluster responsibilities into the given number of clusters based on their similarity.
        If the number of responsibilities is less than the requested number of clusters,
        then the clusters will be prefilled with one responsibility each, and the remaining clusters are filled with the result of the clustering algorithm
        that will be called with the number of clusters remaining
        """
        _responsibilities = [responsibility.lower() for responsibility in responsibilities]
        _number_of_clusters = number_of_clusters
        _prefilled_clusters = []
        if len(responsibilities) == 0:
            self._logger.debug("The list of responsibilities is empty.")
            # construct n empty clusters
            for _ in range(number_of_clusters):
                _prefilled_clusters.append([])
            return ClusterResponsibilitiesResponse(clusters_of_responsibilities=_prefilled_clusters, llm_stats=[])

        # Handle the case where the number of responsibilities is less than the requested number of clusters
        if len(_responsibilities) < number_of_clusters:
            self._logger.debug("The number of responsibilities is less than the requested number of clusters. Requested: %d, Number of responsibilities: %d",
                               number_of_clusters, len(_responsibilities))

            # while the number of responsibilities is less than the requested number of clusters
            # prefill the clusters with one responsibility each
            while len(_responsibilities) <= _number_of_clusters:
                _expand = [[responsibility] for responsibility in _responsibilities]
                _prefilled_clusters.extend(_expand)
                _number_of_clusters = number_of_clusters - len(_prefilled_clusters)

        llm_clusters = []
        llm_stats = []

        if _number_of_clusters == 1:
            # This should not happen, but if it does, return all the responsibilities as a single cluster
            llm_clusters = [_responsibilities]
        if _number_of_clusters > 1:  # We don't need to cluster if the number of clusters is 1
            # Call the LLM to cluster the responsibilities
            prompt = _get_prompt(_responsibilities, _number_of_clusters)
            llm_response, llm_stats = await self._llm_caller.call_llm(llm=self._llm, llm_input=prompt, logger=self._logger)
            # log a warning if the number of clusters returned is different from the requested number of clusters
            if len(llm_response.clusters_of_responsibilities) != _number_of_clusters:
                self._logger.warning(
                    "The number of clusters returned by the LLM is different from the requested number of clusters. Requested: %d, Returned: %d",
                    _number_of_clusters, len(llm_response.clusters_of_responsibilities))

            llm_clusters = llm_response.clusters_of_responsibilities
            # log a warning if all the responsibilities are not clustered
            clustered_responsibilities = []
            for cluster in llm_response.clusters_of_responsibilities:
                for responsibility in cluster:
                    clustered_responsibilities.append(responsibility.lower())
            if sorted(clustered_responsibilities) != sorted(_responsibilities):
                self._logger.warning("Not all responsibilities are clustered. The responsibilities that are not clustered are: %s",
                                     set(_responsibilities) - set(clustered_responsibilities))

        return ClusterResponsibilitiesResponse(
            clusters_of_responsibilities=_prefilled_clusters + llm_clusters,
            llm_stats=llm_stats
        )

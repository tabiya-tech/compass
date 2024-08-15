import json
import logging
from textwrap import dedent
from collections import Counter

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import ZERO_TEMPERATURE_GENERATION_CONFIG, LLMConfig, JSON_GENERATION_CONFIG


class Cluster(BaseModel):
    cluster_name: str
    responsibilities: list[str]

    class Config:
        extra = "forbid"


class ClusterResponsibilitiesLLMResponse(BaseModel):
    reasoning: str
    clusters: list[Cluster]

    class Config:
        extra = "forbid"


class ClusterResponsibilitiesResponse(BaseModel):
    clusters: list[Cluster]
    llm_stats: list[LLMStats]

    class Config:
        extra = "forbid"


def _get_system_instructions():
    system_prompt_template = dedent("""\
        <System Instructions>
            You are an expert in clustering.
            You will be given a list of responsibilities and a specified number of clusters.
            Your task is to group the responsibilities into the exact number of clusters based on their similarities. 
            Each cluster has a name that is representative to the responsibilities it contains.
            Each cluster must contain at least one responsibility.
            Each responsibility must belong to only one cluster, and every responsibility must be included in a cluster.
            
            #Input Structure
            The input structure is composed of: 
            'Responsibilities' : A list of responsibilities 
            'Number of clusters': The number of clusters to return
            #JSON Output instructions
                Your response must always be a JSON object with the following schema:
                {
                    "reasoning": why the items are similar
                    "clusters": the array of clusters, each cluster is a dictionary with the following schema:
                        [{ 
                            cluster_name: The name for the cluster, as JSON string
                            responsibilities: The responsibilities of the cluster, as an array of JSON strings
                        }] 
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
        _prefilled_clusters: list[Cluster] = []

        if len(responsibilities) == 0:
            self._logger.debug("The list of responsibilities is empty.")
            # construct n empty clusters
            for _ in range(number_of_clusters):
                _prefilled_clusters.append(Cluster(cluster_name="Empty", responsibilities=[]))
            return ClusterResponsibilitiesResponse(clusters=_prefilled_clusters, llm_stats=[])

        # Handle the case where the number of responsibilities is less than the requested number of clusters
        if len(_responsibilities) < number_of_clusters:
            self._logger.debug("The number of responsibilities is less than the requested number of clusters. Requested: %d, Number of responsibilities: %d",
                               number_of_clusters, len(_responsibilities))

            # while the number of responsibilities is less than the requested number of clusters
            # prefill the clusters with one responsibility each
            _index: int = 0
            while len(_responsibilities) <= _number_of_clusters:
                for responsibility in _responsibilities:
                    _cluster = Cluster(cluster_name=f"Cluster {_index}", responsibilities=[responsibility])
                    _prefilled_clusters.append(_cluster)
                    _number_of_clusters = _number_of_clusters - 1
                    _index += 1

        llm_clusters = []
        llm_stats = []

        if _number_of_clusters == 1:
            # Return all the responsibilities as a single cluster
            # This edge case is handled separately to avoid calling the LLM
            # It happens when there are K even responsibilities and the number of clusters is a multiple of K, + 1
            _prefilled_clusters.append(Cluster(cluster_name=f"Cluster {number_of_clusters - 1}", responsibilities=_responsibilities))
        if _number_of_clusters > 1:  # We don't need to cluster if the number of clusters is 1
            # Call the LLM to cluster the responsibilities
            prompt = _get_prompt(_responsibilities, _number_of_clusters)
            llm_response, llm_stats = await self._llm_caller.call_llm(llm=self._llm, llm_input=prompt, logger=self._logger)
            if self._logger.isEnabledFor(logging.INFO):
                self._logger.info("LLM Response: %s", llm_response)
            # log a warning if the number of clusters returned is different from the requested number of clusters
            if len(llm_response.clusters) != _number_of_clusters:
                self._logger.warning(
                    "The number of clusters returned by the LLM is different from the requested number of clusters. Requested: %d, Returned: %d",
                    _number_of_clusters, len(llm_response.clusters))

            llm_clusters = llm_response.clusters
            # log a warning if all the responsibilities are not clustered
            clustered_responsibilities = []
            for cluster in llm_response.clusters:
                for responsibility in cluster.responsibilities:
                    clustered_responsibilities.append(responsibility.lower())
            counter_responsibilities = Counter(_responsibilities)
            counter_clustered_responsibilities = Counter(clustered_responsibilities)
            only_in_responsibilities = counter_responsibilities - counter_clustered_responsibilities
            if len(only_in_responsibilities) > 0:
                self._logger.warning("Not all responsibilities are clustered. The responsibilities that are not clustered are: %s",
                                     list(only_in_responsibilities.elements()))

            for cnt in counter_clustered_responsibilities.items():
                if cnt[1] > 1:
                    self._logger.warning("Responsibility '%s' is clustered more than once", cnt[0])

        clusters = _prefilled_clusters + llm_clusters
        if self._logger.isEnabledFor(logging.INFO):
            self._logger.info("Clustered responsibilities into the following clusters: %s", clusters)

        return ClusterResponsibilitiesResponse(
            clusters=clusters,
            llm_stats=llm_stats
        )

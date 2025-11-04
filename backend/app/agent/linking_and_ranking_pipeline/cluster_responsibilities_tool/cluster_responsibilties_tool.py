import json
import logging
from textwrap import dedent
from collections import Counter

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.penalty import get_penalty, get_penalty_for_multiple_errors
from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE, STD_AGENT_CHARACTER
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, get_config_variation
from common_libs.retry import Retry


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
            The more similar the responsibilities are, the more likely they are to be in the same cluster.
            The more different the responsibilities are, the more likely they are to be in different clusters.
            The clusters should be as balanced as possible, meaning that the number of responsibilities in each cluster should be similar if possible.
            Each cluster must have a name that is representative of the responsibilities it contains.
            Each cluster must contain at least one responsibility.
            Each responsibility must belong to only one cluster, and every responsibility must be included in a cluster.
            
            # Input Structure
            The input structure is composed of: 
            'Responsibilities': A list of responsibilities 
            'Number of Clusters': The number of clusters to return
            # JSON Output Instructions
                Your response must always be a JSON object with the following schema:
                {
                    "reasoning": The detailed, step-by-step explanation of why the responsibilities are similar and clustered together, as JSON string,
                    "clusters": The array of clusters, each cluster is a dictionary with the following schema:
                        [{ 
                            "cluster_name": The name for the cluster, as JSON string,
                            "responsibilities": The responsibilities of the cluster, as an array of JSON strings
                        }] 
                }
        </System Instructions>
        """)
    return system_prompt_template


def _get_prompt(responsibilities: list[str], number_of_clusters: int = 5):
    prompt_template = dedent("""\
                            <Input>
                            'Responsibilities': {responsibilities}
                            'Number of Clusters': {number_of_clusters}
                            </Input>
                            """)
    # make json array from list of strings
    return replace_placeholders_with_indent(prompt_template,
                                            responsibilities=json.dumps(responsibilities),
                                            number_of_clusters=f"{number_of_clusters}")


def _get_llm(temperature_config: dict) -> GeminiGenerativeLLM:
    """
    Get the LLM to use for clustering.
    As we do not know how the ClusterResponsibilitiesTool will be used in the async context,
    and to any avoid race conditions, we create a new LLM instance for each call.
    """
    return GeminiGenerativeLLM(
        system_instructions=_get_system_instructions(),
        config=LLMConfig(generation_config=temperature_config | JSON_GENERATION_CONFIG)
    )


class ClusterResponsibilitiesTool:
    def __init__(self):
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
        Group the responsibilities into the specified number of clusters based on similarity.
        If there are fewer responsibilities than the requested number of clusters, assign one responsibility to each cluster first.
        Then, use the clustering algorithm to fill the remaining clusters with the leftover responsibilities.
        The LLM will be called using a retry mechanism that makes the best effort to return a valid result.
        A penalty is applied if the responsibilities are not clustered correctly.
        After the maximum number of retries is reached, the function will return the response with the lowest penalty (i.e., the highest quality).
        """
        _responsibilities = _normalize_responsibilities(responsibilities, logger=self._logger)

        async def _callback(attempt: int, max_retries: int) -> tuple[ClusterResponsibilitiesResponse, float, BaseException | None]:
            # Call the LLM to cluster the responsibilities
            # Add some temperature and top_p variation to prompt the LLM to return different results on each retry.
            # Exponentially increase the temperature and top_p to avoid the LLM to return the same result every time.
            temperature_config = get_config_variation(start_temperature=0.0, end_temperature=1,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)
            llm = _get_llm(temperature_config=temperature_config)
            self._logger.debug("Calling LLM with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])
            return await self._internal_execute(llm=llm, responsibilities=_responsibilities, number_of_clusters=number_of_clusters)

        result, _result_penalty, _error = await Retry[ClusterResponsibilitiesResponse].call_with_penalty(callback=_callback, logger=self._logger)
        return result

    async def _internal_execute(
            self,
            *,
            llm: GeminiGenerativeLLM,
            responsibilities: list[str],
            number_of_clusters: int = 5
    ) -> tuple[ClusterResponsibilitiesResponse, float, BaseException | None]:
        # Penalty levels, the higher the level, the more severe the penalty
        no_llm_output_penalty_level = 3
        number_of_clusters_mismatch_penalty_level = 2
        responsibilities_not_clustered_penalty_level = 1
        responsibilities_clustered_more_than_once_penalty_level = 0

        _number_of_clusters = number_of_clusters
        _prefilled_clusters: list[Cluster] = []

        if len(responsibilities) == 0:
            self._logger.warning("The list of responsibilities is empty.")
            # construct n empty clusters
            return ClusterResponsibilitiesResponse(clusters=[], llm_stats=[]), 0, None

        # Handle the case where the number of responsibilities is less than the requested number of clusters
        if len(responsibilities) <= number_of_clusters:
            self._logger.debug(
                "The number of responsibilities is less or equal to the requested number of clusters. Requested: %d, Number of responsibilities: %d",
                number_of_clusters, len(responsibilities))

            # while the number of responsibilities is less than the requested number of clusters
            # prefill the clusters with one responsibility each
            _index: int = 0
            while len(responsibilities) <= _number_of_clusters:
                for responsibility in responsibilities:
                    _cluster = Cluster(cluster_name=f"Cluster {_index}", responsibilities=[responsibility])
                    _prefilled_clusters.append(_cluster)
                    _number_of_clusters = _number_of_clusters - 1
                    _index += 1

        llm_clusters = []
        llm_stats = []
        errors: list[Exception] = []
        result_penalty: float = 0.0
        if _number_of_clusters == 1:
            # Return all the responsibilities as a single cluster
            # This edge case is handled separately to avoid calling the LLM
            # It happens when there are K even responsibilities and the number of clusters is a multiple of K, + 1
            _prefilled_clusters.append(Cluster(cluster_name=f"Cluster {number_of_clusters - 1}", responsibilities=responsibilities))
        if _number_of_clusters > 1:  # We don't need to cluster if the number of clusters is 1
            # Call the LLM to cluster the responsibilities
            prompt = _get_prompt(responsibilities, _number_of_clusters)
            llm_response, llm_stats = await self._llm_caller.call_llm(llm=llm, llm_input=prompt, logger=self._logger)
            if not llm_response:
                # This may happen if the LLM fails to return a JSON object
                # Instead of completely failing, we log a warning and return the input responsibilities in each of the requested clusters
                penalty = get_penalty(no_llm_output_penalty_level)
                self._logger.warning(f"The LLM did not return any output and all the responsibilities will be returned in each cluster."
                                     f"\n  - Penalty incurred: {penalty}."
                                     f"\n  - Updated total penalty: {penalty}.")
                return (
                    ClusterResponsibilitiesResponse(
                        clusters=[Cluster(cluster_name=f"Cluster {i}", responsibilities=responsibilities) for i in range(_number_of_clusters)],
                        llm_stats=llm_stats),
                    penalty,
                    ValueError("The LLM did not return any output and all the responsibilities will be returned in each cluster.")
                )

            if self._logger.isEnabledFor(logging.INFO):
                self._logger.info("LLM Response:\n%s", llm_response.model_dump_json(indent=2))
            # log a warning if the number of clusters returned is different from the requested number of clusters
            if len(llm_response.clusters) != _number_of_clusters:
                errors.append(ValueError("The number of clusters returned by the LLM is different from the requested number of clusters"))
                penalty = get_penalty_for_multiple_errors(
                    level=number_of_clusters_mismatch_penalty_level,
                    # use abs as the number of clusters can more than the requested number of clusters
                    actual_errors_counted=abs(_number_of_clusters - len(llm_response.clusters)),
                    # the number of clusters is the maximum number of errors expected
                    # if the number of errors is more than the number of requested of clusters
                    # the penalty function will cap the penalty to the maximum number of errors expected
                    max_number_of_errors_expected=_number_of_clusters
                )
                result_penalty += penalty
                self._logger.warning(
                    f"The number of clusters returned by the LLM is different from the requested number of clusters."
                    f"\n  - Requested: {_number_of_clusters}, Returned: {len(llm_response.clusters)}."
                    f"\n  - Penalty incurred: {penalty}."
                    f"\n  - Updated total penalty: {result_penalty}."
                )

            llm_clusters, clustered_responsibilities = _filter_empty_clusters_and_responsibilities(llm_response.clusters)
            # log a warning if all the responsibilities are not clustered
            counter_responsibilities = Counter(responsibilities)
            counter_clustered_responsibilities = Counter(clustered_responsibilities)
            only_in_responsibilities = counter_responsibilities - counter_clustered_responsibilities
            if len(only_in_responsibilities) > 0:
                self._logger.warning("Not all responsibilities are clustered. The responsibilities that are not clustered are: %s",
                                     list(only_in_responsibilities.elements()))
                errors.append(ValueError("Not all responsibilities are clustered"))
                penalty = get_penalty_for_multiple_errors(
                    level=responsibilities_not_clustered_penalty_level,
                    actual_errors_counted=len(only_in_responsibilities),
                    max_number_of_errors_expected=len(responsibilities)
                )
                result_penalty += penalty
                self._logger.warning(
                    f"{len(only_in_responsibilities)} responsibilities are not clustered."
                    f"\n  - Penalty incurred: {penalty}."
                    f"\n  - Updated total penalty: {result_penalty}."
                )

            clustered_more_than_once = 0
            for cnt in counter_clustered_responsibilities.items():
                if cnt[1] > 1:
                    self._logger.warning("Responsibility '%s' is clustered more than once", cnt[0])
                    clustered_more_than_once = clustered_more_than_once + 1
            if clustered_more_than_once > 0:
                penalty = get_penalty_for_multiple_errors(
                    level=responsibilities_clustered_more_than_once_penalty_level,
                    actual_errors_counted=clustered_more_than_once,
                    max_number_of_errors_expected=len(responsibilities)
                )
                result_penalty += penalty
                self._logger.warning(
                    f"{clustered_more_than_once} responsibilities have been clustered more than once."
                    f"\n  - Penalty incurred: {penalty}."
                    f"\n  - Updated total penalty: {result_penalty}."
                )
                errors.append(ValueError(f"{clustered_more_than_once} responsibilities have been clustered more than once."))

        _prefilled_clusters, _ = _filter_empty_clusters_and_responsibilities(_prefilled_clusters)
        clusters = _prefilled_clusters + llm_clusters
        if self._logger.isEnabledFor(logging.INFO):
            self._logger.info("Clustered responsibilities into the following clusters: %s", clusters)

        _return_error = None
        if errors:
            if len(errors) > 1:
                _return_error = ExceptionGroup("Multiple errors occurred", errors)
            else:
                _return_error = errors[0]

        return ClusterResponsibilitiesResponse(
            clusters=clusters,
            llm_stats=llm_stats
        ), result_penalty, _return_error


def _normalize_responsibilities(responsibilities: list[str], logger: logging.Logger):
    """
    Normalize a list of responsibilities:
    - Strip whitespace
    - Convert to lowercase
    - Remove duplicates (after cleaning)
    - Warn on empty or duplicate entries

    Args:
        responsibilities (list of str): The raw responsibilities.
        logger (optional): Logger object with .warning() method. Falls back to print if None.

    Returns:
        list of str: Unique, cleaned responsibilities in original order.
    """

    seen = set()
    result = []
    warnings = []
    for original in responsibilities:
        stripped = original.strip()
        if not stripped:
            warnings.append("Empty responsibility detected")
            continue

        cleaned = stripped.lower()
        if cleaned in seen:
            warnings.append(f"Duplicate responsibility detected (after normalization): '{original}' -> '{cleaned}'")
            continue

        seen.add(cleaned)
        result.append(cleaned)

    if warnings:
        logger.warning(warnings)

    return result


def _filter_empty_clusters_and_responsibilities(clusters: list[Cluster]) -> tuple[list[Cluster], list[str]]:
    """
    Filter out the empty clusters and empty responsibilities and log warnings if there are any empty clusters or responsibilities
    Return the filtered clusters and all the responsibilities that were added to the clusters
    """
    _filtered_clusters = []
    _all_responsibilities = []
    for cluster in clusters:
        _filtered_responsibilities = []
        for responsibility in cluster.responsibilities:
            _responsibility_stripped = responsibility.strip()
            if _responsibility_stripped:
                _all_responsibilities.append(_responsibility_stripped)
                _filtered_responsibilities.append(_responsibility_stripped)
            else:
                logging.getLogger().warning("Empty responsibility in cluster '%s'", cluster.cluster_name)
        if len(_filtered_responsibilities) > 0:
            _filtered_clusters.append(Cluster(cluster_name=cluster.cluster_name, responsibilities=_filtered_responsibilities))
        else:
            logging.getLogger().warning("Empty cluster '%s'", cluster.cluster_name)
    return _filtered_clusters, _all_responsibilities

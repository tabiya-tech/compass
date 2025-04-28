import json
import logging

import pytest
from _pytest.logging import LogCaptureFixture

from app.agent.linking_and_ranking_pipeline.cluster_responsibilities_tool.cluster_responsibilties_tool import ClusterResponsibilitiesTool, Cluster
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class ClusterResponsibilitiesToolTestCase(CompassTestCase):
    given_responsibilities: list[str]
    given_number_of_clusters: int = 5
    expected_clusters: list[Cluster]


test_cases = [
    ClusterResponsibilitiesToolTestCase(
        name="responsibilities with single ' quote",
        given_responsibilities=["i'm working", "i'm eating", "i'm sleeping"],
        given_number_of_clusters=5,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["i'm working"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["i'm eating"]),
            Cluster(cluster_name="Cluster 2", responsibilities=["i'm sleeping"]),
            Cluster(cluster_name="Cluster 3", responsibilities=["i'm eating", "i'm sleeping"]),
            Cluster(cluster_name="Cluster 4", responsibilities=["i'm working"])
        ],
        expect_warnings_in_logs=True
    ),
    ClusterResponsibilitiesToolTestCase(
        name="less that five responsibilities (work, eat, sleep)",
        given_responsibilities=["i work", "i eat", "i sleep"],
        given_number_of_clusters=5,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["i eat"]),
            Cluster(cluster_name="Cluster 2", responsibilities=["i sleep"]),
            Cluster(cluster_name="Cluster 3", responsibilities=["i eat", "i sleep"]),
            Cluster(cluster_name="Cluster 4", responsibilities=["i work"])
        ],
        expect_warnings_in_logs=True
    ),
    ClusterResponsibilitiesToolTestCase(
        name="num of clusters equal to resp. count",
        given_responsibilities=["i work", "i eat"],
        given_number_of_clusters=2,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["i eat"])
        ],
        expect_warnings_in_logs=True
    ),
    ClusterResponsibilitiesToolTestCase(
        name="less that five responsibilities (drink, eat, sleep)",
        given_responsibilities=["i drink", "i eat", "i sleep"],
        given_number_of_clusters=5,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["i drink"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["i eat"]),
            Cluster(cluster_name="Cluster 2", responsibilities=["i sleep"]),
            Cluster(cluster_name="Cluster 3", responsibilities=["i eat", "i drink"]),
            Cluster(cluster_name="Cluster 4", responsibilities=["i sleep"])
        ],
        expect_warnings_in_logs=True
    ),
    ClusterResponsibilitiesToolTestCase(
        name="num of clusters is multiple of resp. count",
        given_responsibilities=["i work", "i eat"],
        given_number_of_clusters=6,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["i eat"]),
            Cluster(cluster_name="Cluster 2", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 3", responsibilities=["i eat"]),
            Cluster(cluster_name="Cluster 2", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 3", responsibilities=["i eat"])
        ],
        expect_warnings_in_logs=True
    ),
    ClusterResponsibilitiesToolTestCase(
        name="one responsibility (work work work ...)",
        given_responsibilities=["i work"],
        given_number_of_clusters=5,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 2", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 3", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 4", responsibilities=["i work"])
        ],
        expect_warnings_in_logs=True
    ),
    ClusterResponsibilitiesToolTestCase(
        name="empty responsibilities",
        given_responsibilities=["i work", "i eat", ""],
        given_number_of_clusters=2,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["i eat"]),
        ],
        expect_warnings_in_logs=True
    ),
    ClusterResponsibilitiesToolTestCase(
        name="duplicate responsibilities",
        given_responsibilities=["i work", "i work", "i work", "i work", "i work", "i work", "i work", "i work"],
        given_number_of_clusters=2,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["i work"]),
        ],
        expect_warnings_in_logs=True
    ),
    ClusterResponsibilitiesToolTestCase(
        name="no responsibilities",
        given_responsibilities=[],
        given_number_of_clusters=5,
        expected_clusters=[],
        expect_warnings_in_logs=True
    ),
    ClusterResponsibilitiesToolTestCase(
        name="similar responsibilities (may fail to cluster)",
        given_responsibilities=["I work hard", "I work much", "I work diligently", "I work tirelessly", "I work consistently", "I work with dedication",
                                "I work with focus", "I work with purpose", "I work relentlessly", "I work with discipline", "I work with determination",
                                "I work day and night", "I work to the best of my ability", "I work with everything I’ve got", "I work until the job is done",
                                "I work smart and hard", "I work with passion", "I work around the clock", "I work without excuses",
                                "I work through challenges", "I work under pressure", "I work until I succeed", "I work with grit", "I work with intention",
                                "I work for results", "I work with resilience", "I work to improve every day", "I work with persistence",
                                "I work through setbacks", "I work with a clear goal", "I work to exceed expectations", "I work with a strong mindset",
                                "I work to make an impact", "I work beyond limits", "I work with unwavering focus", "I work with accountability",
                                "I work to master my craft", "I work with vision", "I work with precision", "I work until I’m proud",
                                "I work with full commitment", "I work to grow daily", "I work with fierce determination", "I work through the noise",
                                "I work with humility", "I work for excellence", "I work to be better than yesterday", "I work with courage",
                                "I work to inspire others", "I work with strategic intent", "I work with consistency and heart", "I work to build momentum",
                                "I work with clarity", "I work beyond expectations", "I work to break barriers", "I work with sharp focus",
                                "I work with energy and drive", "I work in pursuit of greatness", "I work for long-term success", "I work to be unstoppable",
                                "I work with intention and direction", "I work to push my limits", "I work with adaptability", "I work to overcome fear",
                                "I work to stay disciplined", "I work with mindful action", "I work to honor my potential"
                                ],
        given_number_of_clusters=2,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=[]),
            Cluster(cluster_name="Cluster 1", responsibilities=[]),
        ],
        expect_warnings_in_logs=True  # Expecting warnings in logs due to the large number of similar responsibilities
    ),

    ClusterResponsibilitiesToolTestCase(
        name="Baker's broader responsibilities",
        given_responsibilities=["i bake", "i advise customers", "I fire up the oven",
                                "I clean", "I am on time", "I mix ingredients", "I sell the bread",
                                "I buy supplies", "I order ingredients"],
        given_number_of_clusters=5,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["i bake", "I fire up the oven", "I mix ingredients"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["I clean"]),
            Cluster(cluster_name="Cluster 2", responsibilities=["I am on time"]),
            Cluster(cluster_name="Cluster 3", responsibilities=["i advise customers", "I sell the bread"]),
            Cluster(cluster_name="Cluster 4", responsibilities=["I buy supplies", "I order ingredients"])
        ],
        expect_warnings_in_logs=True
    ),
    ClusterResponsibilitiesToolTestCase(
        name="GDE Brigade member responsibilities",
        given_responsibilities=["I make sure everyone follows the Covid-19 rules.",
                                "I keep an eye on the kids to make sure they stay apart from each other.",
                                "I check and record temperatures ",
                                "I record health symptoms",
                                "I clean teachers, and students.",
                                "I disinfect visitors",
                                "I put together weekly and monthly reports.",
                                "I make sure everyone is safe",
                                "I do night patrols",
                                "I secure the building", "I check the id of visitors"
                                ],
        given_number_of_clusters=5,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["I make sure everyone follows the Covid-19 rules.",
                                                                "I keep an eye on the kids to make sure they stay apart from each other.",
                                                                "I check and record temperatures ",
                                                                "I record health symptoms"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["I clean teachers, and students.",
                                                                "I disinfect visitors"]),
            Cluster(cluster_name="Cluster 2", responsibilities=["I put together weekly and monthly reports."]),
            Cluster(cluster_name="Cluster 3", responsibilities=["I do night patrols",
                                                                "I secure the building",
                                                                "I check the id of visitors"]),
            Cluster(cluster_name="Cluster 4", responsibilities=["i keep an eye on the kids to make sure they stay apart from each other.",
                                                                "i make sure everyone is safe"])
        ],
        expect_warnings_in_logs=True)
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_cluster_responsibilities_tool(test_case: ClusterResponsibilitiesToolTestCase, caplog: LogCaptureFixture):
    cluster_responsibilities_tool = ClusterResponsibilitiesTool()

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.INFO):
        # Guards to ensure that the loggers are correctly setup,
        guard_caplog(logger=cluster_responsibilities_tool._logger, caplog=caplog)

        # GIVEN the responsibilities and the number of clusters
        # random.shuffle(test_case.given_responsibilities) # Shuffle the responsibilities to ensure that the order does not matter
        # WHEN the cluster responsibilities llm is called with the given responsibilities and number of clusters
        actual_result = await cluster_responsibilities_tool.execute(
            responsibilities=test_case.given_responsibilities,
            number_of_clusters=test_case.given_number_of_clusters
        )
        # THEN the result should contain the expected clusters
        # Check that the actual clusters are the same as the expected clusters
        # The order of the clusters and the order of the responsibilities in the clusters does not matter
        # Build a list of lists of responsibilities for each cluster

        if not expected_clusters_are_empty(test_case.expected_clusters):

            actual_lists_of_responsibilities = [[responsibility for responsibility in cluster.responsibilities] for cluster in
                                                actual_result.clusters]
            expected_lists_of_responsibilities = [[responsibility for responsibility in cluster.responsibilities] for cluster in test_case.expected_clusters]

            assert lists_to_json(actual_lists_of_responsibilities) == lists_to_json(expected_lists_of_responsibilities), \
                "Expected clusters do not match actual clusters."
        else:
            # When the expected clusters are empty, we will not check how the responsibilities are clustered
            # We will just check that the number of clusters is the same, with a custom error message
            assert len(actual_result.clusters) == len(test_case.expected_clusters), \
                "Number of clusters do not match. "

        # AND the logs should not contain any errors or warnings (depending on the test case)
        assert_log_error_warnings(caplog=caplog,
                                  expect_errors_in_logs=test_case.expect_errors_in_logs,
                                  expect_warnings_in_logs=test_case.expect_warnings_in_logs)


def expected_clusters_are_empty(clusters: list[Cluster]):
    """
    Check if the expected clusters are empty.
    :param clusters: list[Cluster] - The list of clusters to check.
    :return: bool - True if the expected clusters are empty, False otherwise.
    """
    return len(clusters) == 0 or all(len(cluster.responsibilities) == 0 for cluster in clusters)


def sort_list_of_lists(lst):
    # change the case of the strings to lowercase
    lst = [[s.lower() for s in sub_list] for sub_list in lst]
    # Sort each sub-list and then sort the list of these sorted sub-lists
    return sorted([sorted(sub_list) for sub_list in lst], key=lambda x: (len(x), x))


def lists_to_json(lst):
    sorted_list = sort_list_of_lists(lst)
    return json.dumps(sorted_list, sort_keys=True)

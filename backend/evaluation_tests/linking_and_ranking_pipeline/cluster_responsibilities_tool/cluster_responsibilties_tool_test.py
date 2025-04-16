import json
import logging

import pytest
from _pytest.logging import LogCaptureFixture

from app.agent.linking_and_ranking_pipeline.cluster_responsibilities_tool.cluster_responsibilties_tool import ClusterResponsibilitiesTool, Cluster
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
        ]
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
        ]
    ),
    ClusterResponsibilitiesToolTestCase(
        name="num of clusters equal to resp. count",
        given_responsibilities=["i work", "i eat"],
        given_number_of_clusters=2,
        expected_clusters=[
            Cluster(cluster_name="Cluster 0", responsibilities=["i work"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["i eat"])
        ]
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
        ]
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
        ]
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
        ]
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
        name="no responsibilities",
        given_responsibilities=[],
        given_number_of_clusters=5,
        expected_clusters=[],
        expect_warnings_in_logs=True
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
        ]
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
                                                                "I record health symptoms",
                                                                "I make sure everyone is safe"]),
            Cluster(cluster_name="Cluster 1", responsibilities=["I clean teachers, and students.",
                                                                "I disinfect visitors"]),
            Cluster(cluster_name="Cluster 2", responsibilities=["I put together weekly and monthly reports."]),
            Cluster(cluster_name="Cluster 3", responsibilities=["I do night patrols",
                                                                "I secure the building"]),
            Cluster(cluster_name="Cluster 4", responsibilities=["I check the id of visitors"])
        ])
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_cluster_responsibilities_tool(test_case: ClusterResponsibilitiesToolTestCase, caplog: LogCaptureFixture):
    cluster_responsibilities_tool = ClusterResponsibilitiesTool()
    session_id = hash(test_case.name) % 10 ** 10

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.DEBUG):
        # Guards to ensure that the loggers are correctly setup,
        # otherwise the tests cannot be trusted that they correctly assert the absence of errors and warnings.
        guard_warning_msg = logging.getLevelName(logging.WARNING) + str(session_id)  # some random string
        cluster_responsibilities_tool._logger.warning(guard_warning_msg)
        assert guard_warning_msg in caplog.text
        guard_error_msg = logging.getLevelName(logging.ERROR) + str(session_id)  # some random string
        cluster_responsibilities_tool._logger.warning(guard_error_msg)
        assert guard_error_msg in caplog.text
        caplog.records.clear()

        # GIVEN the responsibilities and the number of clusters

        # WHEN the cluster responsibilities llm is called with the given responsibilities and number of clusters
        actual_result = await cluster_responsibilities_tool.execute(
            responsibilities=test_case.given_responsibilities,
            number_of_clusters=test_case.given_number_of_clusters
        )
        # THEN the result should contain the expected clusters
        # Check that the actual clusters are the same as the expected clusters
        # The order of the clusters and the order of the responsibilities in the clusters does not matter
        # Build a list of lists of responsibilities for each cluster
        actual_lists_of_responsibilities = [[responsibility for responsibility in cluster.responsibilities] for cluster in
                                            actual_result.clusters]
        expected_lists_of_responsibilities = [[responsibility for responsibility in cluster.responsibilities] for cluster in test_case.expected_clusters]

        assert lists_to_json(actual_lists_of_responsibilities) == lists_to_json(expected_lists_of_responsibilities)

        # Check that no errors and no warning were logged
        for record in caplog.records:
            if not test_case.expect_errors_in_logs:
                assert record.levelname != 'ERROR'
            if not test_case.expect_warnings_in_logs:
                assert record.levelname != 'WARNING'


def sort_list_of_lists(lst):
    # change the case of the strings to lowercase
    lst = [[s.lower() for s in sub_list] for sub_list in lst]
    # Sort each sub-list and then sort the list of these sorted sub-lists
    return sorted([sorted(sub_list) for sub_list in lst], key=lambda x: (len(x), x))


def lists_to_json(lst):
    sorted_list = sort_list_of_lists(lst)
    return json.dumps(sorted_list, sort_keys=True)

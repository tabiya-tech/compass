import logging
from typing import Literal, Optional

import pytest
from pydantic import BaseModel, ConfigDict

from app.agent.experience import WorkType, ExperienceEntity
from evaluation_tests.experiences_discovered_evaluator import ExperiencesDiscoveredEvaluator
from evaluation_tests.matcher import check_actual_data_matches_expected


class DiscoveredExperienceTestCase(BaseModel):
    expected_experiences_count_min: int
    """
    The minimum number of experiences that should be found.
    """

    expected_experiences_count_max: int
    """
    The maximum number of experiences that should be found.
    """

    expected_work_types: dict[WorkType, tuple[int, int]] = {}
    """
    The minimum and maximum number of experiences that should be found for each work type.
    """

    matchers: list[Literal["llm", "matcher"]] = ["llm", "matcher"]
    """
    The matchers to use for the test.
    """

    expected_experience_data: Optional[list[dict]] = None
    """
    The expected experience data collected.
    Optionally assert how the llm should update the collected data.
    If not provided, the test will not assert on the collected data.
    """

    model_config = ConfigDict(extra="forbid")

    async def check_expectations(self, actual_experiences: list[ExperienceEntity]) -> list[str]:
        failures: list[str] = []

        # Check if the actual discovered experiences match the expected ones
        _passed_expected_experiences_count = True
        if len(actual_experiences) < self.expected_experiences_count_min:
            _passed_expected_experiences_count = False
            failures.append(
                f"Expected at least {self.expected_experiences_count_min} experiences, but got {len(actual_experiences)}"
            )
        if len(actual_experiences) > self.expected_experiences_count_max:
            _passed_expected_experiences_count = False
            failures.append(
                f"Expected at most {self.expected_experiences_count_max} experiences, but got {len(actual_experiences)}"
            )
        if _passed_expected_experiences_count:
            logging.info(
                f"Got {len(actual_experiences)} experiences, "
                f"which is within the expected range ({self.expected_experiences_count_min}, {self.expected_experiences_count_max})")

        # assert that the experiences are in the expected work types test_case.expected_minimum_work_types
        # build a dictionary with the work types and their counts
        actual_work_types_count = {}
        for experience in actual_experiences:
            work_type = experience.work_type
            if work_type in actual_work_types_count:
                actual_work_types_count[work_type] += 1
            else:
                actual_work_types_count[work_type] = 1
        evaluator = ExperiencesDiscoveredEvaluator()

        # check that the actual work types are in the expected work types
        for expected_work_type, expected_min_max_count in self.expected_work_types.items():
            expected_minimum_count = expected_min_max_count[0]
            expected_maximum_count = expected_min_max_count[1]
            actual_work_type_count = actual_work_types_count.pop(expected_work_type, 0)  # remove the work type from the dict
            _passed_expected_range = True
            if actual_work_type_count < expected_minimum_count:
                _passed_expected_range = False
                failures.append(
                    f"Expected at least {expected_minimum_count} experiences of type {expected_work_type}, but got {actual_work_type_count}"
                )
            if actual_work_type_count > expected_maximum_count:
                _passed_expected_range = False
                failures.append(
                    f"Expected at most {expected_maximum_count} experiences of type {expected_work_type}, but got {actual_work_type_count}"
                )
            if _passed_expected_range:
                logging.info(
                    f"Got {actual_work_type_count} experiences of type {expected_work_type}, "
                    f"which is within the expected range ({expected_minimum_count}, {expected_maximum_count})"
                )
        if len(actual_work_types_count) > 0:
            pytest.fail(
                f"Unexpected work types found: {', '.join(str(k) for k in actual_work_types_count.keys())}"
            )
        else:
            logging.info(
                f"No unexpected work types found"
            )

        # If the test case has expected experience data, we need to check if the experiences match the expected ones
        if self.expected_experience_data:
            llm_evaluator_requested = "llm" in self.matchers
            if llm_evaluator_requested:
                llm_evaluator_result = await evaluator.evaluate(
                    actual=actual_experiences,
                    expected=self.expected_experience_data
                )
                if llm_evaluator_result is None:
                    logging.warning("LLM evaluation: Failed to evaluate the experiences, the LLM returned None.")
                else:
                    logging.info(f"LLM evaluation result: {llm_evaluator_result.explanation}")
            else:
                llm_evaluator_result = None
                logging.info("LLM evaluation: Not requested")

            matcher_requested = "matcher" in self.matchers
            if matcher_requested:
                _matcher_failures = check_actual_data_matches_expected(
                    actual_data=actual_experiences,
                    expected_data=self.expected_experience_data,
                    preserve_order=True
                )
                if len(_matcher_failures) == 0:
                    # The matcher passed
                    logging.info("Matcher: Evaluation passed")
                else:
                    _matcher_failures.insert(0, "Matcher: Evaluation failed!")
            else:
                _matcher_failures = []
                logging.info("Matcher: Not requested")

            both_checked = llm_evaluator_requested and matcher_requested
            none_checked = not llm_evaluator_requested and not matcher_requested
            if not none_checked:
                if both_checked and len(_matcher_failures) > 0 and llm_evaluator_result is not None and not llm_evaluator_result.match_success:
                    # Both the LLM and the matcher failed
                    failures.append(
                        f"LLM evaluation: Failed!"
                        f"\n pass: {llm_evaluator_result.match_success}"
                        f"\n score: {llm_evaluator_result.score}"
                        f"\n explanation: {llm_evaluator_result.explanation}"
                    )
                    failures.extend(_matcher_failures)
                elif both_checked and len(_matcher_failures) == 0 and llm_evaluator_result is not None and llm_evaluator_result.match_success:
                    # Both the LLM and the matcher passed
                    logging.info("LLM and Matcher evaluation passed")
                # Only one of them passed
                elif llm_evaluator_result is None or not llm_evaluator_requested:
                    # There's no LLM evaluation result
                    if len(_matcher_failures) > 0:
                        # The matcher failed
                        failures.extend(_matcher_failures)
                    else:
                        # The matcher passed
                        logging.info("Matcher: Evaluation passed")
                else:
                    logging.info("Passed the overall evaluation, but either the LLM or the matcher failed")
                    # Either the LLM or the matcher failed
                    if not llm_evaluator_result.match_success and llm_evaluator_requested:
                        # The LLM evaluation failed
                        failures.append(f"LLM evaluation: Failed!"
                                        f"\n pass: {llm_evaluator_result.match_success}"
                                        f"\n score: {llm_evaluator_result.score}"
                                        f"\n explanation: {llm_evaluator_result.explanation}")
                    if len(_matcher_failures) > 0:
                        # The LLM failed
                        logging.warning("Matcher: Evaluation failed!"
                                        '\n'.join(_matcher_failures))
        else:
            # No expected experience data, so we don't need to check anything
            logging.warning("No expected experience data set, skipping the evaluation")

        return failures

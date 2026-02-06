"""
Tests for BWS (Best-Worst Scaling) utilities.

Tests cover:
- Loading BWS tasks and occupation data
- Computing occupation scores from responses
- Parsing structured and text input
- Formatting BWS questions
- Top-K occupation selection
"""

import json
import pytest
from app.agent.preference_elicitation_agent import bws_utils


class TestLoadingFunctions:
    """Test data loading functions."""

    def test_load_bws_tasks(self):
        """Should load 12 static BWS tasks."""
        tasks = bws_utils.load_bws_tasks()

        assert len(tasks) == 12
        assert all("occupations" in task for task in tasks)
        assert all(len(task["occupations"]) == 5 for task in tasks)

    def test_load_occupation_labels(self):
        """Should load 40 occupation labels."""
        labels = bws_utils.load_occupation_labels()

        assert len(labels) == 40
        assert "22" in labels  # Health Professionals
        assert "HEALTH PROFESSIONALS" in labels["22"]

    def test_load_occupation_groups(self):
        """Should load full occupation data with descriptions."""
        groups = bws_utils.load_occupation_groups()

        assert len(groups) == 40
        assert all("code" in occ for occ in groups)
        assert all("label" in occ for occ in groups)
        assert all("description" in occ for occ in groups)
        assert all("major" in occ for occ in groups)

        # Check a specific occupation has description
        health_prof = next(occ for occ in groups if occ["code"] == "22")
        assert "description" in health_prof
        assert len(health_prof["description"]) > 0


class TestScoringFunctions:
    """Test occupation scoring functions."""

    def test_compute_occupation_scores_simple(self):
        """Should compute scores as count(best) - count(worst)."""
        responses = [
            {"best": "22", "worst": "91"},
            {"best": "22", "worst": "41"},
            {"best": "23", "worst": "91"}
        ]

        scores = bws_utils.compute_occupation_scores(responses)

        assert scores["22"] == 2.0  # Chosen as best twice
        assert scores["23"] == 1.0  # Chosen as best once
        assert scores["91"] == -2.0  # Chosen as worst twice
        assert scores["41"] == -1.0  # Chosen as worst once

    def test_compute_occupation_scores_empty(self):
        """Should handle empty responses."""
        scores = bws_utils.compute_occupation_scores([])
        assert scores == {}

    def test_get_top_k_occupations(self):
        """Should return top K occupations by score."""
        scores = {
            "22": 5.0,
            "23": 3.0,
            "25": 4.0,
            "91": -2.0,
            "41": 0.0
        }

        top_3 = bws_utils.get_top_k_occupations(scores, k=3)

        assert len(top_3) == 3
        assert top_3[0] == "22"  # Highest score
        assert top_3[1] == "25"  # Second highest
        assert top_3[2] == "23"  # Third highest

    def test_get_top_k_more_than_available(self):
        """Should handle K larger than available occupations."""
        scores = {"22": 1.0, "23": 2.0}

        top_10 = bws_utils.get_top_k_occupations(scores, k=10)

        assert len(top_10) == 2  # Only 2 available


class TestParseResponse:
    """Test BWS response parsing."""

    def setup_method(self):
        """Set up test data."""
        self.task_occupations = ["31", "12", "11", "32", "21"]

    def test_parse_json_structured_input(self):
        """Should parse structured JSON input."""
        json_input = json.dumps({
            "type": "bws_response",
            "best": "31",
            "worst": "21"
        })

        best, worst = bws_utils.parse_bws_response(json_input, self.task_occupations)

        assert best == "31"
        assert worst == "21"

    def test_parse_json_invalid_codes(self):
        """Should reject JSON with invalid occupation codes."""
        json_input = json.dumps({
            "type": "bws_response",
            "best": "99",  # Not in task
            "worst": "21"
        })

        with pytest.raises(ValueError, match="Invalid occupation codes"):
            bws_utils.parse_bws_response(json_input, self.task_occupations)

    def test_parse_text_letter_format(self):
        """Should parse text with letter format (A-E)."""
        inputs = [
            "Most: A, Least: E",
            "most: a, least: e",
            "MOST A LEAST E",
            "I prefer A and dislike E"
        ]

        for text_input in inputs:
            best, worst = bws_utils.parse_bws_response(text_input, self.task_occupations)
            assert best == "31"  # A = first
            assert worst == "21"  # E = last

    def test_parse_text_number_format(self):
        """Should parse text with number format (1-5)."""
        inputs = [
            "Most: 1, Least: 5",
            "most 1 least 5",
            "I prefer 1 and dislike 5"
        ]

        for text_input in inputs:
            best, worst = bws_utils.parse_bws_response(text_input, self.task_occupations)
            assert best == "31"  # 1 = first
            assert worst == "21"  # 5 = last

    def test_parse_text_middle_choices(self):
        """Should parse middle choices (B, C, D)."""
        text_input = "Most: B, Least: D"

        best, worst = bws_utils.parse_bws_response(text_input, self.task_occupations)

        assert best == "12"  # B = second
        assert worst == "32"  # D = fourth

    def test_parse_invalid_input(self):
        """Should raise ValueError for unparseable input."""
        invalid_inputs = [
            "gibberish",
            "I like jobs",
            "yes",
            "Most: Z, Least: Q",  # Invalid letters
            "Most: 7, Least: 9"  # Invalid numbers
        ]

        for text_input in invalid_inputs:
            with pytest.raises(ValueError, match="Could not understand your response"):
                bws_utils.parse_bws_response(text_input, self.task_occupations)

    def test_parse_fallback_from_json_to_text(self):
        """Should fall back to text parsing if JSON is invalid."""
        # Not valid JSON, but contains parseable text
        text_input = "not valid json but has Most: B, Least: D"

        best, worst = bws_utils.parse_bws_response(text_input, self.task_occupations)

        assert best == "12"  # B = second
        assert worst == "32"  # D = fourth


class TestFormatBWSQuestion:
    """Test BWS question formatting."""

    def test_format_first_question(self):
        """Should include intro text for first question."""
        task = {"occupations": ["31", "12", "11", "32", "21"]}

        message = bws_utils.format_bws_question(task, task_number=1, total_tasks=12)

        assert "Question 1 of 12" in message
        assert "I'd like to understand which types of work interest you most" in message
        assert "**most**" in message
        assert "**least**" in message
        assert "A." in message  # Should have letter labels
        assert "E." in message

    def test_format_subsequent_question(self):
        """Should not include intro text for subsequent questions."""
        task = {"occupations": ["22", "23", "24", "25", "26"]}

        message = bws_utils.format_bws_question(task, task_number=5, total_tasks=12)

        assert "Question 5 of 12" in message
        assert "I'd like to understand" not in message  # No intro
        assert "**most**" in message
        assert "**least**" in message

    def test_format_includes_all_occupations(self):
        """Should include all 5 occupations in question."""
        task = {"occupations": ["22", "23", "24", "25", "26"]}

        message = bws_utils.format_bws_question(task, task_number=2, total_tasks=12)

        # Should mention all occupation labels
        labels = bws_utils.load_occupation_labels()
        for code in task["occupations"]:
            label = labels[code]
            # Label should appear (in some form - title case or uppercase)
            assert label.upper() in message.upper() or label.title() in message


class TestIntegrationFlow:
    """Test complete BWS flow integration."""

    def test_complete_12_task_flow(self):
        """Should complete full 12-task BWS flow."""
        tasks = bws_utils.load_bws_tasks()
        responses = []

        # Simulate user completing all 12 tasks
        for i, task in enumerate(tasks):
            occupations = task["occupations"]

            # User picks first as best, last as worst
            best = occupations[0]
            worst = occupations[-1]

            responses.append({
                "task_id": i,
                "alts": occupations,
                "best": best,
                "worst": worst
            })

        # Compute scores
        scores = bws_utils.compute_occupation_scores(responses)
        top_10 = bws_utils.get_top_k_occupations(scores, k=10)

        assert len(scores) > 0
        assert len(top_10) == 10
        assert all(code in bws_utils.load_occupation_labels() for code in top_10)

    def test_hybrid_input_flow(self):
        """Should handle mix of JSON and text inputs."""
        tasks = bws_utils.load_bws_tasks()
        responses = []

        # First 6 tasks with JSON
        for i in range(6):
            task = tasks[i]
            occupations = task["occupations"]

            json_input = json.dumps({
                "type": "bws_response",
                "best": occupations[0],
                "worst": occupations[-1]
            })

            best, worst = bws_utils.parse_bws_response(json_input, occupations)
            responses.append({
                "task_id": i,
                "alts": occupations,
                "best": best,
                "worst": worst
            })

        # Next 6 tasks with text
        for i in range(6, 12):
            task = tasks[i]
            occupations = task["occupations"]

            text_input = "Most: A, Least: E"

            best, worst = bws_utils.parse_bws_response(text_input, occupations)
            responses.append({
                "task_id": i,
                "alts": occupations,
                "best": best,
                "worst": worst
            })

        # Should complete successfully
        scores = bws_utils.compute_occupation_scores(responses)
        top_10 = bws_utils.get_top_k_occupations(scores, k=10)

        assert len(responses) == 12
        assert len(scores) > 0
        assert len(top_10) == 10

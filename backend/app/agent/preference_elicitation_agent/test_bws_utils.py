"""
Tests for BWS (Best-Worst Scaling) utilities.

Tests cover:
- Loading BWS tasks and WA item data
- Computing item scores from responses
- Parsing structured and text input
- Formatting BWS questions (WA-based)
- Top-K item selection
"""

import json
import pytest
from app.agent.preference_elicitation_agent import bws_utils


class TestLoadingFunctions:
    """Test data loading functions."""

    def test_load_bws_tasks(self):
        """Should load 8 static WA-element BWS tasks."""
        tasks = bws_utils.load_bws_tasks()

        assert len(tasks) == 8
        assert all("items" in task for task in tasks)
        assert all(len(task["items"]) == 5 for task in tasks)

    def test_load_wa_tasks_alias(self):
        """load_wa_tasks() should return same result as load_bws_tasks()."""
        assert bws_utils.load_wa_tasks() == bws_utils.load_bws_tasks()

    def test_load_wa_items(self):
        """Should load 37 WA items with required fields."""
        items = bws_utils.load_wa_items()

        assert len(items) == 37
        assert all("WA_Element_ID" in item for item in items)
        assert all("WA_Element_Name_simplified" in item for item in items)
        assert all("WA_Element_Name" in item for item in items)

    def test_load_wa_labels(self):
        """Should load WA_Element_ID → simplified label mapping."""
        labels = bws_utils.load_wa_labels()

        assert len(labels) == 37
        # Check a known ID
        assert "4.A.4.b.4" in labels
        assert labels["4.A.4.b.4"] == "Leading and encouraging your team"
        assert "4.A.2.b.1" in labels
        assert labels["4.A.2.b.1"] == "Making choices and fixing problems"

    def test_bws_tasks_cover_all_wa_items(self):
        """All 37 WA items should appear in at least one task."""
        tasks = bws_utils.load_wa_tasks()
        labels = bws_utils.load_wa_labels()

        all_task_items = {item for task in tasks for item in task["items"]}
        all_wa_ids = set(labels.keys())

        assert all_task_items == all_wa_ids

    def test_bws_tasks_total_slots(self):
        """8 tasks × 5 items = 40 total slots."""
        tasks = bws_utils.load_wa_tasks()
        total = sum(len(task["items"]) for task in tasks)
        assert total == 40

    def test_load_occupation_labels(self):
        """Legacy: should still load occupation labels."""
        labels = bws_utils.load_occupation_labels()
        assert len(labels) > 0
        assert "22" in labels  # Health Professionals

    def test_load_occupation_groups(self):
        """Legacy: should still load full occupation data."""
        groups = bws_utils.load_occupation_groups()
        assert len(groups) > 0
        assert all("code" in occ for occ in groups)
        assert all("label" in occ for occ in groups)


class TestScoringFunctions:
    """Test item scoring functions."""

    def test_compute_bws_scores_simple(self):
        """Should compute scores as count(best) - count(worst)."""
        responses = [
            {"best": "4.A.4.b.4", "worst": "4.A.3.a.1"},
            {"best": "4.A.4.b.4", "worst": "4.A.3.a.2"},
            {"best": "4.A.2.b.1", "worst": "4.A.3.a.1"}
        ]

        scores = bws_utils.compute_bws_scores(responses)

        assert scores["4.A.4.b.4"] == 2.0   # Chosen as best twice
        assert scores["4.A.2.b.1"] == 1.0   # Chosen as best once
        assert scores["4.A.3.a.1"] == -2.0  # Chosen as worst twice
        assert scores["4.A.3.a.2"] == -1.0  # Chosen as worst once

    def test_compute_bws_scores_empty(self):
        """Should handle empty responses."""
        scores = bws_utils.compute_bws_scores([])
        assert scores == {}

    def test_get_top_k_bws(self):
        """Should return top K items by score."""
        scores = {
            "4.A.4.b.4": 5.0,
            "4.A.2.b.1": 3.0,
            "4.A.4.a.2": 4.0,
            "4.A.3.a.1": -2.0,
            "4.A.1.a.1": 0.0
        }

        top_3 = bws_utils.get_top_k_bws(scores, k=3)

        assert len(top_3) == 3
        assert top_3[0] == "4.A.4.b.4"  # Highest score
        assert top_3[1] == "4.A.4.a.2"  # Second highest
        assert top_3[2] == "4.A.2.b.1"  # Third highest

    def test_get_top_k_more_than_available(self):
        """Should handle K larger than available items."""
        scores = {"4.A.4.b.4": 1.0, "4.A.2.b.1": 2.0}

        top_8 = bws_utils.get_top_k_bws(scores, k=8)

        assert len(top_8) == 2  # Only 2 available


class TestParseResponse:
    """Test BWS response parsing (works for both occupation codes and WA IDs)."""

    def setup_method(self):
        """Set up test data using WA Element IDs."""
        self.task_items = [
            "4.A.4.b.4",
            "4.A.4.c.2",
            "4.A.4.b.5",
            "4.A.4.b.3",
            "4.A.2.b.5"
        ]

    def test_parse_json_structured_input(self):
        """Should parse structured JSON input with WA IDs."""
        json_input = json.dumps({
            "type": "bws_response",
            "best": "4.A.4.b.4",
            "worst": "4.A.2.b.5"
        })

        best, worst = bws_utils.parse_bws_response(json_input, self.task_items)

        assert best == "4.A.4.b.4"
        assert worst == "4.A.2.b.5"

    def test_parse_json_invalid_codes(self):
        """Should reject JSON with invalid item codes."""
        json_input = json.dumps({
            "type": "bws_response",
            "best": "4.A.9.z.9",  # Not in task
            "worst": "4.A.2.b.5"
        })

        with pytest.raises(ValueError, match="Invalid item codes"):
            bws_utils.parse_bws_response(json_input, self.task_items)

    def test_parse_text_letter_format(self):
        """Should parse text with letter format (A-E)."""
        inputs = [
            "Most: A, Least: E",
            "most: a, least: e",
            "MOST A LEAST E",
            "I prefer A and dislike E"
        ]

        for text_input in inputs:
            best, worst = bws_utils.parse_bws_response(text_input, self.task_items)
            assert best == "4.A.4.b.4"   # A = first
            assert worst == "4.A.2.b.5"  # E = last

    def test_parse_text_number_format(self):
        """Should parse text with number format (1-5)."""
        inputs = [
            "Most: 1, Least: 5",
            "most 1 least 5",
            "I prefer 1 and dislike 5"
        ]

        for text_input in inputs:
            best, worst = bws_utils.parse_bws_response(text_input, self.task_items)
            assert best == "4.A.4.b.4"   # 1 = first
            assert worst == "4.A.2.b.5"  # 5 = last

    def test_parse_text_middle_choices(self):
        """Should parse middle choices (B, C, D)."""
        text_input = "Most: B, Least: D"

        best, worst = bws_utils.parse_bws_response(text_input, self.task_items)

        assert best == "4.A.4.c.2"   # B = second
        assert worst == "4.A.4.b.3"  # D = fourth

    def test_parse_invalid_input(self):
        """Should raise ValueError for unparseable input."""
        invalid_inputs = [
            "gibberish",
            "I like jobs",
            "yes",
            "Most: Z, Least: Q",  # Invalid letters
            "Most: 7, Least: 9"   # Invalid numbers
        ]

        for text_input in invalid_inputs:
            with pytest.raises(ValueError, match="Could not understand your response"):
                bws_utils.parse_bws_response(text_input, self.task_items)

    def test_parse_fallback_from_json_to_text(self):
        """Should fall back to text parsing if JSON is invalid."""
        text_input = "not valid json but has Most: B, Least: D"

        best, worst = bws_utils.parse_bws_response(text_input, self.task_items)

        assert best == "4.A.4.c.2"   # B = second
        assert worst == "4.A.4.b.3"  # D = fourth


class TestFormatBWSWAQuestion:
    """Test WA-based BWS question formatting."""

    def test_format_first_question(self):
        """Should include intro text for first question."""
        task = {"items": ["4.A.4.b.4", "4.A.4.c.2", "4.A.4.b.5", "4.A.4.b.3", "4.A.2.b.5"]}

        message = bws_utils.format_bws_wa_question(task, task_number=1, total_tasks=8)

        assert "Question 1 of 8" in message
        assert "work activities" in message
        assert "**most**" in message
        assert "**least**" in message
        assert "A." in message  # Should have letter labels
        assert "E." in message

    def test_format_subsequent_question(self):
        """Should not include intro text for subsequent questions."""
        task = {"items": ["4.A.4.a.2", "4.A.4.a.1", "4.A.4.a.3", "4.A.4.a.4", "4.A.4.a.6"]}

        message = bws_utils.format_bws_wa_question(task, task_number=5, total_tasks=8)

        assert "Question 5 of 8" in message
        assert "I'll show you groups" not in message  # No intro
        assert "**most**" in message
        assert "**least**" in message

    def test_format_includes_all_wa_labels(self):
        """Should include simplified labels for all 5 WA items."""
        task = {"items": ["4.A.4.b.4", "4.A.4.c.2", "4.A.4.b.5", "4.A.4.b.3", "4.A.2.b.5"]}
        labels = bws_utils.load_wa_labels()

        message = bws_utils.format_bws_wa_question(task, task_number=2, total_tasks=8)

        for wa_id in task["items"]:
            expected_label = labels[wa_id]
            assert expected_label in message


class TestIntegrationFlow:
    """Test complete 8-task WA BWS flow integration."""

    def test_complete_8_task_flow(self):
        """Should complete full 8-task WA BWS flow."""
        tasks = bws_utils.load_wa_tasks()
        responses = []

        # Simulate user completing all 8 tasks
        for i, task in enumerate(tasks):
            items = task["items"]

            # User picks first as best, last as worst
            best = items[0]
            worst = items[-1]

            responses.append({
                "task_id": i,
                "alts": items,
                "best": best,
                "worst": worst
            })

        # Compute scores
        scores = bws_utils.compute_bws_scores(responses)
        top_8 = bws_utils.get_top_k_bws(scores, k=8)

        assert len(scores) > 0
        assert len(top_8) == 8
        # All top items should be valid WA IDs
        wa_labels = bws_utils.load_wa_labels()
        assert all(wa_id in wa_labels for wa_id in top_8)

    def test_hybrid_input_flow(self):
        """Should handle mix of JSON and text inputs."""
        tasks = bws_utils.load_wa_tasks()
        responses = []

        # First 4 tasks with JSON
        for i in range(4):
            task = tasks[i]
            items = task["items"]

            json_input = json.dumps({
                "type": "bws_response",
                "best": items[0],
                "worst": items[-1]
            })

            best, worst = bws_utils.parse_bws_response(json_input, items)
            responses.append({
                "task_id": i,
                "alts": items,
                "best": best,
                "worst": worst
            })

        # Next 4 tasks with text
        for i in range(4, 8):
            task = tasks[i]
            items = task["items"]

            text_input = "Most: A, Least: E"

            best, worst = bws_utils.parse_bws_response(text_input, items)
            responses.append({
                "task_id": i,
                "alts": items,
                "best": best,
                "worst": worst
            })

        # Should complete successfully
        scores = bws_utils.compute_bws_scores(responses)
        top_8 = bws_utils.get_top_k_bws(scores, k=8)

        assert len(responses) == 8
        assert len(scores) > 0
        assert len(top_8) == 8

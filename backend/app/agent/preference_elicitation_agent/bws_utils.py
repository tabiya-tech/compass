"""
Simple utilities for Best-Worst Scaling (BWS) occupation ranking.

Uses straightforward counting: score = count(best) - count(worst)
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple
from collections import defaultdict


def load_bws_tasks() -> List[Dict]:
    """Load static BWS tasks from config."""
    config_path = Path(__file__).parent / "config" / "static_bws_tasks.json"
    with open(config_path) as f:
        data = json.load(f)
    return data["tasks"]


def load_occupation_labels() -> Dict[str, str]:
    """Load occupation code → label mapping."""
    config_path = Path(__file__).parent / "config" / "occupation_groups.json"
    with open(config_path) as f:
        occupations = json.load(f)
    return {occ["code"]: occ["label"] for occ in occupations}


def load_occupation_groups() -> List[Dict]:
    """
    Load full occupation group data including descriptions.

    Returns:
        List of occupation dicts with code, label, description, and major fields
    """
    config_path = Path(__file__).parent / "config" / "occupation_groups.json"
    with open(config_path) as f:
        occupations = json.load(f)
    return occupations


def compute_occupation_scores(bws_responses: List[dict]) -> Dict[str, float]:
    """
    Compute simple scores for each occupation.

    Score = count(chosen as best) - count(chosen as worst)

    Args:
        bws_responses: List of BWS responses
            Format: [{"best": "21", "worst": "41", ...}, ...]

    Returns:
        Dict mapping occupation code → score
    """
    scores = defaultdict(float)

    for response in bws_responses:
        best = response.get("best")
        worst = response.get("worst")

        if best:
            scores[best] += 1.0
        if worst:
            scores[worst] -= 1.0

    return dict(scores)


def get_top_k_occupations(occupation_scores: Dict[str, float], k: int = 10) -> List[str]:
    """
    Get top-k occupations by score.

    Args:
        occupation_scores: Dict mapping occupation code → score
        k: Number of top occupations to return

    Returns:
        List of occupation codes, sorted by score (descending)
    """
    sorted_occs = sorted(
        occupation_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )
    return [code for code, score in sorted_occs[:k]]


def format_bws_question(task: Dict, task_number: int, total_tasks: int = 12) -> str:
    """
    Format a BWS task as a conversational question.

    Args:
        task: BWS task dict with "occupations" list
        task_number: Current task number (1-indexed)
        total_tasks: Total number of tasks

    Returns:
        Formatted question string
    """
    occupation_labels = load_occupation_labels()
    occupations = task["occupations"]

    # Build question
    if task_number == 1:
        intro = (
            "Great! Now I'd like to understand which types of work interest you most.\n\n"
            "I'll show you groups of job types. For each group, tell me:\n"
            "• Which type of job would you **most** like to have?\n"
            "• Which would you **least** like to have?\n\n"
        )
    else:
        intro = ""

    question = f"{intro}**Question {task_number} of {total_tasks}**\n\n"
    question += "Here are 5 job types:\n\n"

    for i, occ_code in enumerate(occupations, 1):
        label = occupation_labels.get(occ_code, f"Occupation {occ_code}")
        # Format nicely
        label_display = label.title() if label.isupper() else label
        question += f"{chr(64+i)}. **{label_display}**\n"

    question += "\nWhich would you **most** like to do? And which would you **least** like to do?\n"
    question += "\n_Example: \"Most: B, Least: D\" or \"I prefer C and dislike A\"_"

    return question


def parse_bws_response(user_message: str, task_occupations: List[str]) -> Tuple[str, str]:
    """
    Parse user's BWS response to extract best and worst choices.

    Handles formats like:
    - Structured JSON: {"type": "bws_response", "best": "22", "worst": "91"}
    - Plain text: "Most: B, Least: D"
    - Plain text: "most 3 least 1"
    - Plain text: "I prefer C and dislike A"
    - Plain text: "Best: Teaching, Worst: Driving"

    Args:
        user_message: User's message (plain text or JSON string)
        task_occupations: List of occupation codes in this task (for validation)

    Returns:
        Tuple of (best_occupation_code, worst_occupation_code)

    Raises:
        ValueError: If unable to parse response
    """
    message = user_message.strip()

    # Try parsing as JSON first (structured input from UI)
    try:
        data = json.loads(message)
        if isinstance(data, dict) and data.get("type") == "bws_response":
            best = data.get("best")
            worst = data.get("worst")

            # Validate codes are in task
            if best in task_occupations and worst in task_occupations:
                return best, worst
            else:
                raise ValueError(
                    f"Invalid occupation codes. Expected codes from: {task_occupations}"
                )
    except (json.JSONDecodeError, KeyError):
        # Not JSON or invalid structure - fall through to text parsing
        pass

    # Text parsing (original behavior)
    message = message.lower()

    # Try to extract letter/number choices
    # Pattern 1: "most: B, least: D" or "most B least D"
    import re

    # Look for letters A-E
    most_match = re.search(r'(?:most|best|prefer)[:\s]+([a-e])', message)
    least_match = re.search(r'(?:least|worst|dislike)[:\s]+([a-e])', message)

    if most_match and least_match:
        best_letter = most_match.group(1).upper()
        worst_letter = least_match.group(1).upper()

        # Convert letters to indices (A=0, B=1, etc.)
        best_idx = ord(best_letter) - ord('A')
        worst_idx = ord(worst_letter) - ord('A')

        if 0 <= best_idx < len(task_occupations) and 0 <= worst_idx < len(task_occupations):
            return task_occupations[best_idx], task_occupations[worst_idx]

    # Pattern 2: "most 2 least 4" (numbers 1-5)
    most_num_match = re.search(r'(?:most|best|prefer)[:\s]+(\d)', message)
    least_num_match = re.search(r'(?:least|worst|dislike)[:\s]+(\d)', message)

    if most_num_match and least_num_match:
        best_num = int(most_num_match.group(1))
        worst_num = int(least_num_match.group(1))

        # Numbers are 1-indexed
        if 1 <= best_num <= len(task_occupations) and 1 <= worst_num <= len(task_occupations):
            return task_occupations[best_num - 1], task_occupations[worst_num - 1]

    # If we can't parse, raise error for LLM to handle
    raise ValueError(
        "Could not understand your response. Please specify which option you like MOST "
        "and which you like LEAST using letters (A-E) or numbers (1-5). "
        "For example: 'Most: B, Least: D'"
    )

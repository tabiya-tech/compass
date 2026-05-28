"""
Simple utilities for Best-Worst Scaling (BWS) occupation/WA-task ranking.

Uses straightforward counting: score = count(best) - count(worst)
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple
from collections import defaultdict


def load_bws_tasks() -> List[Dict]:
    """Load static BWS tasks from config (now WA-element based)."""
    config_path = Path(__file__).parent / "config" / "static_bws_tasks.json"
    with open(config_path) as f:
        data = json.load(f)
    return data["tasks"]


# Alias for clarity
def load_wa_tasks() -> List[Dict]:
    """Load 8 static WA-element BWS tasks."""
    return load_bws_tasks()


def load_wa_items() -> List[Dict]:
    """
    Load full WA item data from ONET source.

    Returns:
        List of dicts with WA_Element_ID, WA_Element_Name, WA_Element_Name_simplified
    """
    config_path = Path(__file__).parent / "config" / "onet_wa_tasks.json"
    with open(config_path) as f:
        return json.load(f)


def load_wa_labels() -> Dict[str, str]:
    """Load WA_Element_ID → WA_Element_Name_simplified mapping."""
    items = load_wa_items()
    return {item["WA_Element_ID"]: item["WA_Element_Name_simplified"] for item in items}


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


def compute_bws_scores(bws_responses: List[dict]) -> Dict[str, float]:
    """
    Compute simple scores for each item (occupation or task).

    Score = count(chosen as best) - count(chosen as worst)

    Args:
        bws_responses: List of BWS responses
            Format: [{"best": "21", "worst": "41", ...}, ...]

    Returns:
        Dict mapping code → score
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


def get_top_k_bws(bws_scores: Dict[str, float], k: int = 10) -> List[str]:
    """
    Get top-k items by score.

    Args:
        bws_scores: Dict mapping code → score
        k: Number of top items to return

    Returns:
        List of codes, sorted by score (descending)
    """
    sorted_items = sorted(
        bws_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )
    return [code for code, score in sorted_items[:k]]


def format_bws_question(task: Dict, task_number: int, total_tasks: int = 12) -> str:
    """
    Format a BWS task as a conversational question (occupation-based, legacy).

    Args:
        task: BWS task dict with "occupations" list
        task_number: Current task number (1-indexed)
        total_tasks: Total number of tasks

    Returns:
        Formatted question string
    """
    # Load full occupation data including descriptions
    occupation_groups = load_occupation_groups()
    occupation_map = {occ["code"]: occ for occ in occupation_groups}
    occupations = task["occupations"]

    # Build question
    if task_number == 1:
        intro = (
            "Great! Now that I understand what matters to you in a job, let's figure out which broad career areas interest you most.\n\n"
            "I'll show you groups of job types. For each group, tell me:\n"
            "• Which type of job would you **most** like to have?\n"
            "• Which would you **least** like to have?\n\n"
        )
    else:
        intro = ""

    question = f"{intro}**Question {task_number} of {total_tasks}**\n\n"
    question += "Here are 5 job types:\n\n"

    for i, occ_code in enumerate(occupations, 1):
        occ_data = occupation_map.get(occ_code)
        if occ_data:
            label = occ_data["label"]
            description = occ_data.get("description", "")
            # Format nicely
            label_display = label.title() if label.isupper() else label
            # Include description to help user understand the occupation
            question += f"{chr(64+i)}. **{label_display}**  \n"
            question += f"   _{description}_\n\n"
        else:
            # Fallback if occupation not found
            question += f"{chr(64+i)}. **Occupation {occ_code}**\n\n"

    question += "Which would you **most** like to do? And which would you **least** like to do?\n"
    question += "\n_Example: \"Most: B, Least: D\" or \"I prefer C and dislike A\"_"

    return question


def format_bws_wa_question(task: Dict, task_number: int, total_tasks: int = 8) -> str:
    """
    Format a WA-element BWS task as a conversational question.

    Args:
        task: BWS task dict with "items" list of WA_Element_IDs
        task_number: Current task number (1-indexed)
        total_tasks: Total number of tasks

    Returns:
        Formatted question string
    """
    wa_labels = load_wa_labels()
    items = task["items"]

    if task_number == 1:
        intro = (
            "Great! Now that I understand what matters to you in a job, "
            "let's figure out which work activities interest you most.\n\n"
            "I'll show you groups of work activities. For each group, tell me:\n"
            "• Which activity would you **most** enjoy doing at work?\n"
            "• Which would you **least** enjoy?\n\n"
        )
    else:
        intro = ""

    question = f"{intro}**Question {task_number} of {total_tasks}**\n\n"
    question += "Here are 5 work activities:\n\n"

    for i, wa_id in enumerate(items, 1):
        label = wa_labels.get(wa_id, wa_id)
        question += f"{chr(64+i)}. **{label}**\n\n"

    question += "Which would you **most** enjoy? And which would you **least** enjoy?\n"
    question += "\n_Example: \"Most: B, Least: D\" or \"I prefer C and dislike A\"_"

    return question


def parse_bws_response(user_message: str, task_occupations: List[str]) -> Tuple[str, str]:
    """
    Parse user's BWS response to extract best and worst choices.

    Works with any item ID format (occupation codes or WA_Element_IDs).

    Handles formats like:
    - Structured JSON: {"type": "bws_response", "best": "22", "worst": "91"}
    - Structured JSON: {"type": "bws_response", "best": "4.A.4.b.4", "worst": "4.A.3.a.1"}
    - Plain text: "Most: B, Least: D"
    - Plain text: "most 3 least 1"
    - Plain text: "I prefer C and dislike A"

    Args:
        user_message: User's message (plain text or JSON string)
        task_occupations: List of item IDs in this task (occupation codes or WA_Element_IDs)

    Returns:
        Tuple of (best_item_id, worst_item_id)

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
                    f"Invalid item codes. Expected codes from: {task_occupations}"
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

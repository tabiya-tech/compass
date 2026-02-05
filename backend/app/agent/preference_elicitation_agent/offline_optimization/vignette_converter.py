"""
Vignette Converter for offline optimization.

Converts offline-generated vignettes (raw attribute profiles) to online
Vignette format with category inference and proper schema.
"""

import logging
from typing import Dict, Any, Tuple
import uuid


class VignetteConverter:
    """Converts offline vignette format to online Vignette schema."""

    def __init__(self, profile_generator):
        """
        Initialize converter.

        Args:
            profile_generator: ProfileGenerator instance for attribute metadata
        """
        self.logger = logging.getLogger(self.__class__.__name__)
        self.profile_generator = profile_generator

    def infer_category(
        self,
        profile_a: Dict[str, Any],
        profile_b: Dict[str, Any]
    ) -> str:
        """
        Infer preference category from dominant attribute differences.

        Analyzes which attributes differ most between profiles and maps
        to one of the 7 preference categories.

        Args:
            profile_a: First job profile
            profile_b: Second job profile

        Returns:
            Category name (e.g., "financial", "work_environment")
        """
        # Calculate normalized differences for each attribute
        differences = {}

        for attr in self.profile_generator.attributes:
            attr_name = attr["name"]
            value_a = profile_a.get(attr_name, 0)
            value_b = profile_b.get(attr_name, 0)

            if attr["type"] == "ordered":
                # Normalize by range
                values = [level["value"] for level in attr["levels"]]
                value_range = max(values) - min(values)
                if value_range > 0:
                    normalized_diff = abs(value_a - value_b) / value_range
                else:
                    normalized_diff = 0
            else:
                # Categorical: 0 or 1 difference
                normalized_diff = abs(value_a - value_b)

            differences[attr_name] = normalized_diff

        # Map attributes to preference categories
        # Based on preference_parameters.json model parameters
        category_mapping = {
            "wage": "financial",
            "physical_demand": "work_environment",
            "flexibility": "work_life_balance",
            "commute_time": "work_environment",
            "job_security": "job_security",
            "remote_work": "work_environment",
            "career_growth": "career_advancement",
            "task_variety": "task_preferences",
            "social_interaction": "task_preferences",
            "company_values": "values_culture"
        }

        # Find attribute with largest difference
        max_diff_attr = max(differences, key=differences.get)
        max_diff_value = differences[max_diff_attr]

        # If no meaningful difference, return "mixed"
        if max_diff_value < 0.1:
            return "mixed"

        # Map to category
        category = category_mapping.get(max_diff_attr, "mixed")

        self.logger.debug(
            f"Inferred category '{category}' from dominant attribute '{max_diff_attr}' "
            f"(diff={max_diff_value:.2f})"
        )

        return category

    def generate_scenario_text(
        self,
        category: str,
        profile_a: Dict[str, Any],
        profile_b: Dict[str, Any]
    ) -> str:
        """
        Generate scenario text for vignette.

        Creates appropriate context based on category and trade-offs.

        Args:
            category: Preference category
            profile_a: First job profile
            profile_b: Second job profile

        Returns:
            Scenario text string
        """
        # Category-specific intro templates
        category_templates = {
            "financial": "Consider these two job opportunities with different compensation packages:",
            "work_environment": "Consider these two job opportunities with different work environments:",
            "job_security": "Consider these two job opportunities with different levels of job security:",
            "career_advancement": "Consider these two job opportunities with different growth potential:",
            "work_life_balance": "Consider these two job opportunities with different work-life balance:",
            "mixed": "Consider these two job opportunities with different trade-offs:"
        }

        return category_templates.get(category, category_templates["mixed"])

    def generate_option_title(
        self,
        option_id: str,
        profile: Dict[str, Any]
    ) -> str:
        """
        Generate title for vignette option.

        Args:
            option_id: Option identifier (e.g., "A", "B")
            profile: Job profile attributes

        Returns:
            Option title string
        """
        # Simple title based on key attributes
        wage = profile.get("wage", "")
        if wage:
            return f"Option {option_id}: Job with KES {wage:,}/month"
        else:
            return f"Option {option_id}: Job Opportunity"

    def convert_to_online_format(
        self,
        vignette_pair: Tuple[Dict[str, Any], Dict[str, Any]],
        vignette_id: str = None
    ) -> Dict[str, Any]:
        """
        Convert offline vignette format to online Vignette schema.

        Takes a tuple of (profile_a, profile_b) and converts to full
        Vignette object compatible with online system.

        Args:
            vignette_pair: Tuple of (profile_a, profile_b)
            vignette_id: Optional vignette ID (auto-generated if None)

        Returns:
            Dictionary in Vignette schema format
        """
        profile_a, profile_b = vignette_pair

        # Generate vignette ID if not provided
        if vignette_id is None:
            vignette_id = f"offline_{uuid.uuid4().hex[:8]}"

        # Infer category
        category = self.infer_category(profile_a, profile_b)

        # Generate scenario text
        scenario_text = self.generate_scenario_text(category, profile_a, profile_b)

        # Convert profiles to human-readable descriptions
        description_a = self.profile_generator.profile_to_string(profile_a)
        description_b = self.profile_generator.profile_to_string(profile_b)

        # Generate option titles
        title_a = self.generate_option_title("A", profile_a)
        title_b = self.generate_option_title("B", profile_b)

        # Create VignetteOption structures
        option_a = {
            "option_id": "A",
            "title": title_a,
            "description": description_a,
            "attributes": profile_a
        }

        option_b = {
            "option_id": "B",
            "title": title_b,
            "description": description_b,
            "attributes": profile_b
        }

        # Create full Vignette structure
        vignette = {
            "vignette_id": vignette_id,
            "category": category,
            "scenario_text": scenario_text,
            "options": [option_a, option_b],
            "follow_up_questions": [],
            "targeted_dimensions": [category],
            "difficulty_level": "medium"
        }

        return vignette

    def convert_vignette_list(
        self,
        vignette_pairs: list[Tuple[Dict[str, Any], Dict[str, Any]]],
        id_prefix: str = "offline"
    ) -> list[Dict[str, Any]]:
        """
        Convert list of offline vignettes to online format.

        Args:
            vignette_pairs: List of (profile_a, profile_b) tuples
            id_prefix: Prefix for generated IDs (e.g., "static_begin", "adaptive")

        Returns:
            List of Vignette dictionaries
        """
        converted = []

        for idx, pair in enumerate(vignette_pairs, 1):
            vignette_id = f"{id_prefix}_{idx:03d}"
            vignette = self.convert_to_online_format(pair, vignette_id)
            converted.append(vignette)

        self.logger.info(
            f"Converted {len(converted)} vignettes to online format "
            f"(prefix: {id_prefix})"
        )

        return converted

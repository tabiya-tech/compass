"""
Profile Generator for offline vignette optimization.

Generates all possible job profile combinations from attribute specifications.
"""

import json
import itertools
import logging
from typing import Dict, List, Any
from pathlib import Path


class ProfileGenerator:
    """Generates candidate job profiles from attribute specifications."""

    def __init__(self, config_path: str = None):
        """
        Initialize the profile generator.

        Args:
            config_path: Path to preference_parameters.json
        """
        self.logger = logging.getLogger(self.__class__.__name__)

        if config_path is None:
            config_path = Path(__file__).parent / "preference_parameters.json"

        self.config = self._load_config(config_path)
        self.attributes = self.config["attributes"]
        self.attribute_directions = self.config["attribute_directions"]

    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            self.logger.error(f"Config file not found: {config_path}")
            raise
        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON in config: {e}")
            raise

    def generate_all_profiles(self, max_profiles: int = None) -> List[Dict[str, Any]]:
        """
        Generate all possible job profile combinations.

        Args:
            max_profiles: Maximum number of profiles to generate (for testing)

        Returns:
            List of profile dictionaries
        """
        self.logger.info("Generating candidate profiles...")

        # extract all attribute names and their possible values
        attribute_combinations = {}

        for attr in self.attributes:
            attr_name = attr["name"]

            # Get all possible values for this attribute
            if attr["type"] == "ordered":
                # For ordered attributes, use the numeric values
                values = [level["value"] for level in attr["levels"]]
            else:
                # For categorical, use binary encoding (0 for base, 1 for other)
                values = [0, 1]

            attribute_combinations[attr_name] = values

        # Generate all combinations using itertools.product
        attribute_names = list(attribute_combinations.keys())
        value_lists = [attribute_combinations[name] for name in attribute_names]

        all_combinations = list(itertools.product(*value_lists))

        # Convert to profile dictionaries
        profiles = []
        for combination in all_combinations:
            profile = {
                name: value
                for name, value in zip(attribute_names, combination)
            }
            profiles.append(profile)

            if max_profiles and len(profiles) >= max_profiles:
                break

        self.logger.info(
            f"Generated {len(profiles)} candidate profiles "
            f"from {len(all_combinations)} total combinations"
        )

        return profiles

    def encode_profile(self, profile: Dict[str, Any]) -> List[float]:
        """
        Encode a profile as a 7-dimensional preference feature vector.

        Maps 10 job attributes to 7 preference dimensions using the same
        logic as the online system (LikelihoodCalculator._extract_features).

        Preference dimensions:
        - Index 0: financial_importance (wage)
        - Index 1: work_environment_importance (physical_demand, remote_work, commute_time)
        - Index 2: career_growth_importance (career_growth)
        - Index 3: work_life_balance_importance (flexibility, commute_time)
        - Index 4: job_security_importance (job_security)
        - Index 5: task_preference_importance (task_variety, social_interaction)
        - Index 6: values_culture_importance (company_values)

        Args:
            profile: Profile dictionary with attribute values

        Returns:
            Feature vector (7 dimensions matching preference dimensions)
        """
        features = [0.0] * 7

        # Index 0: Financial - normalize wage to 0-3.5 range
        if "wage" in profile:
            features[0] = float(profile["wage"]) / 10000

        # Index 1: Work environment - aggregate physical_demand, remote_work, commute_time
        # Higher value = better work environment
        work_env_score = 0.0
        work_env_count = 0

        if "physical_demand" in profile:
            # Low physical demand (0) = better (1.0), high demand (1) = worse (0.0)
            work_env_score += (1.0 - float(profile["physical_demand"]))
            work_env_count += 1

        if "remote_work" in profile:
            # Remote work possible (1) = better (1.0)
            work_env_score += float(profile["remote_work"])
            work_env_count += 1

        if "commute_time" in profile:
            # Shorter commute = better (normalize: 15min=1.0, 60min=0.0)
            commute = float(profile["commute_time"])
            work_env_score += max(0.0, (60 - commute) / 45)  # 60-15=45 range
            work_env_count += 1

        if work_env_count > 0:
            features[1] = work_env_score / work_env_count

        # Index 2: Career growth
        if "career_growth" in profile:
            # High growth (1) = better
            features[2] = float(profile["career_growth"])

        # Index 3: Work-life balance - aggregate flexibility and commute_time
        wlb_score = 0.0
        wlb_count = 0

        if "flexibility" in profile:
            # Flexible hours (1) = better
            wlb_score += float(profile["flexibility"])
            wlb_count += 1

        if "commute_time" in profile:
            # Shorter commute also contributes to work-life balance
            commute = float(profile["commute_time"])
            wlb_score += max(0.0, (60 - commute) / 45)
            wlb_count += 1

        if wlb_count > 0:
            features[3] = wlb_score / wlb_count

        # Index 4: Job security
        if "job_security" in profile:
            # Permanent/stable (1) = better
            features[4] = float(profile["job_security"])

        # Index 5: Task preference - aggregate task_variety and social_interaction
        # This is preference-neutral in aggregate, but captures variation
        task_score = 0.0
        task_count = 0

        if "task_variety" in profile:
            # Varied tasks (1) vs routine (0)
            task_score += float(profile["task_variety"])
            task_count += 1

        if "social_interaction" in profile:
            # High collaboration (1) vs independent (0)
            task_score += float(profile["social_interaction"])
            task_count += 1

        if task_count > 0:
            features[5] = task_score / task_count

        # Index 6: Values/culture
        if "company_values" in profile:
            # Mission-driven (1) vs standard (0)
            features[6] = float(profile["company_values"])

        return features

    def profile_to_string(self, profile: Dict[str, Any]) -> str:
        """
        Convert profile to human-readable string.

        Args:
            profile: Profile dictionary

        Returns:
            String representation
        """
        parts = []
        for attr in self.attributes:
            attr_name = attr["name"]
            value = profile[attr_name]

            if attr["type"] == "ordered":
                # Find the level with this value
                level = next(
                    (l for l in attr["levels"] if l["value"] == value),
                    None
                )
                if level:
                    parts.append(f"{attr['label']}: {level['label']}")
            else:
                # Categorical: 0=base, 1=other
                level = attr["levels"][int(value)]
                parts.append(f"{attr['label']}: {level['label']}")

        return " | ".join(parts)

    def get_attribute_info(self) -> Dict[str, Any]:
        """
        Get information about attributes for documentation.

        Returns:
            Dictionary with attribute metadata
        """
        return {
            "total_attributes": len(self.attributes),
            "attributes": [
                {
                    "name": attr["name"],
                    "type": attr["type"],
                    "num_levels": len(attr["levels"]),
                    "direction": self.attribute_directions.get(attr["name"])
                }
                for attr in self.attributes
            ],
            "total_combinations": self._calculate_total_combinations()
        }

    def _calculate_total_combinations(self) -> int:
        """Calculate total number of possible profile combinations."""
        total = 1
        for attr in self.attributes:
            total *= len(attr["levels"])
        return total

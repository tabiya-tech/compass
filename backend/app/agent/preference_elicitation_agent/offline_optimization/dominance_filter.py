"""
Dominance Filter for offline vignette optimization.

Removes job profiles that are strictly dominated by other profiles.
"""

import logging
from typing import Dict, List, Any


class DominanceFilter:
    """Filters out dominated job profiles."""

    def __init__(self, attribute_directions: Dict[str, str]):
        """
        Initialize the dominance filter.

        Args:
            attribute_directions: Dict mapping attribute → "positive" or "negative"
                - "positive": higher is better (wage, security, flexibility)
                - "negative": lower is better (commute_time, physical_demand)
        """
        self.logger = logging.getLogger(self.__class__.__name__)
        self.attribute_directions = attribute_directions

    def remove_dominated_profiles(
        self,
        profiles: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Remove profiles that are strictly dominated by others using Pareto frontier algorithm.

        Profile A dominates Profile B if:
        - A is better than or equal to B in ALL attributes
        - A is strictly better than B in AT LEAST ONE attribute

        This uses an optimized incremental algorithm that builds the Pareto frontier
        iteratively, which is much faster than O(n²) pairwise comparisons.

        Args:
            profiles: List of job profiles

        Returns:
            List of non-dominated profiles (Pareto frontier)
        """
        self.logger.info(f"Filtering {len(profiles)} profiles for dominance using Pareto frontier algorithm...")

        pareto_frontier = []

        for i, candidate in enumerate(profiles):
            # Check if candidate is dominated by any profile in current frontier
            is_dominated = False
            profiles_to_remove = []

            for j, frontier_profile in enumerate(pareto_frontier):
                if self._dominates(frontier_profile, candidate):
                    # Candidate is dominated, don't add it
                    is_dominated = True
                    break
                elif self._dominates(candidate, frontier_profile):
                    # Candidate dominates this frontier profile, mark for removal
                    profiles_to_remove.append(j)

            if not is_dominated:
                # Remove dominated profiles from frontier (in reverse to maintain indices)
                for j in reversed(profiles_to_remove):
                    pareto_frontier.pop(j)

                # Add candidate to frontier
                pareto_frontier.append(candidate)

            # Log progress every 500 profiles
            if (i + 1) % 500 == 0:
                self.logger.info(
                    f"Processed {i + 1}/{len(profiles)} profiles, "
                    f"frontier size: {len(pareto_frontier)}"
                )

        removed_count = len(profiles) - len(pareto_frontier)
        self.logger.info(
            f"Removed {removed_count} dominated profiles "
            f"({removed_count / len(profiles) * 100:.1f}%)"
        )
        self.logger.info(f"Kept {len(pareto_frontier)} non-dominated profiles")

        return pareto_frontier

    def _is_dominated(
        self,
        profile: Dict[str, Any],
        all_profiles: List[Dict[str, Any]]
    ) -> bool:
        """
        Check if profile is dominated by any other profile.

        Args:
            profile: Profile to check
            all_profiles: All candidate profiles

        Returns:
            True if profile is dominated, False otherwise
        """
        for other in all_profiles:
            if other == profile:
                continue

            if self._dominates(other, profile):
                return True

        return False

    def _dominates(
        self,
        profile_a: Dict[str, Any],
        profile_b: Dict[str, Any]
    ) -> bool:
        """
        Check if profile_a dominates profile_b.

        Args:
            profile_a: First profile
            profile_b: Second profile

        Returns:
            True if profile_a dominates profile_b
        """
        better_or_equal_in_all = True
        strictly_better_in_at_least_one = False

        for attr_name, direction in self.attribute_directions.items():
            value_a = profile_a[attr_name]
            value_b = profile_b[attr_name]

            if direction == "positive":
                # Higher is better
                if value_a < value_b:
                    better_or_equal_in_all = False
                    break
                if value_a > value_b:
                    strictly_better_in_at_least_one = True

            else:  # negative
                # Lower is better
                if value_a > value_b:
                    better_or_equal_in_all = False
                    break
                if value_a < value_b:
                    strictly_better_in_at_least_one = True

        return better_or_equal_in_all and strictly_better_in_at_least_one

    def get_dominance_statistics(
        self,
        profiles: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Get statistics about dominance relationships.

        Args:
            profiles: List of profiles to analyze

        Returns:
            Dictionary with dominance statistics
        """
        dominated_count = 0
        dominance_counts = []  # How many profiles each profile dominates

        for profile in profiles:
            if self._is_dominated(profile, profiles):
                dominated_count += 1

            # Count how many others this profile dominates
            dominates_count = sum(
                1 for other in profiles
                if other != profile and self._dominates(profile, other)
            )
            dominance_counts.append(dominates_count)

        return {
            "total_profiles": len(profiles),
            "dominated_count": dominated_count,
            "non_dominated_count": len(profiles) - dominated_count,
            "avg_profiles_dominated": sum(dominance_counts) / len(profiles) if profiles else 0,
            "max_profiles_dominated": max(dominance_counts) if dominance_counts else 0
        }

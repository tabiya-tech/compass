"""
Tests for the tiered, deterministic trace sampling.
"""

from common_libs.observability.config import TracingConfig
from common_libs.observability.sampling import SamplingTier, hash_to_unit_interval, rate_for_tier, should_sample


class TestRateForTier:
    """
    Tests for rate for tier.
    """

    def test_uses_the_pipeline_rate_for_the_pipeline_tier(self):
        """Uses the pipeline rate for the pipeline tier."""
        # GIVEN a config with different rates per tier
        given_config = TracingConfig(turn_sample_rate=1.0, pipeline_sample_rate=0.2)

        # WHEN the rate for the pipeline tier is looked up
        actual_rate = rate_for_tier(SamplingTier.PIPELINE, given_config)

        # THEN expect the pipeline rate
        assert actual_rate == 0.2

    def test_uses_the_turn_rate_for_the_turn_tier(self):
        """Uses the turn rate for the turn tier."""
        # GIVEN a config with different rates per tier
        given_config = TracingConfig(turn_sample_rate=0.5, pipeline_sample_rate=0.2)

        # WHEN the rate for the turn tier is looked up
        actual_rate = rate_for_tier(SamplingTier.TURN, given_config)

        # THEN expect the turn rate
        assert actual_rate == 0.5


class TestHashToUnitInterval:
    """
    Tests for hash to unit interval.
    """

    def test_maps_a_key_into_the_unit_interval(self):
        """Maps a key into the unit interval."""
        # GIVEN an arbitrary key
        given_key = "session-42"

        # WHEN the key is hashed
        actual_value = hash_to_unit_interval(given_key)

        # THEN expect a value in [0, 1)
        assert 0.0 <= actual_value < 1.0

    def test_is_uniform_enough_to_sample_with(self):
        """Is uniform enough to sample with."""
        # GIVEN a large set of distinct keys
        given_keys = [f"session-{index}" for index in range(2000)]

        # WHEN each key is hashed and compared against a 20% threshold
        actual_below_threshold = sum(1 for key in given_keys if hash_to_unit_interval(key) < 0.2)

        # THEN expect roughly a fifth of them to fall below it
        assert 0.15 < actual_below_threshold / len(given_keys) < 0.25


class TestShouldSample:
    """
    Tests for should sample.
    """

    def test_samples_everything_at_a_rate_of_one(self):
        """Samples everything at a rate of one."""
        # GIVEN a fully sampled configuration
        given_config = TracingConfig(turn_sample_rate=1.0)

        # WHEN a hundred different keys are tested
        actual_decisions = [
            should_sample(tier=SamplingTier.TURN, key=f"session-{index}", config=given_config)
            for index in range(100)
        ]

        # THEN expect all of them to be sampled
        assert all(actual_decisions)

    def test_samples_nothing_at_a_rate_of_zero(self):
        """Samples nothing at a rate of zero."""
        # GIVEN a configuration that samples nothing
        given_config = TracingConfig(turn_sample_rate=0.0)

        # WHEN a hundred different keys are tested
        actual_decisions = [
            should_sample(tier=SamplingTier.TURN, key=f"session-{index}", config=given_config)
            for index in range(100)
        ]

        # THEN expect none of them to be sampled
        assert not any(actual_decisions)

    def test_gives_the_same_answer_for_the_same_key(self):
        """Gives the same answer for the same key."""
        # GIVEN a partially sampled configuration
        given_config = TracingConfig(turn_sample_rate=0.5)
        # AND a single session key
        given_key = "session-stable"

        # WHEN the same key is tested repeatedly
        actual_decisions = {
            should_sample(tier=SamplingTier.TURN, key=given_key, config=given_config)
            for _ in range(20)
        }

        # THEN expect one and the same decision every time, so a session is never half-traced
        assert len(actual_decisions) == 1

    def test_decides_the_tiers_independently(self):
        """Decides the tiers independently."""
        # GIVEN a configuration that traces every turn but only a fifth of the pipeline runs
        given_config = TracingConfig(turn_sample_rate=1.0, pipeline_sample_rate=0.2)
        # AND a set of session keys
        given_keys = [f"session-{index}" for index in range(500)]

        # WHEN both tiers are sampled for the same keys
        actual_turns = [should_sample(tier=SamplingTier.TURN, key=key, config=given_config) for key in given_keys]
        actual_pipelines = [should_sample(tier=SamplingTier.PIPELINE, key=key, config=given_config) for key in given_keys]

        # THEN expect every turn to be traced
        assert all(actual_turns)
        # AND expect only about a fifth of the pipeline runs to be traced
        assert 0.15 < sum(actual_pipelines) / len(given_keys) < 0.25

    def test_approximates_the_configured_rate(self):
        """Approximates the configured rate."""
        # GIVEN a configuration sampling a third of the turns
        given_config = TracingConfig(turn_sample_rate=1 / 3)
        # AND a large set of session keys
        given_keys = [f"session-{index}" for index in range(3000)]

        # WHEN each key is sampled
        actual_sampled = sum(
            1 for key in given_keys if should_sample(tier=SamplingTier.TURN, key=key, config=given_config)
        )

        # THEN expect the observed rate to be close to the configured one
        assert abs(actual_sampled / len(given_keys) - 1 / 3) < 0.05

"""
Tests for the reaction type models.
"""

import pytest
from datetime import datetime, timezone

from .types import Reaction, ReactionKind, DislikeReason


class TestReaction:
    """Tests for the Reaction model validation."""

    def test_valid_liked_reaction(self):
        """Tests that a liked reaction without reasons is valid."""
        # WHEN creating a liked reaction without reasons
        actual_reaction = Reaction(
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.LIKED
        )

        # THEN it should be valid
        assert actual_reaction.kind == ReactionKind.LIKED
        assert actual_reaction.reasons == []

    def test_valid_disliked_reaction(self):
        """Tests that a disliked reaction with reasons is valid."""
        # GIVEN dislike reasons
        given_reasons = [DislikeReason.INCORRECT_INFORMATION, DislikeReason.BIASED]

        # WHEN creating a disliked reaction with reasons
        actual_reaction = Reaction(
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.DISLIKED,
            reasons=given_reasons
        )

        # THEN it should be valid
        assert actual_reaction.kind == ReactionKind.DISLIKED
        assert len(actual_reaction.reasons) == 2
        assert DislikeReason.INCORRECT_INFORMATION in actual_reaction.reasons
        assert DislikeReason.BIASED in actual_reaction.reasons

    def test_invalid_liked_reaction_with_reason(self):
        """Tests that a liked reaction with reasons raises an error."""
        # GIVEN a dislike reason
        given_reason = [DislikeReason.INCORRECT_INFORMATION]

        # WHEN trying to create a liked reaction with reasons
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reasons can only be set when reaction kind is DISLIKED"):
            Reaction(
                message_id="msg_1",
                session_id=1,
                kind=ReactionKind.LIKED,
                reasons=given_reason
            )

    def test_invalid_disliked_reaction_without_reason(self):
        """Tests that a disliked reaction without reasons raises an error."""
        # WHEN trying to create a disliked reaction without reasons
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reasons is required when reaction kind is DISLIKED"):
            Reaction(
                message_id="msg_1",
                session_id=1,
                kind=ReactionKind.DISLIKED
            )

    def test_reaction_with_mandatory_fields(self):
        """Tests that a reaction can be constructed with only mandatory fields."""
        # WHEN creating a reaction with only mandatory fields
        actual_reaction = Reaction(
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.LIKED
        )

        # THEN it should have all mandatory fields set
        assert actual_reaction.message_id == "msg_1"
        assert actual_reaction.session_id == 1
        assert actual_reaction.kind == ReactionKind.LIKED
        # AND optional fields should have default values
        assert actual_reaction.reasons == []
        assert actual_reaction.id is None
        assert isinstance(actual_reaction.created_at, datetime)

    def test_reaction_with_all_fields(self):
        """Tests that a reaction can be constructed with all fields including optional ones."""
        # GIVEN a fixed timestamp and reasons
        fixed_timestamp = datetime(2024, 1, 1, tzinfo=timezone.utc)
        given_reasons = [DislikeReason.BIASED, DislikeReason.CONFUSING]

        # WHEN creating a reaction with all fields
        actual_reaction = Reaction(
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.DISLIKED,
            reasons=given_reasons,
            created_at=fixed_timestamp,
            id="reaction_123"
        )

        # THEN all fields should be set correctly
        assert actual_reaction.message_id == "msg_1"
        assert actual_reaction.session_id == 1
        assert actual_reaction.kind == ReactionKind.DISLIKED
        assert actual_reaction.reasons == given_reasons
        assert actual_reaction.created_at == fixed_timestamp
        assert actual_reaction.id == "reaction_123"

    def test_created_at_timezone_initialization(self):
        """Tests that created_at is initialized with UTC timezone when not provided."""
        # WHEN creating a reaction without specifying created_at
        actual_reaction = Reaction(
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.LIKED
        )

        # THEN created_at should be initialized with UTC timezone
        assert actual_reaction.created_at.tzinfo == timezone.utc

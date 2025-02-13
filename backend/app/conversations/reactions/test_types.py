"""
Tests for the reaction types models.
"""

import pytest

from .types import Reaction, ReactionKind, DislikeReason


class TestReaction:
    """Tests for the Reaction model."""

    def test_valid_liked_reaction(self):
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
        # WHEN trying to create a disliked reaction without reasons
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reasons is required when reaction kind is DISLIKED"):
            Reaction(
                message_id="msg_1",
                session_id=1,
                kind=ReactionKind.DISLIKED
            )

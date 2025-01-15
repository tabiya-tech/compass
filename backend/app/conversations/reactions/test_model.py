"""
Tests for the reaction types models.
"""
import pytest
from datetime import datetime, timezone
from .types import ReactionRequest, Reaction, ReactionKind, DislikeReason


class TestReactionRequest:
    """Tests for the ReactionRequest model."""

    # GIVEN valid liked reaction
    def test_valid_liked_reaction(self):
        # WHEN creating a liked reaction without reason
        reaction = ReactionRequest(kind=ReactionKind.LIKED)
        # THEN it should be valid
        assert reaction.kind == ReactionKind.LIKED
        assert reaction.reason is None

    # GIVEN valid disliked reaction
    def test_valid_disliked_reaction(self):
        # WHEN creating a disliked reaction with reasons
        reaction = ReactionRequest(
            kind=ReactionKind.DISLIKED,
            reason=[DislikeReason.INCORRECT_INFORMATION, DislikeReason.BIASED]
        )
        # THEN it should be valid
        assert reaction.kind == ReactionKind.DISLIKED
        assert len(reaction.reason) == 2
        assert DislikeReason.INCORRECT_INFORMATION in reaction.reason
        assert DislikeReason.BIASED in reaction.reason

    # GIVEN invalid liked reaction with reason
    def test_invalid_liked_reaction_with_reason(self):
        # WHEN trying to create a liked reaction with reason
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reason can only be set when reaction kind is DISLIKED"):
            ReactionRequest(
                kind=ReactionKind.LIKED,
                reason=[DislikeReason.INCORRECT_INFORMATION]
            )

    # GIVEN invalid disliked reaction without reason
    def test_invalid_disliked_reaction_without_reason(self):
        # WHEN trying to create a disliked reaction without reason
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reason is required when reaction kind is DISLIKED"):
            ReactionRequest(kind=ReactionKind.DISLIKED)

    # GIVEN invalid disliked reaction with empty reason list
    def test_invalid_disliked_reaction_empty_reason(self):
        # WHEN trying to create a disliked reaction with empty reason list
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reason is required when reaction kind is DISLIKED"):
            ReactionRequest(kind=ReactionKind.DISLIKED, reason=[])


class TestReaction:
    """Tests for the Reaction model."""

    # GIVEN valid reaction data
    def test_from_dict_conversion(self):
        # WHEN converting from dictionary
        now = datetime.now(timezone.utc)
        reaction_dict = {
            "_id": "123",
            "message_id": "msg_456",
            "session_id": 789,
            "kind": ReactionKind.DISLIKED,
            "reason": [DislikeReason.INCORRECT_INFORMATION],
            "timestamp": now
        }
        
        # THEN reaction should be created correctly
        reaction = Reaction.from_dict(reaction_dict)
        assert reaction.id == "123"
        assert reaction.message_id == "msg_456"
        assert reaction.session_id == 789
        assert reaction.kind == ReactionKind.DISLIKED
        assert reaction.reason == [DislikeReason.INCORRECT_INFORMATION]
        assert reaction.timestamp == now

    # GIVEN reaction with timestamp
    def test_timestamp_serialization(self):
        # WHEN creating a reaction
        now = datetime.now(timezone.utc)
        reaction = Reaction(
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.LIKED,
            timestamp=now
        )
        
        # THEN timestamp should be serialized to ISO format
        assert reaction.model_dump()["timestamp"] == now.isoformat()


    # GIVEN reaction with ReactionKind
    def test_reaction_kind_serialization(self):
        # WHEN creating a reaction
        reaction = Reaction(
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.LIKED
        )
        
        # THEN kind should be serialized to its name
        assert reaction.model_dump()["kind"] == ReactionKind.LIKED.name

    # GIVEN reaction with string kind
    def test_reaction_kind_deserialization(self):
        # WHEN creating a reaction with string kind
        reaction = Reaction(
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.LIKED.value
        )
        
        # THEN kind should be deserialized to ReactionKind enum
        assert reaction.kind == ReactionKind.LIKED
        assert isinstance(reaction.kind, ReactionKind)

    # GIVEN reaction with invalid string kind
    def test_reaction_kind_invalid_deserialization(self):
        # WHEN trying to create a reaction with invalid string kind
        # THEN it should raise a ValueError
        with pytest.raises(ValueError):
            Reaction(
                message_id="msg_1",
                session_id=1,
                kind="not_a_valid_reaction_kind"
            )

    # GIVEN valid liked reaction
    def test_valid_liked_reaction_model(self):
        # WHEN creating a liked reaction
        reaction = Reaction(
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.LIKED
        )
        
        # THEN it should be valid
        assert reaction.kind == ReactionKind.LIKED
        assert reaction.reason is None

    # GIVEN valid disliked reaction
    def test_valid_disliked_reaction_model(self):
        # WHEN creating a disliked reaction with reason
        reaction = Reaction(
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.DISLIKED,
            reason=[DislikeReason.OFFENSIVE_LANGUAGE]
        )
        
        # THEN it should be valid
        assert reaction.kind == ReactionKind.DISLIKED
        assert reaction.reason == [DislikeReason.OFFENSIVE_LANGUAGE]

    # GIVEN invalid liked reaction with reason
    def test_invalid_liked_reaction_model_with_reason(self):
        # WHEN trying to create a liked reaction with reason
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reason can only be set when reaction kind is DISLIKED"):
            Reaction(
                message_id="msg_1",
                session_id=1,
                kind=ReactionKind.LIKED,
                reason=[DislikeReason.INCORRECT_INFORMATION]
            )

    # GIVEN invalid disliked reaction without reason
    def test_invalid_disliked_reaction_model_without_reason(self):
        # WHEN trying to create a disliked reaction without reason
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reason is required when reaction kind is DISLIKED"):
            Reaction(
                message_id="msg_1",
                session_id=1,
                kind=ReactionKind.DISLIKED
            )

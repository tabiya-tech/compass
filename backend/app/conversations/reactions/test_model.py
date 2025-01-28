"""
Tests for the reaction types models.
"""
from datetime import datetime, timezone

import pytest

from .types import ReactionRequest, Reaction, ReactionKind, DislikeReason


class TestReactionRequest:
    """Tests for the ReactionRequest model."""

    def test_valid_liked_reaction(self):
        # GIVEN valid liked reaction
        # WHEN creating a liked reaction without reason
        reaction = ReactionRequest(kind=ReactionKind.LIKED)
        # THEN it should be valid
        assert reaction.kind == ReactionKind.LIKED
        assert reaction.reason is None

    def test_valid_disliked_reaction(self):
        # GIVEN valid disliked reaction
        # WHEN creating a disliked reaction with reasons
        reaction = ReactionRequest(kind=ReactionKind.DISLIKED,
                                   reason=[DislikeReason.INCORRECT_INFORMATION, DislikeReason.BIASED])
        # THEN it should be valid
        assert reaction.kind == ReactionKind.DISLIKED
        assert len(reaction.reason) == 2
        assert DislikeReason.INCORRECT_INFORMATION in reaction.reason
        assert DislikeReason.BIASED in reaction.reason

    def test_invalid_liked_reaction_with_reason(self):
        # GIVEN invalid liked reaction with reason
        # WHEN trying to create a liked reaction with reason
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reason can only be set when reaction kind is DISLIKED"):
            ReactionRequest(kind=ReactionKind.LIKED, reason=[DislikeReason.INCORRECT_INFORMATION])

    def test_invalid_disliked_reaction_without_reason(self):
        # GIVEN invalid disliked reaction without reason
        # WHEN trying to create a disliked reaction without reason
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reason is required when reaction kind is DISLIKED"):
            ReactionRequest(kind=ReactionKind.DISLIKED)

    def test_invalid_disliked_reaction_empty_reason(self):
        # GIVEN invalid disliked reaction with empty reason list
        # WHEN trying to create a disliked reaction with empty reason list
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reason is required when reaction kind is DISLIKED"):
            ReactionRequest(kind=ReactionKind.DISLIKED, reason=[])


class TestReaction:
    """Tests for the Reaction model."""
    
    def test_from_dict_conversion_from_model_dump(self):
        # GIVEN valid reaction
        # WHEN converting from model_dump
        reaction = Reaction(message_id="msg_1", session_id=1, kind=ReactionKind.LIKED, created_at=datetime.now(timezone.utc))
        reaction_dict = reaction.model_dump()
        # THEN it should be converted to a dictionary
        assert isinstance(reaction_dict, dict)
        # AND when we convert it back to a Reaction object
        reaction_from_dict = Reaction.from_dict(reaction_dict)
        # THEN it should be the same as the original reaction
        assert reaction_from_dict == reaction

    def test_from_dict_conversion_with_enum_values(self):
        # GIVEN valid reaction data
        # WHEN converting from dictionary
        now = datetime.now(timezone.utc)
        reaction_dict = {"_id": "123", "message_id": "msg_456", "session_id": 789, "kind": ReactionKind.DISLIKED.value,
                         "reason": [DislikeReason.INCORRECT_INFORMATION.value], "created_at": now}

        # THEN reaction should be created correctly
        reaction = Reaction.from_dict(reaction_dict)
        assert reaction.id == reaction_dict["_id"]
        assert reaction.message_id == reaction_dict["message_id"]
        assert reaction.session_id == reaction_dict["session_id"]
        assert reaction.kind == reaction_dict["kind"]
        assert reaction.reason == reaction_dict["reason"]
        assert reaction.created_at == now

    def test_from_dict_conversion_with_enum_names(self):
        # WHEN converting from dictionary
        now = datetime.now(timezone.utc)
        reaction_dict = {"_id": "123", "message_id": "msg_456", "session_id": 789, "kind": ReactionKind.DISLIKED.name,
                         "reason": [DislikeReason.INCORRECT_INFORMATION.name], "created_at": now}

        # THEN reaction should be created correctly
        reaction = Reaction.from_dict(reaction_dict)
        assert reaction.id == reaction_dict["_id"]
        assert reaction.message_id == reaction_dict["message_id"]
        assert reaction.session_id == reaction_dict["session_id"]
        assert reaction.kind.name == reaction_dict["kind"]
        assert [r.name for r in reaction.reason] == reaction_dict["reason"]
        assert reaction.created_at == now

    def test_created_at_serialization(self):
        # GIVEN reaction with created_at
        # WHEN creating a reaction
        now = datetime.now(timezone.utc)
        reaction = Reaction(message_id="msg_1", session_id=1, kind=ReactionKind.LIKED, created_at=now)

        # THEN created_at should be serialized to ISO format
        assert reaction.model_dump()["created_at"] == now.isoformat()

    def test_reaction_kind_serialization(self):
        # GIVEN reaction with ReactionKind
        # WHEN creating a reaction
        reaction = Reaction(message_id="msg_1", session_id=1, kind=ReactionKind.LIKED)

        # THEN kind should be serialized to its name
        assert reaction.model_dump()["kind"] == ReactionKind.LIKED.name

    def test_reaction_kind_deserialization(self):
        # GIVEN reaction with string kind
        # WHEN creating a reaction with string kind
        reaction = Reaction(message_id="msg_1", session_id=1, kind=ReactionKind.LIKED.value)

        # THEN kind should be deserialized to ReactionKind enum
        assert reaction.kind == ReactionKind.LIKED
        assert isinstance(reaction.kind, ReactionKind)

    def test_reaction_kind_invalid_deserialization(self):
        # GIVEN reaction with invalid string kind
        # WHEN trying to create a reaction with invalid string kind
        # THEN it should raise a ValueError
        with pytest.raises(ValueError):
            Reaction(message_id="msg_1", session_id=1, kind="not_a_valid_reaction_kind")

    def test_valid_liked_reaction_model(self):
        # GIVEN valid liked reaction
        # WHEN creating a liked reaction
        reaction = Reaction(message_id="msg_1", session_id=1, kind=ReactionKind.LIKED)

        # THEN it should be valid
        assert reaction.kind == ReactionKind.LIKED
        assert reaction.reason is None

    def test_valid_disliked_reaction_model(self):
        # GIVEN valid disliked reaction
        # WHEN creating a disliked reaction with reason
        reaction = Reaction(message_id="msg_1", session_id=1, kind=ReactionKind.DISLIKED,
                            reason=[DislikeReason.OFFENSIVE_LANGUAGE])

        # THEN it should be valid
        assert reaction.kind == ReactionKind.DISLIKED
        assert reaction.reason == [DislikeReason.OFFENSIVE_LANGUAGE]

    def test_invalid_liked_reaction_model_with_reason(self):
        # GIVEN invalid liked reaction with reason
        # WHEN trying to create a liked reaction with reason
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reason can only be set when reaction kind is DISLIKED"):
            Reaction(message_id="msg_1", session_id=1, kind=ReactionKind.LIKED,
                     reason=[DislikeReason.INCORRECT_INFORMATION])

    def test_invalid_disliked_reaction_model_without_reason(self):
        # GIVEN invalid disliked reaction without reason
        # WHEN trying to create a disliked reaction without reason
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reason is required when reaction kind is DISLIKED"):
            Reaction(message_id="msg_1", session_id=1, kind=ReactionKind.DISLIKED)

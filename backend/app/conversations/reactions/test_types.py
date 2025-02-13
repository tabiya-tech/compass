"""
Tests for the reaction types models.
"""
from datetime import datetime, timezone, timedelta

import pytest

from .types import ReactionRequest, Reaction, ReactionKind, DislikeReason


class TestReactionRequest:
    """Tests for the ReactionRequest model."""

    def test_valid_liked_reaction(self):
        # WHEN creating a liked reaction without reasons
        actual_reaction = ReactionRequest(kind=ReactionKind.LIKED)

        # THEN it should be valid
        assert actual_reaction.kind == ReactionKind.LIKED
        assert actual_reaction.reasons == []

    def test_valid_disliked_reaction(self):
        # GIVEN dislike reasons
        given_reasons = [DislikeReason.INCORRECT_INFORMATION, DislikeReason.BIASED]

        # WHEN creating a disliked reaction with reasons
        actual_reaction = ReactionRequest(kind=ReactionKind.DISLIKED, reasons=given_reasons)

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
            ReactionRequest(kind=ReactionKind.LIKED, reasons=given_reason)

    def test_invalid_disliked_reaction_without_reason(self):
        # WHEN trying to create a disliked reaction without reasons
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reasons is required when reaction kind is DISLIKED"):
            ReactionRequest(kind=ReactionKind.DISLIKED)

    def test_invalid_disliked_reaction_empty_reason(self):
        # GIVEN empty reasons list
        given_reasons = []

        # WHEN trying to create a disliked reaction with empty reasons list
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reasons is required when reaction kind is DISLIKED"):
            ReactionRequest(kind=ReactionKind.DISLIKED, reasons=given_reasons)


class TestReaction:
    """Tests for the Reaction model."""

    def test_from_dict_conversion_from_model_dump(self):
        # GIVEN reaction parameters
        given_id = "foo"
        given_message_id = "msg_1"
        given_session_id = 1
        given_created_at = datetime.now(timezone.utc)

        # WHEN creating a reaction and converting to model_dump
        given_reaction = Reaction(
            id=given_id,
            message_id=given_message_id,
            session_id=given_session_id,
            kind=ReactionKind.LIKED,
            created_at=given_created_at
        )
        actual_model_dump = given_reaction.model_dump()

        # THEN it should be converted to a dictionary
        assert isinstance(actual_model_dump, dict)

        # AND WHEN converting back to a Reaction object
        actual_reaction = Reaction.from_dict(actual_model_dump)

        # THEN it should match the original reaction
        assert actual_reaction == given_reaction

    def test_from_dict_conversion(self):
        # GIVEN reaction dictionary data
        given_created_at = datetime.now(timezone.utc)
        given_reaction_dict = {
            "id": "123",
            "message_id": "msg_456",
            "session_id": 789,
            "kind": ReactionKind.DISLIKED,
            "reasons": [DislikeReason.INCORRECT_INFORMATION],
            "created_at": given_created_at
        }

        # WHEN converting from dictionary
        actual_reaction = Reaction.from_dict(given_reaction_dict)

        # THEN reaction should be created correctly
        assert actual_reaction.message_id == given_reaction_dict["message_id"]
        assert actual_reaction.session_id == given_reaction_dict["session_id"]
        assert actual_reaction.kind == given_reaction_dict["kind"]
        assert actual_reaction.reasons == given_reaction_dict["reasons"]
        assert actual_reaction.created_at == given_created_at

    def test_from_dict_conversion_with_enum_names(self):
        # GIVEN reaction dictionary with enum names
        given_created_at = datetime.now(timezone.utc)
        given_reaction_dict = {
            "id": "123",
            "message_id": "msg_456",
            "session_id": 789,
            "kind": ReactionKind.DISLIKED.name,
            "reasons": [DislikeReason.INCORRECT_INFORMATION.name],
            "created_at": given_created_at
        }

        # WHEN converting from dictionary
        actual_reaction = Reaction.from_dict(given_reaction_dict)

        # THEN reaction should be created correctly
        assert actual_reaction.message_id == given_reaction_dict["message_id"]
        assert actual_reaction.session_id == given_reaction_dict["session_id"]
        assert actual_reaction.kind == ReactionKind[given_reaction_dict["kind"]]
        assert actual_reaction.reasons == [DislikeReason[r] for r in given_reaction_dict["reasons"]]
        assert actual_reaction.created_at == given_created_at

    @pytest.mark.parametrize("test_case", [
        pytest.param(
            {
                "name": "with_current_utc_time",
                "created_at": datetime.now(timezone.utc),
                "description": "current UTC time"
            },
            id="current_utc_time"
        ),
        pytest.param(
            {
                "name": "with_specific_date",
                "created_at": datetime(2024, 3, 15, 12, 30, 45, tzinfo=timezone.utc),
                "description": "specific UTC date and time"
            },
            id="specific_date"
        ),
        pytest.param(
            {
                "name": "with_est_timezone",
                "created_at": datetime.now(timezone(timedelta(hours=-5), 'EST')),
                "description": "current EST time"
            },
            id="est_timezone"
        ),
        pytest.param(
            {
                "name": "with_timestamp",
                "created_at": datetime.fromtimestamp(1647345045, tz=timezone.utc),
                "description": "from timestamp"
            },
            id="from_timestamp"
        ),
    ])
    def test_created_at_serialization(self, test_case):
        """Test created_at serialization with different datetime scenarios."""
        # GIVEN reaction parameters with different created_at values
        given_id = "test_id"
        given_created_at = test_case["created_at"]

        # WHEN creating a reaction and serializing
        actual_reaction = Reaction(
            id=given_id,
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.LIKED,
            created_at=given_created_at
        )
        actual_model_dump = actual_reaction.model_dump()

        # THEN verify the created_at is serialized in UTC format
        serialized_datetime = datetime.fromisoformat(actual_model_dump["created_at"])

        # Convert original datetime to UTC for comparison
        expected_utc = given_created_at.astimezone(timezone.utc)

        assert serialized_datetime.tzinfo == timezone.utc, f"Timezone should be UTC for {test_case['description']}"
        assert serialized_datetime == expected_utc, f"Datetime should match UTC value for {test_case['description']}"
        assert actual_model_dump["created_at"].endswith(
            '+00:00'), f"Serialized string should end with UTC timezone (+00:00) for {test_case['description']}"

    def test_reaction_kind_serialization(self):
        # GIVEN reaction parameters
        given_id = "test_id"

        # WHEN creating a reaction and serializing
        actual_reaction = Reaction(
            id=given_id,
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.LIKED
        )

        # THEN kind should be serialized to its name
        assert actual_reaction.model_dump()["kind"] == ReactionKind.LIKED.name

    def test_reaction_kind_deserialization(self):
        # GIVEN reaction parameters
        given_id = "test_id"

        # WHEN creating a reaction with string kind
        actual_reaction = Reaction(
            id=given_id,
            message_id="msg_1",
            session_id=1,
            kind=ReactionKind.LIKED
        )

        # THEN kind should be deserialized to ReactionKind enum
        assert actual_reaction.kind == ReactionKind.LIKED
        assert isinstance(actual_reaction.kind, ReactionKind)

    def test_reaction_kind_invalid_deserialization(self):
        # GIVEN invalid reaction kind
        given_id = "test_id"

        # WHEN trying to create a reaction with invalid string kind
        # THEN it should raise a ValueError
        with pytest.raises(ValueError):
            Reaction(
                id=given_id,
                message_id="msg_1",
                session_id=1,
                kind="not_a_valid_reaction_kind"
            )

    def test_reaction_kind_rejects_enum_value(self):
        # GIVEN invalid enum value
        given_id = "test_id"
        given_invalid_kind = 0

        # WHEN trying to create a reaction with enum value
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Invalid reaction kind: 0"):
            Reaction(
                id=given_id,
                message_id="msg_1",
                session_id=1,
                kind=given_invalid_kind
            )

    def test_valid_liked_reaction_model(self):
        # GIVEN reaction parameters
        given_id = "test_id"
        given_message_id = "msg_1"
        given_session_id = 1

        # WHEN creating a liked reaction
        actual_reaction = Reaction(
            id=given_id,
            message_id=given_message_id,
            session_id=given_session_id,
            kind=ReactionKind.LIKED
        )

        # THEN it should be valid
        assert actual_reaction.kind == ReactionKind.LIKED
        assert actual_reaction.reasons == []

    def test_valid_disliked_reaction_model(self):
        # GIVEN reaction parameters
        given_id = "test_id"
        given_message_id = "msg_1"
        given_session_id = 1
        given_reasons = [DislikeReason.OFFENSIVE_LANGUAGE]

        # WHEN creating a disliked reaction with reasons
        actual_reaction = Reaction(
            id=given_id,
            message_id=given_message_id,
            session_id=given_session_id,
            kind=ReactionKind.DISLIKED,
            reasons=given_reasons
        )

        # THEN it should be valid
        assert actual_reaction.kind == ReactionKind.DISLIKED
        assert actual_reaction.reasons == given_reasons

    def test_invalid_liked_reaction_model_with_reason(self):
        # GIVEN reaction parameters with invalid reasons for liked reaction
        given_id = "test_id"
        given_reasons = [DislikeReason.INCORRECT_INFORMATION]

        # WHEN trying to create a liked reaction with reasons
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reasons can only be set when reaction kind is DISLIKED"):
            Reaction(
                id=given_id,
                message_id="msg_1",
                session_id=1,
                kind=ReactionKind.LIKED,
                reasons=given_reasons
            )

    def test_invalid_disliked_reaction_model_without_reason(self):
        # GIVEN reaction parameters without required reasons
        given_id = "test_id"

        # WHEN trying to create a disliked reaction without reasons
        # THEN it should raise a ValueError
        with pytest.raises(ValueError, match="Reasons is required when reaction kind is DISLIKED"):
            Reaction(
                id=given_id,
                message_id="msg_1",
                session_id=1,
                kind=ReactionKind.DISLIKED
            )

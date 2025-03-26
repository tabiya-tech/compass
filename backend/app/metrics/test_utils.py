from app.metrics.constants import EventType
from app.metrics.utils import decrypt_event_payload, encrypt_events_payload
from app.users.auth import UserInfo, SignInProvider
from common_libs.test_utilities import get_random_user_id, get_random_printable_string


class TestDecryptEvents:
    def test_roundtrip(self):
        # GIVEN some user information.
        given_user_id = get_random_user_id()
        given_user_info = UserInfo(
            user_id=given_user_id,
            token=get_random_printable_string(10),
            sign_in_provider=SignInProvider.ANONYMOUS,
            decoded_token=dict(
                sub=given_user_id,
                iat=1,
                exp=1
            )
        )

        # GIVEN some sample events list of events.
        given_events = [
            dict(
                event_type=EventType.FEEDBACK_SCORE.value,
                foo="bar"
            ),
            dict(
                event_type=EventType.USER_ACCOUNT_CREATED.value,
                foo="bar"
            )
        ]

        # AND given events list is encrypted on either client.
        given_encrypted_events = encrypt_events_payload(events_payload=given_events, user_info=given_user_info)

        # WHEN the events are decrypted.
        decrypted_events = decrypt_event_payload(events_payload=given_encrypted_events, user_info=given_user_info)

        # THEN the decrypted events are the same as the given events.
        assert decrypted_events == given_events

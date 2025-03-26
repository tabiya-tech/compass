from pydantic import BaseModel, Field


MAX_PAYLOAD_SIZE = 6024


class MetricsRequestBody(BaseModel):
    """
    Save Metrics HTTP Request Body
    """

    payload: str = Field(
        description="Encrypted list of events objects",
        # Maximum 10 events, each with up to 5 keys (10 * 5 = 50 key-value pairs).
        # Each key and value is at most 50 characters, so a single pair is 100 characters (50 + 50).
        # - Applying XOR encryption doesn't increase length, but converting to a hex string doubles it.
        # - So, each pair becomes 200 characters (100 * 2).
        # - With 100 pairs, the total max length is 5000 characters (100 * 50).
        # - Adding tolerance for overhead, the max size is rounded to 1024 characters for safety.
        max_length=MAX_PAYLOAD_SIZE
    )

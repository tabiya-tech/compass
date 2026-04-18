from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, field_serializer, field_validator, model_validator


class ModuleStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    UNLOCKED = "UNLOCKED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class ConversationMode(str, Enum):
    INSTRUCTION = "INSTRUCTION"
    SUPPORT = "SUPPORT"


class CareerReadinessMessageSender(str, Enum):
    USER = "USER"
    AGENT = "AGENT"


class TopicStatus(str, Enum):
    """Coverage status of a single module topic within a career readiness conversation."""

    COVERED = "covered"
    PARTIAL = "partial"
    NOT_COVERED = "not_covered"


class TopicStatusRecord(BaseModel):
    """Records the current coverage status of one module topic."""

    topic_id: str
    """The canonical topic name, matching a value from the module's topic list"""

    status: TopicStatus
    """Whether the topic has been covered, partially addressed, or not yet discussed"""

    evidence: str
    """Quote or paraphrase of the student's relevant statement; required non-empty for covered/partial, must be empty string for not_covered"""

    @model_validator(mode="after")
    def _evidence_matches_status(self) -> "TopicStatusRecord":
        if self.status in (TopicStatus.COVERED, TopicStatus.PARTIAL):
            if not self.evidence.strip():
                raise ValueError(
                    f"evidence must be non-empty when status is {self.status.value}"
                )
        elif self.evidence != "":
            raise ValueError("evidence must be empty string when status is not_covered")
        return self

    class Config:
        extra = "forbid"


class ModuleSummary(BaseModel):
    """
    Summary of a career readiness module, used in listing endpoints.
    """

    id: str
    """The unique identifier (slug) of the module, e.g. 'cv-resume-creation'"""

    title: str
    """The display title of the module"""

    description: str
    """A short description of what the module covers"""

    icon: str
    """Icon identifier for the module"""

    status: ModuleStatus
    """The user's current progress status for this module"""

    sort_order: int
    """Display order of the module in the list"""

    input_placeholder: str
    """Placeholder text shown in the chat input for this module"""

    class Config:
        extra = "forbid"


class ModuleDetail(BaseModel):
    """
    Detailed view of a career readiness module, including active conversation info.
    """

    id: str
    """The unique identifier (slug) of the module"""

    title: str
    """The display title of the module"""

    description: str
    """A short description of what the module covers"""

    icon: str
    """Icon identifier for the module"""

    status: ModuleStatus
    """The user's current progress status for this module"""

    sort_order: int
    """Display order of the module in the list"""

    input_placeholder: str
    """Placeholder text shown in the chat input for this module"""

    scope: str
    """The full scope/content description of the module"""

    active_conversation_id: str | None = None
    """The ID of the active conversation for this module, if one exists"""

    class Config:
        extra = "forbid"


class ModuleListResponse(BaseModel):
    """
    Response containing the list of all career readiness modules.
    """

    modules: list[ModuleSummary]
    """The list of available modules with user progress"""

    class Config:
        extra = "forbid"


class CareerReadinessMessage(BaseModel):
    """
    Represents a single message in a career readiness conversation.
    """

    message_id: str
    """The unique id of the message"""

    message: str
    """The message content"""

    sent_at: datetime
    """The time the message was sent, in ISO format, in UTC"""

    sender: CareerReadinessMessageSender
    """The sender of the message, either USER or AGENT"""

    metadata: dict | None = None
    """Optional metadata (e.g. quick_reply_options)"""

    @field_serializer('sent_at')
    def _serialize_sent_at(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat()

    @field_serializer("sender")
    def _serialize_sender(self, sender: CareerReadinessMessageSender, _info) -> str:
        return sender.name

    @classmethod
    @field_validator("sender", mode='before')
    def _deserialize_sender(cls, value: str | CareerReadinessMessageSender) -> CareerReadinessMessageSender:
        if isinstance(value, str):
            return CareerReadinessMessageSender[value]
        elif isinstance(value, CareerReadinessMessageSender):
            return value
        else:
            raise ValueError(f"Invalid message sender: {value}")

    class Config:
        extra = "forbid"


class CareerReadinessConversationResponse(BaseModel):
    """
    Response for a career readiness conversation, including messages and completion status.
    """

    conversation_id: str
    """The unique id of the conversation"""

    module_id: str
    """The module this conversation belongs to"""

    messages: list[CareerReadinessMessage]
    """The messages in the conversation"""

    module_completed: bool = False
    """Whether the module has been completed through this conversation"""

    quiz_passed: bool | None = None
    """Whether the user passed the module quiz. None = not attempted."""

    covered_topics: list[str] = []
    """Topics that have been covered so far in this conversation."""

    conversation_mode: ConversationMode | None = None
    """The current conversation mode (INSTRUCTION or SUPPORT)."""

    quiz_available: bool = False
    """Whether the quiz is available for this conversation (quiz delivered but not yet passed)."""

    class Config:
        extra = "forbid"


class QuizQuestionResponse(BaseModel):
    """A quiz question for the frontend (excludes correct_answer)."""

    question: str
    options: list[str]

    class Config:
        extra = "forbid"


class QuizResponse(BaseModel):
    """Response for GET .../quiz — the quiz questions."""

    questions: list[QuizQuestionResponse]

    class Config:
        extra = "forbid"


class QuizSubmissionInput(BaseModel):
    """Input for POST .../quiz — structured quiz answers."""

    answers: dict[int, str] = Field(
        json_schema_extra={
            "example": {"1": "B", "2": "A", "3": "C"},
        },
    )
    """question_number (1-indexed) → answer letter (A-D)"""

    class Config:
        extra = "forbid"

    @model_validator(mode="after")
    def _validate_answers(self) -> "QuizSubmissionInput":
        valid_letters = {"A", "B", "C", "D"}
        normalized: dict[int, str] = {}
        for key, value in self.answers.items():
            upper = value.upper()
            if upper not in valid_letters:
                raise ValueError(f"Invalid answer '{value}' for question {key}. Must be A-D.")
            normalized[key] = upper
        self.answers = normalized
        return self


class QuizQuestionResult(BaseModel):
    """Per-question result (no correct answer exposed)."""

    question_index: int
    """1-indexed question number"""

    is_correct: bool

    class Config:
        extra = "forbid"


class QuizSubmissionResponse(BaseModel):
    """Response for POST .../quiz — evaluation results."""

    score: int
    total: int
    passed: bool
    question_results: list[QuizQuestionResult]
    module_completed: bool
    conversation_mode: ConversationMode

    class Config:
        extra = "forbid"


class CareerReadinessConversationInput(BaseModel):
    """
    Input for sending a message in a career readiness conversation.
    """

    user_input: str
    """The user input"""

    class Config:
        extra = "forbid"


class CareerReadinessConversationDocument(BaseModel):
    """
    Represents a career readiness conversation document in MongoDB.
    """

    conversation_id: str
    """The unique identifier for the conversation"""

    module_id: str
    """The module this conversation belongs to"""

    user_id: str
    """The user who owns this conversation"""

    messages: list[CareerReadinessMessage] = Field(default_factory=list)
    """The messages in the conversation"""

    conversation_mode: ConversationMode = ConversationMode.INSTRUCTION
    """The current conversation mode (INSTRUCTION during teaching, SUPPORT after quiz pass)"""

    covered_topics: list[str] = Field(default_factory=list)
    """Legacy: flat list of topic names the agent marked as covered. Read-only after the
    per-topic-status refactor — new writes go to `topic_status`. Retained so in-flight
    pre-migration documents still deserialize cleanly."""

    topic_status: list[TopicStatusRecord] = Field(default_factory=list)
    """Per-topic coverage state; one entry per canonical module topic"""

    quiz_delivered: bool = False
    """Whether the quiz has been presented to the user"""

    quiz_passed: bool = False
    """Whether the user passed the module quiz"""

    created_at: datetime
    """When the conversation was created"""

    updated_at: datetime
    """When the conversation was last updated"""

    @field_serializer("created_at", "updated_at")
    def _serialize_datetime(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat()

    @classmethod
    @field_validator("created_at", "updated_at", mode="before")
    def _deserialize_datetime(cls, value: str | datetime) -> datetime:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value)
        elif isinstance(value, datetime):
            dt = value
        else:
            raise ValueError(f"Invalid datetime value: {value}")
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    @staticmethod
    def from_dict(_dict: dict) -> "CareerReadinessConversationDocument":
        """Convert a MongoDB document dictionary to a typed object."""
        return CareerReadinessConversationDocument(
            conversation_id=str(_dict["conversation_id"]),
            module_id=str(_dict["module_id"]),
            user_id=str(_dict["user_id"]),
            messages=[CareerReadinessMessage(**msg) for msg in _dict.get("messages", [])],
            conversation_mode=ConversationMode(_dict.get("conversation_mode", ConversationMode.INSTRUCTION)),
            covered_topics=_dict.get("covered_topics", []),
            topic_status=[TopicStatusRecord(**r) for r in _dict.get("topic_status", [])],
            quiz_delivered=_dict.get("quiz_delivered", False),
            quiz_passed=_dict.get("quiz_passed", False),
            created_at=_dict["created_at"],
            updated_at=_dict["updated_at"],
        )

    class Config:
        extra = "forbid"

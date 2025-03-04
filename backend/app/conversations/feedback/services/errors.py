"""
Module containing feedback-specific errors.
"""


class InvalidQuestionError(Exception):
    """Raised when a feedback contains an invalid question ID."""

    def __init__(self, question_id: str):
        self.question_id = question_id
        super().__init__(f"Invalid question ID: {question_id}")


class InvalidOptionError(Exception):
    """Raised when a feedback contains an invalid option for a question."""

    def __init__(self, option: str, question_id: str):
        self.option = option
        self.question_id = question_id
        super().__init__(f"Invalid option '{option}' for question '{question_id}'")


class QuestionsFileError(Exception):
    """Raised when there's an error loading the questions file."""

    def __init__(self, message: str):
        super().__init__(message)

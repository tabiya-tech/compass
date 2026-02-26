from dataclasses import dataclass
from app.i18n.types import Locale


@dataclass(frozen=True)
class LocaleContext:
    """
    Stores both conversation and reporting locales for a request context.
    """

    conversation_locale: Locale
    """
    Specifies the language to be used for the conversation.
    All user-facing messages must be generated in this language.
    """

    reporting_locale: Locale
    """
    Defines the language used to generate and store report data (e.g., Experience and Skills Report) in the application state.
    """

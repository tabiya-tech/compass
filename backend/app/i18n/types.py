from enum import Enum

class Locale(Enum):
    EN_US = "en-US"
    EN_GB = "en-GB"
    ES_AR = "es-AR"
    ES_ES = "es-ES"

    @staticmethod
    def from_locale_str(locale: str) -> "Locale":
        return Locale(locale)

    def label(self) -> str:
        match self:
            case Locale.EN_US:
                return "English (US)"
            case Locale.EN_GB:
                return "English (UK)"
            case Locale.ES_ES:
                return "Spanish (Spain)"
            case Locale.ES_AR:
                return "Spanish (Argentina)"

SUPPORTED_LOCALES: list[Locale] = [Locale.EN_US, Locale.EN_GB, Locale.ES_AR, Locale.ES_ES]


def is_locale_supported(language: Locale) -> bool:
    return language in SUPPORTED_LOCALES

from pathlib import Path

LOCALES_DIR = Path(__file__).parent / "locales"
DEFAULT_FALLBACK_LOCALE = 'en-US'

# Date format pattern constants (ISO fallback)
DATE_FORMAT_ISO = "YYYY-MM-DD"
DATE_FORMAT_ISO_MONTH_YEAR = "YYYY-MM"
DATE_FORMAT_YEAR_ONLY = "YYYY"

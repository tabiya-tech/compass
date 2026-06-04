"""
This module loads career readiness module definitions from markdown files with frontmatter.

Module markdown files are organised into per-language subdirectories of the modules
directory (e.g. ``modules/en``, ``modules/pt``). The registry that is loaded for a given
request is selected from the active locale — the per-request locale when one is set,
otherwise the configured ``app_config.language_config.default_locale`` — so the content the
agent is grounded in matches the language the conversation is held in.
"""
import logging
import re
from pathlib import Path

from pydantic import BaseModel, ConfigDict

from app.app_config import get_application_config
from app.context_vars import user_language_ctx_var
from app.i18n.types import Locale

logger = logging.getLogger(__name__)

_MODULES_DIR = Path(__file__).parent / "modules"

# The language subdirectory used when the resolved locale has no dedicated module set.
_FALLBACK_LANG_DIR = "en"


def _locale_to_lang_dir(locale: Locale) -> str:
    """Map a Locale to its module subdirectory — the ISO-639 language part of the locale.

    e.g. ``Locale.EN_US`` -> ``"en"``, ``Locale.PT_MZ`` -> ``"pt"``.
    """
    return locale.value.split("-", 1)[0].lower()


def _resolve_active_locale() -> Locale:
    """Resolve the locale modules should be loaded for.

    Prefers the per-request active locale (``user_language_ctx_var``); falls back to the
    configured ``default_locale`` and finally to English. Never raises — module loading must
    not fail just because no locale has been established yet (e.g. at import time or in unit
    tests that do not configure the app).
    """
    try:
        return user_language_ctx_var.get()
    except LookupError:
        pass
    try:
        return get_application_config().language_config.default_locale
    except Exception:  # pylint: disable=broad-except
        return Locale.EN_US


class QuizQuestion(BaseModel):
    """A single multiple-choice quiz question."""

    model_config = ConfigDict(extra="forbid")

    question: str
    """The question text"""

    options: list[str]
    """The answer options, e.g. ["A. Resume", "B. Letter", "C. Form", "D. Report"]"""

    correct_answer: str
    """The correct answer letter, e.g. "A" """


class QuizConfig(BaseModel):
    """Configuration for a module's quiz section."""

    model_config = ConfigDict(extra="forbid")

    pass_threshold: float = 0.7
    """Fraction of correct answers required to pass (0.0–1.0)"""

    questions: list[QuizQuestion]
    """The list of quiz questions"""


class ModuleConfig(BaseModel):
    """
    Represents a career readiness module definition loaded from a markdown file.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    """The unique identifier (slug) of the module"""

    title: str
    """The display title of the module"""

    description: str
    """A short description of what the module covers"""

    icon: str
    """Icon identifier for the module"""

    sort_order: int
    """Display order of the module in the list"""

    input_placeholder: str
    """Placeholder text shown in the chat input for this module"""

    content: str
    """The markdown body content used as grounding for the agent"""

    topics: list[str]
    """The list of topics the agent must cover before the quiz becomes available"""

    quiz: QuizConfig | None = None
    """The quiz configuration, parsed from the ## Quiz section. None if no quiz."""


def _parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """
    Parse a markdown file with ---delimited frontmatter.
    Returns a tuple of (frontmatter dict, markdown body).
    """
    if not text.startswith("---"):
        raise ValueError("Markdown file must start with --- frontmatter delimiter")

    # Find the closing --- delimiter
    end_index = text.index("---", 3)
    frontmatter_text = text[3:end_index].strip()
    body = text[end_index + 3:].strip()

    # Parse key: value pairs
    metadata = {}
    for line in frontmatter_text.splitlines():
        line = line.strip()
        if not line:
            continue
        if ":" not in line:
            raise ValueError(f"Invalid frontmatter line (missing colon): {line}")
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip()

    return metadata, body


def _split_quiz_section(body: str) -> tuple[str, str | None]:
    """
    Split the markdown body on the '## Quiz' heading.
    Returns (content_before_quiz, quiz_section_text_or_none).
    """
    # Match ## Quiz at the start of a line (with optional trailing whitespace)
    pattern = r"(?m)^## Quiz\s*$"
    match = re.search(pattern, body)
    if match is None:
        return body, None

    content = body[:match.start()].rstrip()
    quiz_text = body[match.end():].strip()
    return content, quiz_text


def _parse_quiz_section(text: str) -> QuizConfig:
    """
    Parse a quiz section into a QuizConfig.

    Expected format:
        pass_threshold: 0.7       (optional, defaults to 0.7)

        1. Question text here?
        A. Option A text
        B. Option B text
        C. Option C text
        D. Option D text
        Answer: B

        2. Another question?
        ...
    """
    lines = text.strip().splitlines()

    # Parse optional pass_threshold from the first non-empty line
    pass_threshold = 0.7
    start_index = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("pass_threshold:"):
            try:
                pass_threshold = float(stripped.split(":", 1)[1].strip())
            except ValueError as e:
                raise ValueError(f"Invalid pass_threshold value: {stripped}") from e
            start_index = i + 1
            break
        # First non-empty line is not pass_threshold — start parsing questions from here
        start_index = i
        break

    # Parse questions
    questions: list[QuizQuestion] = []
    current_question: str | None = None
    current_options: list[str] = []
    current_answer: str | None = None

    question_pattern = re.compile(r"^\d+\.\s+(.+)")
    option_pattern = re.compile(r"^([A-D])\.\s+(.+)")
    answer_pattern = re.compile(r"^Answer:\s+([A-Da-d])")

    for line in lines[start_index:]:
        stripped = line.strip()
        if not stripped:
            continue

        question_match = question_pattern.match(stripped)
        option_match = option_pattern.match(stripped)
        answer_match = answer_pattern.match(stripped)

        if question_match:
            # Save previous question if exists
            if current_question is not None:
                if current_answer is None:
                    raise ValueError(f"Quiz question missing Answer: '{current_question}'")
                questions.append(QuizQuestion(
                    question=current_question,
                    options=current_options,
                    correct_answer=current_answer,
                ))
            current_question = question_match.group(1)
            current_options = []
            current_answer = None
        elif option_match:
            current_options.append(f"{option_match.group(1)}. {option_match.group(2)}")
        elif answer_match:
            current_answer = answer_match.group(1).upper()

    # Save the last question
    if current_question is not None:
        if current_answer is None:
            raise ValueError(f"Quiz question missing Answer: '{current_question}'")
        questions.append(QuizQuestion(
            question=current_question,
            options=current_options,
            correct_answer=current_answer,
        ))

    if not questions:
        raise ValueError("Quiz section contains no questions")

    return QuizConfig(pass_threshold=pass_threshold, questions=questions)


def _load_module_from_file(file_path: Path) -> ModuleConfig:
    """
    Load a single module configuration from a markdown file.
    """
    text = file_path.read_text(encoding="utf-8")
    metadata, body = _parse_frontmatter(text)

    # Parse topics from comma-separated frontmatter value
    topics_raw = metadata.get("topics", "")
    topics = [t.strip() for t in topics_raw.split(",") if t.strip()] if topics_raw else []

    # Split quiz section from content
    content, quiz_text = _split_quiz_section(body)

    # Parse quiz if present
    quiz = _parse_quiz_section(quiz_text) if quiz_text is not None else None

    return ModuleConfig(
        id=metadata["id"],
        title=metadata["title"],
        description=metadata["description"],
        icon=metadata["icon"],
        sort_order=int(metadata["sort_order"]),
        input_placeholder=metadata["input_placeholder"],
        content=content,
        topics=topics,
        quiz=quiz,
    )


class ModuleRegistry:
    """
    Registry of all available career readiness modules for a single language.

    Modules are loaded from markdown files in a language-specific subdirectory of the
    modules directory (e.g. ``modules/en``). When ``modules_dir`` is given explicitly it is
    used verbatim (the files directly inside it are loaded); otherwise the directory is
    resolved from ``locale`` (or the active locale when ``locale`` is None), falling back to
    the English module set when no dedicated directory exists for that language.
    """

    def __init__(self, modules_dir: Path | None = None, locale: Locale | None = None):
        self._modules: dict[str, ModuleConfig] = {}
        self._locale: Locale = locale or _resolve_active_locale()
        resolved_dir = self._resolve_modules_dir(modules_dir, self._locale)
        self._load_modules(resolved_dir)

    @staticmethod
    def _resolve_modules_dir(modules_dir: Path | None, locale: Locale) -> Path:
        """Resolve which directory to load module files from.

        An explicit ``modules_dir`` is honoured as-is. Otherwise the locale's language
        subdirectory is used, falling back to the English subdirectory and finally to the
        flat modules directory.
        """
        if modules_dir is not None:
            return modules_dir

        lang = _locale_to_lang_dir(locale)
        candidate = _MODULES_DIR / lang
        if candidate.is_dir():
            return candidate

        fallback = _MODULES_DIR / _FALLBACK_LANG_DIR
        if fallback.is_dir():
            logger.warning(
                "No career readiness modules for locale '%s' (missing %s); falling back to '%s'",
                locale.value, candidate, _FALLBACK_LANG_DIR,
            )
            return fallback

        logger.warning(
            "No language-specific career readiness module directory found; "
            "falling back to flat modules directory %s", _MODULES_DIR,
        )
        return _MODULES_DIR

    def _load_modules(self, modules_dir: Path) -> None:
        """
        Load all markdown files from the modules directory.
        """
        if not modules_dir.exists():
            logger.warning("Modules directory does not exist: %s", modules_dir)
            return

        for file_path in sorted(modules_dir.glob("*.md")):
            if file_path.name.startswith("_") or file_path.name == "README.md":
                continue
            try:
                module = _load_module_from_file(file_path)
                self._modules[module.id] = module
                logger.info("Loaded career readiness module: %s", module.id)
            except Exception as e:
                logger.error("Failed to load module from %s: %s", file_path, e)
                raise

    def get_all_modules(self) -> list[ModuleConfig]:
        """
        Get all modules sorted by sort_order.
        """
        return sorted(self._modules.values(), key=lambda m: m.sort_order)

    def get_module(self, module_id: str) -> ModuleConfig | None:
        """
        Get a specific module by its ID. Returns None if not found.
        """
        return self._modules.get(module_id)


# One cached registry per language directory, keyed by the language code (e.g. "en", "pt").
_registries: dict[str, ModuleRegistry] = {}


def get_module_registry(locale: Locale | None = None) -> ModuleRegistry:
    """
    Get the module registry for the given locale (defaulting to the active locale).

    Registries are cached per language so each language's modules are parsed at most once.
    The active locale is the per-request locale when set, otherwise the configured
    ``default_locale``.
    """
    resolved_locale = locale or _resolve_active_locale()
    lang = _locale_to_lang_dir(resolved_locale)

    registry = _registries.get(lang)
    if registry is None:
        registry = ModuleRegistry(locale=resolved_locale)
        _registries[lang] = registry
    return registry

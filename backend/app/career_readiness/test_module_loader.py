"""
Tests for the career readiness module loader.
"""
import pytest

from app.career_readiness.module_loader import (
    ModuleRegistry,
    _parse_frontmatter,
    _load_module_from_file,
    _split_quiz_section,
    _parse_quiz_section,
)


_VALID_FRONTMATTER = (
    "---\n"
    "id: test-module\n"
    "title: Test Module\n"
    "description: A test module.\n"
    "icon: test\n"
    "sort_order: 1\n"
    "input_placeholder: Ask something...\n"
    "topics: Topic A, Topic B, Topic C\n"
    "---\n\n"
)

_VALID_QUIZ_SECTION = (
    "pass_threshold: 0.8\n\n"
    "1. What is the answer?\n"
    "A. Wrong\n"
    "B. Correct\n"
    "C. Wrong again\n"
    "D. Still wrong\n"
    "Answer: B\n\n"
    "2. Another question?\n"
    "A. No\n"
    "B. Yes\n"
    "C. Maybe\n"
    "D. Perhaps\n"
    "Answer: B\n"
)


class TestParseFrontmatter:
    """Tests for the frontmatter parser."""

    def test_parses_valid_frontmatter_and_body(self):
        # GIVEN a markdown string with valid frontmatter
        given_text = "---\nid: test-module\ntitle: Test Module\n---\n\n# Body Content\n\nSome text."

        # WHEN the frontmatter is parsed
        actual_metadata, actual_body = _parse_frontmatter(given_text)

        # THEN the metadata contains the parsed key-value pairs
        assert actual_metadata["id"] == "test-module"
        assert actual_metadata["title"] == "Test Module"
        # AND the body contains the markdown content
        assert "# Body Content" in actual_body
        assert "Some text." in actual_body

    def test_raises_when_missing_opening_delimiter(self):
        # GIVEN a markdown string without the opening --- delimiter
        given_text = "id: test-module\n---\n\nBody."

        # WHEN the frontmatter is parsed
        # THEN a ValueError is raised
        with pytest.raises(ValueError, match="must start with ---"):
            _parse_frontmatter(given_text)

    def test_raises_when_line_has_no_colon(self):
        # GIVEN a markdown string with an invalid frontmatter line (no colon)
        given_text = "---\nid: test-module\ninvalid line\n---\n\nBody."

        # WHEN the frontmatter is parsed
        # THEN a ValueError is raised
        with pytest.raises(ValueError, match="missing colon"):
            _parse_frontmatter(given_text)

    def test_handles_colons_in_values(self):
        # GIVEN a frontmatter value that contains a colon
        given_text = "---\ndescription: Learn to write: a guide\n---\n\nBody."

        # WHEN the frontmatter is parsed
        actual_metadata, _ = _parse_frontmatter(given_text)

        # THEN the value includes everything after the first colon
        assert actual_metadata["description"] == "Learn to write: a guide"


class TestSplitQuizSection:
    """Tests for splitting the quiz section from module content."""

    def test_splits_body_with_quiz_section(self):
        # GIVEN a markdown body with a ## Quiz section
        given_body = "# Module Content\n\nSome text.\n\n## Quiz\n\n1. A question?\nA. Yes\nAnswer: A"

        # WHEN the body is split
        actual_content, actual_quiz_text = _split_quiz_section(given_body)

        # THEN the content contains everything before ## Quiz
        assert "# Module Content" in actual_content
        assert "Some text." in actual_content
        # AND the quiz text contains the quiz section
        assert "1. A question?" in actual_quiz_text
        # AND the content does NOT contain quiz content
        assert "## Quiz" not in actual_content
        assert "A question?" not in actual_content

    def test_returns_none_when_no_quiz_section(self):
        # GIVEN a markdown body without a ## Quiz section
        given_body = "# Module Content\n\nSome text."

        # WHEN the body is split
        actual_content, actual_quiz_text = _split_quiz_section(given_body)

        # THEN the content is the full body
        assert actual_content == given_body
        # AND the quiz text is None
        assert actual_quiz_text is None

    def test_does_not_split_on_quiz_in_different_heading_level(self):
        # GIVEN a body with ### Quiz (not ## Quiz)
        given_body = "# Content\n\n### Quiz\n\nNot a real quiz."

        # WHEN the body is split
        actual_content, actual_quiz_text = _split_quiz_section(given_body)

        # THEN the quiz text is None (### Quiz is not a split point)
        assert actual_quiz_text is None
        # AND the content contains the full body
        assert "### Quiz" in actual_content


class TestParseQuizSection:
    """Tests for parsing the quiz section text into QuizConfig."""

    def test_parses_valid_quiz_section(self):
        # GIVEN a valid quiz section text
        given_text = _VALID_QUIZ_SECTION

        # WHEN the quiz section is parsed
        actual_quiz = _parse_quiz_section(given_text)

        # THEN the pass threshold is parsed correctly
        assert actual_quiz.pass_threshold == 0.8
        # AND there are 2 questions
        assert len(actual_quiz.questions) == 2
        # AND the first question is parsed correctly
        assert actual_quiz.questions[0].question == "What is the answer?"
        assert len(actual_quiz.questions[0].options) == 4
        assert actual_quiz.questions[0].correct_answer == "B"

    def test_raises_when_no_questions_found(self):
        # GIVEN a quiz section with no valid questions
        given_text = "pass_threshold: 0.8\n\nSome random text."

        # WHEN the quiz section is parsed
        # THEN a ValueError is raised
        with pytest.raises(ValueError, match="no questions"):
            _parse_quiz_section(given_text)

    def test_raises_when_answer_missing(self):
        # GIVEN a quiz question without an Answer line
        given_text = (
            "1. A question?\n"
            "A. Option A\n"
            "B. Option B\n"
            "C. Option C\n"
            "D. Option D\n"
        )

        # WHEN the quiz section is parsed
        # THEN a ValueError is raised for missing answer
        with pytest.raises(ValueError, match="missing Answer"):
            _parse_quiz_section(given_text)


class TestLoadModuleFromFile:
    """Tests for loading a single module from a file."""

    def test_loads_valid_module_file_with_topics_and_quiz(self, tmp_path):
        # GIVEN a valid module markdown file with topics and a quiz section
        given_file = tmp_path / "test.md"
        given_file.write_text(
            _VALID_FRONTMATTER
            + "# Test Content\n\nBody text.\n\n"
            + "## Quiz\n\n"
            + _VALID_QUIZ_SECTION,
            encoding="utf-8",
        )

        # WHEN the module is loaded
        actual_module = _load_module_from_file(given_file)

        # THEN the module has the correct metadata
        assert actual_module.id == "test-module"
        assert actual_module.title == "Test Module"
        assert actual_module.sort_order == 1
        # AND the topics are parsed from comma-separated frontmatter
        assert actual_module.topics == ["Topic A", "Topic B", "Topic C"]
        # AND the content contains the markdown body but NOT the quiz
        assert "# Test Content" in actual_module.content
        assert "Body text." in actual_module.content
        assert "## Quiz" not in actual_module.content
        assert "What is the answer?" not in actual_module.content
        # AND the quiz is parsed correctly
        assert actual_module.quiz is not None
        assert len(actual_module.quiz.questions) == 2
        assert actual_module.quiz.pass_threshold == 0.8

    def test_loads_module_without_quiz(self, tmp_path):
        # GIVEN a module file without a quiz section
        given_file = tmp_path / "no_quiz.md"
        given_file.write_text(
            _VALID_FRONTMATTER + "# Content\n\nNo quiz here.",
            encoding="utf-8",
        )

        # WHEN the module is loaded
        actual_module = _load_module_from_file(given_file)

        # THEN the quiz is None
        assert actual_module.quiz is None
        # AND the content includes the full body
        assert "No quiz here." in actual_module.content

    def test_raises_when_required_field_missing(self, tmp_path):
        # GIVEN a module file missing the 'title' field
        given_file = tmp_path / "bad.md"
        given_file.write_text(
            "---\n"
            "id: bad-module\n"
            "description: Missing title.\n"
            "icon: test\n"
            "sort_order: 1\n"
            "input_placeholder: Ask...\n"
            "---\n\nBody.",
            encoding="utf-8",
        )

        # WHEN the module is loaded
        # THEN a KeyError is raised for the missing field
        with pytest.raises(KeyError):
            _load_module_from_file(given_file)


class TestModuleRegistry:
    """Tests for the module registry."""

    def test_loads_all_real_modules(self):
        # GIVEN the real modules directory
        # WHEN a registry is created with the default path
        actual_registry = ModuleRegistry()

        # THEN all 6 modules are loaded
        actual_modules = actual_registry.get_all_modules()
        assert len(actual_modules) == 6
        # AND they are sorted by sort_order
        actual_orders = [m.sort_order for m in actual_modules]
        assert actual_orders == sorted(actual_orders)

    def test_get_module_returns_correct_module(self):
        # GIVEN the real modules directory
        actual_registry = ModuleRegistry()

        # WHEN a specific module is requested
        actual_module = actual_registry.get_module("cv-development")

        # THEN the correct module is returned
        assert actual_module is not None
        assert actual_module.id == "cv-development"
        assert actual_module.title == "CV Development"

    def test_get_module_returns_none_for_nonexistent(self):
        # GIVEN the real modules directory
        actual_registry = ModuleRegistry()

        # WHEN a nonexistent module is requested
        actual_module = actual_registry.get_module("nonexistent-module")

        # THEN None is returned
        assert actual_module is None

    def test_loads_from_custom_directory(self, tmp_path):
        # GIVEN a custom directory with two module files
        given_module_dir = tmp_path / "modules"
        given_module_dir.mkdir()

        for i, name in enumerate(["alpha", "beta"], start=1):
            (given_module_dir / f"{name}.md").write_text(
                f"---\n"
                f"id: {name}\n"
                f"title: Module {name.title()}\n"
                f"description: Description for {name}.\n"
                f"icon: {name}\n"
                f"sort_order: {i}\n"
                f"input_placeholder: Ask about {name}...\n"
                f"topics: Topic 1, Topic 2\n"
                f"---\n\n"
                f"# {name.title()} Content",
                encoding="utf-8",
            )

        # WHEN a registry is created with the custom directory
        actual_registry = ModuleRegistry(modules_dir=given_module_dir)

        # THEN both modules are loaded
        assert len(actual_registry.get_all_modules()) == 2
        assert actual_registry.get_module("alpha") is not None
        assert actual_registry.get_module("beta") is not None

    def test_skips_files_starting_with_underscore(self, tmp_path):
        # GIVEN a directory with a normal module and an underscore-prefixed file
        given_module_dir = tmp_path / "modules"
        given_module_dir.mkdir()

        (given_module_dir / "real.md").write_text(
            "---\n"
            "id: real\n"
            "title: Real Module\n"
            "description: A real module.\n"
            "icon: real\n"
            "sort_order: 1\n"
            "input_placeholder: Ask...\n"
            "topics: Topic 1\n"
            "---\n\n# Content",
            encoding="utf-8",
        )
        (given_module_dir / "_example.md").write_text(
            "---\nid: example\ntitle: Example\n---\n\nThis should be skipped.",
            encoding="utf-8",
        )

        # WHEN a registry is created
        actual_registry = ModuleRegistry(modules_dir=given_module_dir)

        # THEN only the real module is loaded
        assert len(actual_registry.get_all_modules()) == 1
        assert actual_registry.get_module("real") is not None
        assert actual_registry.get_module("example") is None

    def test_all_real_modules_have_topics(self):
        # GIVEN the real modules directory
        actual_registry = ModuleRegistry()

        # WHEN all modules are retrieved
        actual_modules = actual_registry.get_all_modules()

        # THEN each module has at least one topic
        for module in actual_modules:
            assert len(module.topics) > 0, f"Module {module.id} has no topics"

    def test_all_real_modules_have_quiz_except_entrepreneurship(self):
        # GIVEN the real modules directory
        # AND that the entrepreneurship module's quiz is intentionally disabled for the pilot
        actual_registry = ModuleRegistry()
        given_quizless_module_ids = {"entrepreneurship"}

        # WHEN all modules are retrieved
        actual_modules = actual_registry.get_all_modules()

        # THEN every module except entrepreneurship has a quiz with 10 questions
        for module in actual_modules:
            if module.id in given_quizless_module_ids:
                assert module.quiz is None, (
                    f"Module {module.id} is expected to be quiz-less but has a quiz"
                )
                continue
            assert module.quiz is not None, f"Module {module.id} has no quiz"
            assert len(module.quiz.questions) == 10, (
                f"Module {module.id} has {len(module.quiz.questions)} questions, expected 10"
            )

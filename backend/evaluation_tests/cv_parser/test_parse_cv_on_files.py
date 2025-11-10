import json
import logging
from pathlib import Path
from typing import Iterator

import pytest

from app.users.cv.utils.cv_structured_extractor import CVStructuredExperienceExtractor
from app.users.cv.utils.cv_responsibilities_extractor import CVResponsibilitiesExtractor
from app.agent.skill_explorer_agent._responsibilities_extraction_tool import _ResponsibilitiesExtractionTool
from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown

BASE_DIR = Path(__file__).parent
TEST_INPUTS_DIR = BASE_DIR / "test_inputs"
TEXT_EXPECTATIONS_DIR = BASE_DIR / "test_expectations"


def _iter_input_files() -> Iterator[Path]:
    if not TEST_INPUTS_DIR.exists():
        return iter(())
    patterns = ["*.pdf", "*.docx", "*.txt"]
    files: list[Path] = []
    for pattern in patterns:
        files.extend(TEST_INPUTS_DIR.glob(pattern))
    files.sort(key=lambda p: p.name.lower())
    return iter(files)


def _load_expectation_for(input_file: Path) -> dict | None:
    expected_path = TEXT_EXPECTATIONS_DIR / (input_file.stem + ".json")
    if not expected_path.exists():
        return None
    with expected_path.open("r", encoding="utf-8") as f:
        return json.load(f)


inputs = list(_iter_input_files())


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize("input_path", inputs if inputs else [None], ids=[p.name for p in inputs] if inputs else ["no-inputs"])
@pytest.mark.parametrize("attempt", list(range(3)), ids=lambda i: f"run-{i+1}")
async def test_parse_cv_on_real_files(input_path: Path | None, attempt: int):
    # GIVEN a real CV file
    if input_path is None:
        pytest.skip("No input files found under evaluation_tests/cv_parser/test_inputs; add files to run this test")

    logger = logging.getLogger("CVUploadServiceIntegrationTest")
    tool = _ResponsibilitiesExtractionTool(logger)
    resp_extractor = CVResponsibilitiesExtractor(logger, tool)
    extractor = CVStructuredExperienceExtractor(logger, resp_extractor)

    file_bytes = input_path.read_bytes()
    filename = input_path.name

    # WHEN parsing the CV
    mark_down = convert_cv_bytes_to_markdown(file_bytes=file_bytes, filename=filename, logger=logger)
    structured = await extractor.extract_structured_experiences(mark_down)
    # Convert structured experiences to simple lines for backward-compatible keyword checks
    def _extract_year(date_str: str | None) -> str | None:
        """Extract year from date string (handles formats like '2019', '09/2019', '2019-09', etc.)"""
        if not date_str:
            return None
        # Try to extract year (last 4 digits or first 4 digits if it looks like YYYY-MM-DD)
        import re
        # Match 4-digit year
        year_match = re.search(r'\b(19|20)\d{2}\b', date_str)
        return year_match.group(0) if year_match else date_str
    
    experiences = []
    for e in structured.experience_entities:
        parts = [e.experience_title]
        if e.company:
            parts.append(f"at {e.company}")
        if e.location:
            parts.append(e.location)
        if e.timeline and e.timeline.start:
            year = _extract_year(e.timeline.start)
            if year:
                parts.append(year)
        if e.timeline and e.timeline.end:
            year = _extract_year(e.timeline.end)
            if year:
                parts.append(year)
        experiences.append(" ".join(parts).strip())
    logger.info("Parsed experiences: %s", experiences or "[]")

    # THEN the extracted experiences should match expectations (probabilistic: run multiple times)
    expectation = _load_expectation_for(input_path)
    if expectation is None:
        pytest.fail(
            f"No expectation file found for '{input_path.name}'.\n"
            f"Create expectation JSON at '{(TEXT_EXPECTATIONS_DIR / (input_path.stem + '.json'))}' with shape: {{\n  \"experiences\": [\"...\"]\n}}"
        )
    if isinstance(expectation.get("expected_item_keywords"), list):
        assert isinstance(experiences, list)
        lower_lines = [line.lower() for line in experiences]
        for keyword_group in expectation["expected_item_keywords"]:
            group = [str(k).strip().lower() for k in keyword_group]
            assert any(all(k in line for k in group) for line in lower_lines), (
                f"Expected keywords not satisfied in any extracted item.\nKeywords: {group}\nGot: {lower_lines}"
            )
    else:
        pytest.fail(
            f"Expectation file is malformed for '{input_path.name}'. It must contain a top-level 'experiences' array.\n"
            f"Path: {(TEXT_EXPECTATIONS_DIR / (input_path.stem + '.json'))}"
        )

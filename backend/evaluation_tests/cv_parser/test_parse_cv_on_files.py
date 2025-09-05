import json
import logging
from pathlib import Path
from typing import Iterator

import pytest

from app.users.cv.service import CVUploadService

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
    service = CVUploadService(logger=logger)

    file_bytes = input_path.read_bytes()
    filename = input_path.name

    # WHEN parsing the CV
    parsed = await service.parse_cv(user_id="evaluation", file_bytes=file_bytes, filename=filename)
    experiences = parsed.experiences_data or []

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

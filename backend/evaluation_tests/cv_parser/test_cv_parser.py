import pytest
import os

from evaluation_tests.matcher import ContainsString, match_expected

from app.users.cv.utils.llm_extractor import CVExperienceExtractor
from evaluation_tests.cv_parser.test_cases import test_cases, CVParserTestCase
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationResult, EvaluationRecord
from evaluation_tests.cv_parser.cv_parser_evaluator import CVParserEvaluator


def write_to_file(folder: str, base_file_name: str, content: str) -> None:
    os.makedirs(folder, exist_ok=True)
    file_path = os.path.join(folder, f"{base_file_name}.md")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

class CVParserEvaluationRecord(EvaluationRecord):
    markdown_cv: str
    extracted_items: list[str]

    def _to_markdown(self) -> str:
        items = "\n".join([f"- {s}" for s in self.extracted_items])
        return (f"# Test case: {self.test_case}\n\n"
                f"## Input CV (markdown):\n{self.markdown_cv}\n\n"
                f"## Extracted Items:\n{items}\n\n"
                f"## Evaluations:\n{self._get_evaluations_str()}")

# No helper matching logic – keep it simple and consistent with other eval tests using matchers


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize("case", test_cases, ids=[c.name for c in test_cases])
async def test_cv_parser(case: CVParserTestCase, common_folder_path: str):
    extractor = CVExperienceExtractor()
    items = await extractor.extract_experiences(case.markdown_cv)

    # write to an output file for manual inspection
    write_to_file(folder=common_folder_path + f"cv_parser_{case.name}",
                  base_file_name="input_cv",
                  content=case.markdown_cv)
    write_to_file(folder=common_folder_path + f"cv_parser_{case.name}",
                  base_file_name="extracted_items",
                  content="\n".join(items) if items else "(no items extracted)")

    record = CVParserEvaluationRecord(test_case=case.name,
                                      markdown_cv=case.markdown_cv,
                                      extracted_items=items)

    failures = []

    # Behavioral checks: each expected item is a list of required substrings that must all appear in a single extracted line
    for expected_keywords in case.expected_item_keywords:
        found = False
        for actual in items:
            # All keywords must be present in the same line (case-insensitive)
            if all(match_expected(actual, ContainsString(k, case_sensitive=False))[0] for k in expected_keywords):
                found = True
                break
        if not found:
            failures.append(
                "Did not find an extracted line containing all required keywords:\n"
                f"required={expected_keywords}\n"
                f"extracted={items}"
            )

    # If no items are expected, ensure none are returned
    if not case.expected_item_keywords and len(items) != 0:
        failures.append(f"Expected no items, but got {len(items)}: {items}")

    # LLM evaluation (simple enablement, no extra complexity)
    evaluator = CVParserEvaluator()
    eval_out = await evaluator.evaluate(markdown_cv=case.markdown_cv, items=items)
    record.add_evaluation_result(EvaluationResult(
        evaluator_name=eval_out.evaluator_name,
        score=eval_out.score,
        reasoning=eval_out.reasoning,
    ))
    if not eval_out.meets_requirements:
        failures.append(f"Evaluator failed: {eval_out.reasoning}")

    try:
        if failures:
            extracted_block = "\n".join([f"[{i}] {s}" for i, s in enumerate(items)]) or "<no items>"
            message = "\n".join(failures) + "\n\nExtracted items (for debugging):\n" + extracted_block
            pytest.fail(message)
    finally:
        out_folder = common_folder_path + f"cv_parser_{case.name}"
        record.save_data(folder=out_folder, base_file_name="evaluation_record")



import pytest

from app.users.cv.utils.llm_extractor import CVExperienceExtractor
from evaluation_tests.cv_parser.test_cases import test_cases, CVParserTestCase
from evaluation_tests.cv_parser.cv_parser_evaluator import CVParserEvaluator
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationResult, EvaluationRecord


class CVParserEvaluationRecord(EvaluationRecord):
    markdown_cv: str
    extracted_items: list[str]

    def _to_markdown(self) -> str:
        items = "\n".join([f"- {s}" for s in self.extracted_items])
        return (f"# Test case: {self.test_case}\n\n"
                f"## Input CV (markdown):\n{self.markdown_cv}\n\n"
                f"## Extracted Items:\n{items}\n\n"
                f"## Evaluations:\n{self._get_evaluations_str()}")


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize("case", test_cases, ids=[c.name for c in test_cases])
async def test_cv_parser(case: CVParserTestCase, common_folder_path: str):
    extractor = CVExperienceExtractor()
    items = await extractor.extract_bulleted_direct(case.markdown_cv)

    record = CVParserEvaluationRecord(test_case=case.name,
                                      markdown_cv=case.markdown_cv,
                                      extracted_items=items)

    # Rule checks
    failures = []
    if not items or len(items) < case.min_items:
        failures.append(f"Expected at least {case.min_items} items, got {len(items)}")

    for s in items:
        if s.startswith("- ") or s.startswith("* "):
            failures.append("Item contains leading bullet marker")
        if s.split(".")[0].isdigit():
            failures.append("Item appears numbered")
        if len(s) > 400:
            failures.append("Item too long (>400 chars)")

    if case.must_contain_keywords:
        joined = "\n".join(items).lower()
        for kw in case.must_contain_keywords:
            if kw.lower() not in joined:
                failures.append(f"Missing expected keyword: {kw}")

    # LLM evaluation
    evaluator = CVParserEvaluator()
    eval_out = await evaluator.evaluate(markdown_cv=case.markdown_cv, items=items)
    record.add_evaluation_result(EvaluationResult(
        evaluator_name=eval_out.evaluator_name,
        score=eval_out.score,
        reasoning=eval_out.reasoning,
    ))

    try:
        # Basic threshold; can be adjusted per-case later if needed
        assert eval_out.meets_requirements, f"Evaluator failed: {eval_out.reasoning}"
        assert eval_out.score >= 70, f"Low score: {eval_out.score} reasoning: {eval_out.reasoning}"
        if failures:
            pytest.fail("\n".join(failures))
    finally:
        out_folder = common_folder_path + f"cv_parser_{case.name}"
        record.save_data(folder=out_folder, base_file_name="evaluation_record")



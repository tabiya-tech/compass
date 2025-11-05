import os
import logging
from pathlib import Path

import pytest
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationRecord, EvaluationResult
from evaluation_tests.cv_extraction_quality.responsibilities_evaluator import (
    ResponsibilitiesEvaluator,
    ResponsibilitiesPrecisionRecallOutput,
)


def _list_cv_inputs() -> list[Path]:
    dataset_dir = Path(__file__).parent
    pdf_dir = dataset_dir.parent / "cv_parser" / "test_inputs"
    cases: list[Path] = []
    if pdf_dir.exists():
        cases.extend(sorted(pdf_dir.glob("*.pdf")))
    return cases


CASES = _list_cv_inputs()
assert CASES, "No CV PDFs found under evaluation_tests/cv_parser/test_inputs. Please add at least one .pdf CV."


class CVResponsibilitiesEvaluationRecord(EvaluationRecord):
    cv_name: str
    markdown_cv: str
    per_experience_results: list[str]
    averages: dict

    def _to_markdown(self) -> str:
        lines = "\n".join(self.per_experience_results) or "(no experiences evaluated)"
        avg_line = f"precision={self.averages.get('precision', 0):.2f}, recall={self.averages.get('recall', 0):.2f}"
        return (f"# Test case: {self.test_case}\n\n"
                f"## CV: {self.cv_name}\n\n"
                f"## Input CV (markdown)\n{self.markdown_cv}\n\n"
                f"## Per-experience results\n{lines}\n\n"
                f"## Averages\n{avg_line}\n\n"
                f"## Evaluations\n{self._get_evaluations_str()}")


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-pro")
@pytest.mark.repeat(1)
@pytest.mark.parametrize("cv_input_path", CASES, ids=[p.name for p in CASES] if CASES else None)
async def test_cv_extraction_quality_precision_recall(cv_input_path: Path, common_folder_path: str):
    from app.users.cv.utils.cv_structured_extractor import CVStructuredExperienceExtractor
    from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown

    logger = logging.getLogger("CVExtractionQualityEvaluator")
    extractor = CVStructuredExperienceExtractor(logger)
    # Load and convert a single input
    if cv_input_path.suffix.lower() == ".pdf":
        cv_markdown = convert_cv_bytes_to_markdown(cv_input_path.read_bytes(), cv_input_path.name, logger)
    else:
        cv_markdown = cv_input_path.read_text(encoding="utf-8")

    evaluator = ResponsibilitiesEvaluator()
    evaluations: list[ResponsibilitiesPrecisionRecallOutput] = []
    per_exp_lines: list[str] = []
    extraction = await extractor.extract_structured_experiences(cv_markdown)
    for exp in extraction.experience_entities:
        responsibilities = exp.responsibilities.responsibilities or []
        if not responsibilities:
            continue
        evaluation = await evaluator.evaluate(
            markdown_cv=cv_markdown,
            experience_title=exp.experience_title,
            company=exp.company,
            responsibilities=responsibilities,
        )
        evaluations.append(evaluation)
        per_exp_lines.append(
            f"- {exp.experience_title} at {exp.company or 'Unknown'}: precision={evaluation.precision:.2f}, "
            f"recall={evaluation.recall:.2f} — {evaluation.justification}"
        )

    assert evaluations, "No evaluations were produced."
    avg_prec = sum(e.precision for e in evaluations) / len(evaluations)
    avg_rec = sum(e.recall for e in evaluations) / len(evaluations)

    assert avg_prec >= 0.2 or avg_rec >= 0.2, f"Low scores: precision={avg_prec:.2f}, recall={avg_rec:.2f}"

    # Save evaluation record in the standard format
    record = CVResponsibilitiesEvaluationRecord(
        test_case=f"cv_extraction_quality_{cv_input_path.name}",
        cv_name=cv_input_path.name,
        markdown_cv=cv_markdown,
        per_experience_results=per_exp_lines,
        averages={"precision": avg_prec, "recall": avg_rec},
    )
    record.add_evaluation_result(EvaluationResult(
        evaluator_name="ResponsibilitiesPrecisionRecall",
        score=int(round(100 * max(avg_prec, avg_rec))),
        reasoning=f"precision={avg_prec:.2f}, recall={avg_rec:.2f}",
    ))
    out_folder = os.path.join(common_folder_path, f"cv_extraction_quality_{cv_input_path.stem}")
    record.save_data(folder=out_folder, base_file_name="evaluation_record")



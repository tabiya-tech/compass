import json
import logging
from pathlib import Path
from typing import Optional

import pytest
from pydantic import BaseModel

from app.users.cv.utils.cv_structured_extractor import CVStructuredExperienceExtractor
from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig
from common_libs.text_formatters import extract_json


evaluation_test = pytest.mark.evaluation_test
repeat = pytest.mark.repeat


class SkillsRelevanceEvaluation(BaseModel):
    relevance: float
    justification: str
    suggested_skills: list[str]


async def _evaluate_skills_relevance(
    llm: GeminiGenerativeLLM,
    cv_text: str,
    experience_title: str,
    company: Optional[str],
    responsibilities: list[str],
) -> SkillsRelevanceEvaluation:
    prompt = f"""
You are an expert career evaluator. Assess whether the listed responsibilities imply relevant professional skills.

CONTEXT - CV MARKDOWN:
{cv_text}

EXPERIENCE:
Title: {experience_title}
Company: {company or ""}
Responsibilities:
{json.dumps(responsibilities, indent=2)}

Provide a JSON with:
- relevance: number between 0 and 1 indicating how well responsibilities imply concrete, real-world skills
- justification: a brief reason
- suggested_skills: up to 5 specific skills the responsibilities clearly suggest (strings)
"""
    response = await llm.generate_content(prompt)
    return extract_json.extract_json(response.text, SkillsRelevanceEvaluation)


def _list_cv_inputs() -> list[Path]:
    dataset_dir = Path(__file__).parent
    pdf_dir = dataset_dir.parent / "cv_parser" / "test_inputs"
    cases: list[Path] = []
    if pdf_dir.exists():
        cases.extend(sorted(pdf_dir.glob("*.pdf")))
    return cases


CASES = _list_cv_inputs()
assert CASES, "No CV PDFs found under evaluation_tests/cv_parser/test_inputs. Please add at least one .pdf CV."


@pytest.fixture(scope="module", params=[pytest.param(f, id=f.name) for f in CASES])
def cv_file_path(request) -> Path:
    return request.param


@pytest.mark.asyncio
@evaluation_test
@repeat(1)
async def test_cv_skills_relevance_from_responsibilities(cv_file_path: Path):
    logger = logging.getLogger("CVSkillsRelevanceEvaluator")
    extractor = CVStructuredExperienceExtractor(logger)

    if cv_file_path.suffix.lower() == ".pdf":
        file_bytes = cv_file_path.read_bytes()
        cv_markdown = convert_cv_bytes_to_markdown(file_bytes, cv_file_path.name, logger)
    else:
        cv_markdown = cv_file_path.read_text(encoding="utf-8")

    extraction = await extractor.extract_structured_experiences(cv_markdown)

    # Use LLM to judge per-experience skills relevance implied by responsibilities
    llm = GeminiGenerativeLLM(config=LLMConfig(language_model_name="gemini-2.5-pro"))
    evaluations: list[SkillsRelevanceEvaluation] = []
    total_responsibilities = 0
    for exp in extraction.experience_entities:
        responsibilities = exp.responsibilities.responsibilities or []
        if not responsibilities:
            continue
        total_responsibilities += len(responsibilities)
        eval_item = await _evaluate_skills_relevance(
            llm=llm,
            cv_text=cv_markdown,
            experience_title=exp.experience_title,
            company=exp.company,
            responsibilities=responsibilities,
        )
        evaluations.append(eval_item)

    # Skip very sparse CVs that do not provide enough responsibilities for a meaningful evaluation
    if total_responsibilities < 3:
        pytest.skip(f"Skipping {cv_file_path.name}: not enough responsibilities for evaluation (found {total_responsibilities}).")

    assert evaluations, f"No skills relevance evaluations were produced for {cv_file_path.name}."
    avg_relevance = sum(e.relevance for e in evaluations) / len(evaluations)

    # Minimal threshold for now; refine prompt later
    assert avg_relevance >= 0.2, f"Low skills relevance for {cv_file_path.name}: {avg_relevance:.2f}"



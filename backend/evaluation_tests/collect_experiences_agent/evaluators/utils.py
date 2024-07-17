from typing import Optional
from pydantic.main import BaseModel

from evaluation_tests.collect_experiences_agent.evaluators.evaluation_criteria import CollectExperiencesEvaluationCriteria

class EvaluatorOutput(BaseModel):
    """
    Class used to parse the json returned from the llm evaluator.
    """
    score: int
    reason: str


class CollectExperienceEvaluationResult(BaseModel):
    """
    The result of the evaluation.
    """
    type: CollectExperiencesEvaluationCriteria
    reason: str
    score: Optional[int] = None
    result: Optional[str] = None

from enum import Enum


class EvaluationType(Enum):
    """
    An enumeration for Evaluation types
    """
    CONCISENESS = "Conciseness"
    RELEVANCE = "Relevance"
    CORRECTNESS = "Correctness"
    COHERENCE = "Coherence"
"""
Persona Detection Module for Milestone 2

Detects user persona type based on verbal cues in conversation.
CV upload integration is deferred to Milestone 4.

Persona Types:
- INFORMAL (Persona 1): Task-oriented descriptions, informal workers
- FORMAL (Persona 2): Structured descriptions with formal employment vocabulary

Detection Strategy:
- Analyze user messages for formal/informal indicators
- Default to INFORMAL (safer for informal workers)
- Can be refined with more context over the conversation
"""

from enum import Enum
from typing import Optional
import re


class PersonaType(Enum):
    """User persona classification for conversation flow optimization."""
    INFORMAL = "informal"  # Persona 1: Task-oriented, informal workers
    FORMAL = "formal"      # Persona 2: Formal/mixed employment background


# Keywords indicating formal employment background (Persona 2)
FORMAL_INDICATORS = [
    # Job structure terms
    "title", "position", "department", "responsibilities",
    "role", "duties", "job description",
    # Management/hierarchy terms
    "managed", "reported to", "team lead", "supervisor",
    "manager", "director", "head of", "in charge of",
    # Organization terms
    "company", "organization", "corporation", "firm",
    "enterprise", "institution", "agency",
    # Formal employment terms
    "employed", "employment", "contract", "permanent",
    "full-time", "part-time", "salary", "benefits",
    # CV-like terms
    "resume", "cv", "curriculum", "qualifications",
    "certifications", "degree", "diploma",
]

# Keywords indicating informal work background (Persona 1)
INFORMAL_INDICATORS = [
    # Task-oriented descriptions
    "tasks", "daily work", "what i did", "what i do",
    "helped with", "worked on", "did some",
    # Informal work contexts
    "hustle", "side job", "gig", "odd jobs",
    "casual", "temporary", "seasonal",
    # Community/family work
    "family", "neighbor", "community", "volunteer",
    "helped out", "assisted", "took care of",
    # Informal business
    "my own", "small business", "selling", "trading",
    "street", "market", "shop",
]

# Weights for detection (higher = stronger signal)
FORMAL_WEIGHT = 1.0
INFORMAL_WEIGHT = 0.8  # Slightly lower weight since informal is default


def detect_persona(
    user_message: str,
    conversation_history: Optional[list[str]] = None,
    threshold: float = 0.5
) -> PersonaType:
    """
    Detect user persona based on verbal cues in the message.
    
    Args:
        user_message: The current user message to analyze
        conversation_history: Optional list of previous user messages for context
        threshold: Score threshold for formal detection (default 0.5)
    
    Returns:
        PersonaType.FORMAL if formal indicators exceed threshold
        PersonaType.INFORMAL otherwise (default)
    
    Note:
        CV upload detection is deferred to Milestone 4.
        For M2, detection is purely verbal/text-based.
    """
    # Combine current message with history for better context
    all_text = user_message.lower()
    if conversation_history:
        all_text = " ".join([msg.lower() for msg in conversation_history]) + " " + all_text
    
    # Calculate scores
    formal_score = _calculate_indicator_score(all_text, FORMAL_INDICATORS, FORMAL_WEIGHT)
    informal_score = _calculate_indicator_score(all_text, INFORMAL_INDICATORS, INFORMAL_WEIGHT)
    
    # Normalize scores
    total_score = formal_score + informal_score
    if total_score == 0:
        return PersonaType.INFORMAL  # Default when no indicators found
    
    formal_ratio = formal_score / total_score
    
    # Return FORMAL only if clearly above threshold
    if formal_ratio > threshold:
        return PersonaType.FORMAL
    
    return PersonaType.INFORMAL  # Default - safer for informal workers


def _calculate_indicator_score(text: str, indicators: list[str], weight: float) -> float:
    """
    Calculate weighted score based on indicator presence in text.
    
    Uses word boundary matching to avoid partial matches.
    """
    score = 0.0
    for indicator in indicators:
        # Use word boundary regex for accurate matching
        pattern = r'\b' + re.escape(indicator) + r'\b'
        matches = len(re.findall(pattern, text, re.IGNORECASE))
        if matches > 0:
            # Diminishing returns for repeated indicators
            score += weight * (1 + 0.2 * (matches - 1))
    return score


def get_persona_description(persona: PersonaType) -> str:
    """Get a human-readable description of the persona type."""
    descriptions = {
        PersonaType.INFORMAL: (
            "Informal worker - may describe work in terms of tasks and activities, "
            "less formal job structures, may include community/family work"
        ),
        PersonaType.FORMAL: (
            "Formal/mixed worker - describes work with formal employment vocabulary, "
            "mentions job titles, departments, organizations"
        ),
    }
    return descriptions.get(persona, "Unknown persona type")


def get_persona_prompt_hints(persona: PersonaType) -> dict[str, str]:
    """
    Get prompt customization hints based on detected persona.
    
    Returns dict with keys for different prompt sections that should be adjusted.
    """
    if persona == PersonaType.INFORMAL:
        return {
            "language_style": "Use simpler language, more examples and scaffolding",
            "question_style": "Ask about 'tasks you did' rather than 'responsibilities'",
            "assumptions": "Don't assume formal job titles or organizational structures",
            "examples": "Include examples like 'helping family', 'casual work', 'daily tasks'",
        }
    else:  # FORMAL
        return {
            "language_style": "Can use professional language, be efficient",
            "question_style": "Can ask about 'responsibilities', 'role', 'achievements'",
            "assumptions": "Can assume familiarity with formal employment concepts",
            "examples": "Include examples like 'job title', 'department', 'team'",
        }

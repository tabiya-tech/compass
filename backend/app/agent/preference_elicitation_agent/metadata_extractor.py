"""
Metadata extraction from user vignette responses.

Extracts QUALITATIVE patterns from HOW users reason about choices,
not WHAT they chose (which Bayesian handles).

This captures unbiased metadata like decision patterns, values signals,
and explicitly stated constraints.
"""

from typing import Any
from pydantic import BaseModel, Field
import logging

from app.agent.llm_caller import LLMCaller
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import (
    LLMConfig,
    LOW_TEMPERATURE_GENERATION_CONFIG,
    JSON_GENERATION_CONFIG
)


class QualitativeMetadata(BaseModel):
    """
    Qualitative metadata extracted from user's reasoning patterns.

    Focuses on HOW they reason, not WHAT they chose.
    These patterns are unbiased - they don't depend on vignette attribute values.
    """

    decision_patterns: dict[str, Any] = Field(default_factory=dict)
    """Patterns in how user makes decisions (frequency of certain themes)"""

    tradeoff_willingness: dict[str, bool] = Field(default_factory=dict)
    """Explicit tradeoffs user mentions (willing/unwilling to make)"""

    values_signals: dict[str, bool] = Field(default_factory=dict)
    """Deep values expressed beyond job attributes"""

    consistency_indicators: dict[str, float] = Field(default_factory=dict)
    """Consistency/conviction in responses (0-1)"""

    extracted_constraints: dict[str, Any] = Field(default_factory=dict)
    """Hard constraints explicitly stated (not inferred from choices)"""

    reasoning: str = ""
    """Chain of thought for metadata extraction"""

    class Config:
        extra = "forbid"


# System instructions for metadata extraction LLM
_METADATA_EXTRACTION_PROMPT = """
<System Instructions>
#Role
You are a behavioral psychologist analyzing HOW people reason about job choices, not WHAT they choose.

#Task
Analyze the user's reasoning across vignette responses to extract qualitative patterns and deep values.

#Critical Constraints
1. **NO BIAS FROM VIGNETTE VALUES**: Do NOT extract specific salary numbers, commute times, or job titles
2. **EXPLICIT ONLY**: Only extract what user EXPLICITLY states, never infer
3. **PATTERNS NOT CHOICES**: Look at HOW they talk, not WHAT option they picked
4. **CUMULATIVE**: Patterns emerge from multiple responses (e.g., "mentions family 3+ times")

#What to Extract

## 1. DECISION PATTERNS (frequency-based, requires 3+ mentions)
Patterns in language/themes user repeats across responses:

Examples to look for:
- "mentions_family_frequently": true (if "family", "kids", "children" appear 3+ times across responses)
- "uses_financial_language": true (if "salary", "money", "pay", "compensation" appear 5+ times)
- "career_growth_focused": true (if "growth", "learning", "advancement", "development" appear 3+ times)
- "uses_absolute_language": true (if "never", "always", "must", "cannot" appear 2+ times)
- "uses_hedging_language": true (if "maybe", "perhaps", "depends", "not sure" appear 3+ times)

**DO NOT extract if mentioned only once or twice - patterns need repetition!**

## 2. TRADEOFF WILLINGNESS (explicit statements only)
User EXPLICITLY states they are willing/unwilling to make a tradeoff:

Valid examples:
- "I would sacrifice salary for flexibility" → "will_sacrifice_salary_for_flexibility": true
- "I will NOT compromise on work-life balance" → "will_not_compromise_work_life_balance": true
- "I'm open to relocating if the growth opportunity is good" → "open_to_relocation_for_growth": true
- "I prefer stability even if it means lower pay" → "prefers_stability_over_high_pay": true

Invalid examples (too vague):
- "I like flexibility" → NOT a tradeoff statement
- "Salary matters to me" → NOT a tradeoff statement

## 3. VALUES SIGNALS (deep motivations beyond job attributes)
Deep values user expresses in their reasoning:

Examples:
- Mentions "helping people", "making a difference", "serving community" → "altruistic": true
- Mentions "impact", "meaning", "purpose", "contribute" → "purpose_driven": true
- Mentions "family security", "kids' future", "providing for dependents" → "family_provider": true
- Mentions "independence", "freedom", "control", "autonomy" → "autonomy_seeking": true
- Mentions "security", "predictability", "stability", "safety" → "stability_seeking": true

**ONLY extract if user mentions these themes, not if you infer from choices!**

## 4. CONSISTENCY INDICATORS (0-1 scores)
Measure consistency and conviction:

- "response_consistency": 0.0-1.0
  * 1.0: All responses align, no contradictions
  * 0.5: Some contradictions or uncertainty
  * 0.0: Contradictory preferences across vignettes

- "conviction_strength": 0.0-1.0
  * 1.0: Uses decisive language ("definitely", "absolutely", "must have")
  * 0.5: Neutral language
  * 0.0: Very uncertain language ("I guess", "not sure", "maybe")

- "preference_stability": 0.0-1.0
  * 1.0: Same preferences across all vignettes
  * 0.5: Some evolution in preferences
  * 0.0: Preferences change dramatically between vignettes

## 5. EXTRACTED CONSTRAINTS (explicitly stated hard requirements)
User EXPLICITLY states a hard constraint (not inferred from choices):

Valid examples:
- "I MUST work remotely, I cannot commute" → "must_work_remotely": true
- "I cannot work weekends due to family commitments" → "cannot_work_weekends": true
- "I need to stay in Nairobi for my kids' school" → "needs_job_in_nairobi": true

Invalid examples (inferred, not explicit):
- User chose remote job → DO NOT add "must_work_remotely"
- User chose high salary → DO NOT add "minimum_salary": X

#Examples of GOOD Extraction

**User responses across 5 vignettes:**
1. "I'd choose the remote job because commuting would take time away from my kids"
2. "The flexible hours option is better - I need to pick up my children from school"
3. "I prefer option A because I value family time over extra money"
4. "Maybe the first one, I think... family is important to me"
5. "I MUST have work-life balance, I cannot sacrifice time with my family"

**Good extraction:**
```json
{
    "decision_patterns": {
        "mentions_family_frequently": true,  // "family/kids/children" appear 5 times
        "uses_hedging_language": true  // "maybe", "I think" appear 2+ times
    },
    "tradeoff_willingness": {
        "will_sacrifice_salary_for_flexibility": true,  // Vignette 3 explicitly states
        "will_not_compromise_work_life_balance": true  // Vignette 5 explicitly states
    },
    "values_signals": {
        "family_provider": true  // Strong pattern of family-focused reasoning
    },
    "consistency_indicators": {
        "response_consistency": 0.95,  // All responses align around family/balance
        "conviction_strength": 0.8,  // Mostly decisive, some hedging
        "preference_stability": 0.9  // Same preference (family > money) throughout
    },
    "extracted_constraints": {
        "must_have_work_life_balance": true  // Explicitly stated in vignette 5
    }
}
```

#Examples of BAD Extraction (What NOT to do)

**User chose high-salary job:**
```json
{
    "extracted_constraints": {
        "minimum_salary": 80000  // ❌ WRONG! This is anchored to vignette value
    }
}
```

**User mentioned flexibility once:**
```json
{
    "decision_patterns": {
        "values_flexibility": true  // ❌ WRONG! Need 3+ mentions for pattern
    }
}
```

**User chose remote job:**
```json
{
    "tradeoff_willingness": {
        "prefers_remote_work": true  // ❌ WRONG! This is not an explicit tradeoff statement
    }
}
```

#Output Format
Return a JSON object with the structure defined in QualitativeMetadata.

Only include fields where you have POSITIVE evidence (do not include empty dicts).

Always include "reasoning" explaining your extraction logic.

#Remember
- EXPLICIT statements only, never infer
- PATTERNS need repetition (3+ mentions)
- NO vignette-specific values (salaries, times, locations from vignettes)
- Focus on HOW they reason, not WHAT they chose
</System Instructions>
"""


class MetadataExtractor:
    """Extracts qualitative metadata from user vignette responses."""

    def __init__(self):
        """Initialize the MetadataExtractor with LLM."""
        self._logger = logging.getLogger(self.__class__.__name__)

        # Create LLM with metadata extraction instructions
        llm_config = LLMConfig(
            generation_config=LOW_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG
        )

        self._metadata_llm = GeminiGenerativeLLM(
            system_instructions=_METADATA_EXTRACTION_PROMPT,
            config=llm_config
        )

        # Create LLM caller (only needs model_response_type at init)
        self._caller = LLMCaller[QualitativeMetadata](
            model_response_type=QualitativeMetadata
        )

    async def extract_metadata(
        self,
        all_user_responses: list[str],
        conversation_history: str = ""
    ) -> QualitativeMetadata:
        """
        Extract qualitative metadata from cumulative user responses.

        Args:
            all_user_responses: All user responses to vignettes so far
            conversation_history: Optional conversation context

        Returns:
            QualitativeMetadata with extracted patterns and values
        """
        # Build prompt with all responses
        prompt = f"""
Analyze the user's reasoning across {len(all_user_responses)} vignette responses.

**All User Responses:**
"""
        for i, response in enumerate(all_user_responses, 1):
            prompt += f"\n{i}. {response}"

        if conversation_history:
            prompt += f"\n\n**Additional Context:**\n{conversation_history}"

        prompt += "\n\nExtract qualitative metadata following the system instructions."

        try:
            result, _ = await self._caller.call_llm(
                llm=self._metadata_llm,
                llm_input=prompt,
                logger=self._logger
            )
            self._logger.info(f"Extracted metadata: {result.model_dump_json(indent=2)}")
            return result
        except Exception as e:
            self._logger.error(f"Metadata extraction failed: {e}", exc_info=True)
            # Return empty metadata on failure
            return QualitativeMetadata()

"""
User Context Extractor for Preference Elicitation Agent.

Extracts user context (role, industry, experience level) from experiences
to enable personalized vignette generation.
"""

import logging
from typing import Optional

from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.preference_elicitation_agent.types import UserContext
from app.agent.llm_caller import LLMCaller
from common_libs.llm.models_utils import (
    BasicLLM,
    LLMConfig,
    LOW_TEMPERATURE_GENERATION_CONFIG,
    JSON_GENERATION_CONFIG
)
from pydantic import BaseModel, Field


class ExtractedUserContext(BaseModel):
    """LLM response model for user context extraction."""

    current_role: Optional[str] = Field(
        default=None,
        description="Current or most recent job role (e.g., 'Software Developer', 'Teacher', 'Sales Associate')"
    )

    industry: Optional[str] = Field(
        default=None,
        description="Industry/sector (e.g., 'Technology', 'Education', 'Retail', 'Healthcare')"
    )

    experience_level: str = Field(
        default="junior",
        description="Career experience level: 'entry', 'junior', 'mid', 'senior', or 'expert'"
    )

    key_experiences: list[str] = Field(
        default_factory=list,
        description="List of key past experiences or employers"
    )

    background_summary: Optional[str] = Field(
        default=None,
        description="Brief 1-2 sentence summary of professional background"
    )


class UserContextExtractor:
    """
    Extracts user context from experiences to personalize vignettes.

    Uses LLM to analyze user's work history and extract:
    - Current/most recent role
    - Industry/sector
    - Experience level
    - Key experiences
    - Brief background summary
    """

    def __init__(self, llm: BasicLLM):
        """
        Initialize the UserContextExtractor.

        Args:
            llm: Language model to use for extraction (base LLM without system instructions)
        """
        self._logger = logging.getLogger(self.__class__.__name__)
        self._base_llm = llm

        # Create LLM with system instructions for context extraction
        from common_libs.llm.generative_models import GeminiGenerativeLLM

        system_instructions = """
You are analyzing a user's work experience to extract key context for personalizing career guidance.

Extract the following information:
1. **Current Role**: Their most recent or current job title/role
2. **Industry**: The industry/sector they work in or are most familiar with
3. **Experience Level**: Assess as 'entry' (0-1 years), 'junior' (1-3 years), 'mid' (3-7 years), 'senior' (7-15 years), or 'expert' (15+ years)
4. **Key Experiences**: List of notable employers or roles (max 3)
5. **Background Summary**: A brief 1-2 sentence summary of their professional background

Be concise and focus on information that would help personalize job scenarios.
If information is unclear or missing, make reasonable inferences based on what's available.

For Kenyan context, recognize local companies and roles:
- Safaricom, Equity Bank, KCB, M-PESA = Technology/Finance
- Teaching roles = Education
- Shop/retail roles = Retail
- Matatu conductor, driver = Transportation

Output Schema:
You must return a JSON object with exactly these fields:
- current_role (string or null): Most recent job title (e.g., "Software Developer", "Teacher")
- industry (string or null): Industry/sector (e.g., "Technology", "Education", "Retail")
- experience_level (string): One of: "entry", "junior", "mid", "senior", or "expert"
- key_experiences (array of strings): List of notable employers or roles (max 3)
- background_summary (string or null): Brief 1-2 sentence summary of their background

Example Output:
{
  "current_role": "Freelance Web Designer",
  "industry": "Technology",
  "experience_level": "junior",
  "key_experiences": ["TechCorp Kenya", "Freelance Web Designer", "Local Retail Store"],
  "background_summary": "A junior software developer transitioning into freelance web design after initial experience in retail and corporate tech."
}
"""

        # Use proper JSON generation config
        llm_config = LLMConfig(
            generation_config=LOW_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG
        )

        self._llm = GeminiGenerativeLLM(
            system_instructions=system_instructions,
            config=llm_config
        )

    async def extract_context(
        self,
        experiences: Optional[list[ExperienceEntity]]
    ) -> UserContext:
        """
        Extract user context from experiences.

        Args:
            experiences: List of user's work experiences

        Returns:
            UserContext with extracted information
        """
        if not experiences or len(experiences) == 0:
            # No experiences - return default context
            self._logger.info("No experiences provided, using default context")
            return UserContext()

        # Format experiences for LLM
        experiences_text = self._format_experiences(experiences)
        self._logger.info(f"Formatted experiences for extraction:\n{experiences_text}")

        # Extract context using LLM
        try:
            extracted = await self._call_llm_for_extraction(experiences_text)
            self._logger.info(f"LLM extraction result: {extracted}")

            # Convert to UserContext
            context = UserContext(
                current_role=extracted.current_role,
                industry=extracted.industry,
                experience_level=extracted.experience_level,  # type: ignore
                key_experiences=extracted.key_experiences,
                background_summary=extracted.background_summary
            )

            self._logger.info(
                f"Extracted context: role={context.current_role}, "
                f"industry={context.industry}, level={context.experience_level}"
            )

            return context

        except Exception as e:
            self._logger.error(f"Error extracting context: {e}, using default", exc_info=True)
            return UserContext()

    def _format_experiences(self, experiences: list[ExperienceEntity]) -> str:
        """
        Format experiences into text for LLM analysis.

        Args:
            experiences: List of experiences

        Returns:
            Formatted text describing experiences
        """
        if not experiences:
            return "No work experience provided."

        # Sort by most recent first (if dates available)
        sorted_experiences = sorted(
            experiences,
            key=lambda exp: (
                exp.timeline.end if exp.timeline and exp.timeline.end else "9999-12"
            ),
            reverse=True
        )

        formatted = []
        for exp in sorted_experiences:
            # Build experience description
            parts = []

            if exp.experience_title:
                parts.append(f"Role: {exp.experience_title}")

            if exp.company:
                parts.append(f"Company: {exp.company}")

            if exp.timeline:
                if exp.timeline.start:
                    parts.append(f"From: {exp.timeline.start}")
                if exp.timeline.end:
                    parts.append(f"To: {exp.timeline.end}")
                else:
                    parts.append("To: Present")

            if hasattr(exp, 'responsibilities') and exp.responsibilities:
                if hasattr(exp.responsibilities, 'responsibilities'):
                    # ResponsibilitiesData object
                    parts.append(f"Responsibilities: {', '.join(exp.responsibilities.responsibilities)}")
                elif isinstance(exp.responsibilities, list):
                    # List of strings
                    parts.append(f"Responsibilities: {', '.join(exp.responsibilities)}")

            formatted.append(" | ".join(parts))

        return "\n".join(formatted)

    async def _call_llm_for_extraction(
        self,
        experiences_text: str
    ) -> ExtractedUserContext:
        """
        Call LLM to extract context from experiences text.

        Args:
            experiences_text: Formatted text of experiences

        Returns:
            Extracted user context
        """
        caller = LLMCaller[ExtractedUserContext](
            model_response_type=ExtractedUserContext
        )

        response, _ = await caller.call_llm(
            llm=self._llm,
            llm_input=f"Analyze this work experience:\n\n{experiences_text}",
            logger=self._logger
        )

        if response is None:
            # Failed to extract, return default
            return ExtractedUserContext()

        return response

"""
Vignette Personalizer for Preference Elicitation Agent.

Generates personalized vignettes based on user context and vignette templates.
"""

import logging
import json
import uuid
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field

from app.agent.preference_elicitation_agent.types import (
    UserContext,
    VignetteTemplate,
    PersonalizedVignette,
    Vignette,
    VignetteOption
)
from app.agent.llm_caller import LLMCaller
from common_libs.llm.models_utils import (
    BasicLLM,
    LLMConfig,
    LOW_TEMPERATURE_GENERATION_CONFIG,
    JSON_GENERATION_CONFIG
)


class GeneratedVignetteContent(BaseModel):
    """LLM response model for generated vignette content."""

    scenario_intro: str = Field(
        description="Brief introduction to the scenario (1-2 sentences)"
    )

    option_a_title: str = Field(
        description="Short job title for option A (e.g., 'Senior Developer at Safaricom')"
    )

    option_a_description: str = Field(
        description="Detailed description of option A (3-5 sentences)"
    )

    option_b_title: str = Field(
        description="Short job title for option B (e.g., 'Freelance Software Engineer')"
    )

    option_b_description: str = Field(
        description="Detailed description of option B (3-5 sentences)"
    )

    reasoning: str = Field(
        default="",
        description="Brief explanation of how this was personalized (for debugging)"
    )


class VignettePersonalizer:
    """
    Personalizes vignette templates to match user's background.

    Uses LLM to generate job scenarios relevant to the user's role,
    industry, and experience level while maintaining the core trade-offs
    defined in the template.
    """

    def __init__(self, llm: BasicLLM, templates_config_path: Optional[str] = None):
        """
        Initialize the VignettePersonalizer.

        Args:
            llm: Language model to use for generation (base LLM without system instructions)
            templates_config_path: Path to vignette templates JSON file
        """
        self._logger = logging.getLogger(self.__class__.__name__)
        self._base_llm = llm
        self._templates: list[VignetteTemplate] = []
        self._templates_by_id: dict[str, VignetteTemplate] = {}
        self._templates_by_category: dict[str, list[VignetteTemplate]] = {}

        # Create LLM with system instructions for vignette generation
        from common_libs.llm.generative_models import GeminiGenerativeLLM

        system_instructions = """
You are helping personalize career preference questions for Kenyan youth.

Your task: Generate TWO realistic job scenario options that:
1. Are relevant to the user's background (same or adjacent industry/role)
2. Match the user's experience level
3. Maintain the exact trade-offs specified in the template
4. Feel personalized and realistic for this specific person
5. Use Kenyan context (companies, salary ranges in KES, local considerations)
6. Are DIFFERENT from previously shown scenarios

Guidelines:
- Use realistic Kenyan companies or job types
- Salary ranges should be realistic for Kenya (e.g., 40K-150K KES/month)
- Include local context (commute in Nairobi traffic, M-PESA, NHIF, etc.)
- Make jobs feel relevant to THEIR background, not generic
- Keep descriptions clear and concise (3-5 sentences each)
- Ensure the trade-off is meaningful and balanced

Examples of good personalization:
- Software Developer background → Compare "Senior Engineer at Safaricom" vs "Freelance Developer"
- Teacher background → Compare "Teacher at private school" vs "Tutor at education startup"
- Retail background → Compare "Shop Manager" vs "Online Retail Coordinator"

Output Schema:
You must return a JSON object with exactly these fields:
- scenario_intro (string): Brief introduction to the scenario (1-2 sentences)
- option_a_title (string): Short job title for option A (e.g., "Senior Developer at Safaricom")
- option_a_description (string): Detailed description of option A (3-5 sentences)
- option_b_title (string): Short job title for option B (e.g., "Freelance Software Engineer")
- option_b_description (string): Detailed description of option B (3-5 sentences)
- reasoning (string): Brief explanation of how this was personalized

Example Output:
{
  "scenario_intro": "Imagine you have two job offers in the software development field.",
  "option_a_title": "Backend Developer at Safaricom",
  "option_a_description": "You'd work as a Backend Developer at Safaricom's headquarters in Nairobi. The salary is KES 120,000 per month with full benefits including NHIF and NSSF. The role offers excellent job security and clear career progression, but requires being in the office 5 days a week during peak Nairobi traffic hours.",
  "option_b_title": "Freelance Full-Stack Developer",
  "option_b_description": "You'd work as a freelance developer taking on projects from various clients. Your income could range from KES 80,000 to KES 200,000 per month depending on projects secured. You have complete flexibility in schedule and location, but income is variable and you're responsible for your own benefits and finding clients.",
  "reasoning": "Personalized for software developer background with scenarios relevant to Kenya's tech industry. Maintains job security vs. income flexibility trade-off."
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

        # Load templates from config
        if templates_config_path is None:
            # Default path relative to backend root
            config_dir = Path(__file__).parent.parent.parent / "config"
            templates_config_path = str(config_dir / "vignette_templates.json")

        self._load_templates(templates_config_path)

    def _load_templates(self, config_path: str) -> None:
        """
        Load vignette templates from JSON configuration file.

        Args:
            config_path: Path to templates configuration file
        """
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                templates_data = json.load(f)

            for template_data in templates_data:
                template = VignetteTemplate(**template_data)
                self._templates.append(template)
                self._templates_by_id[template.template_id] = template

                # Index by category
                category = template.category
                if category not in self._templates_by_category:
                    self._templates_by_category[category] = []
                self._templates_by_category[category].append(template)

            self._logger.info(f"Loaded {len(self._templates)} templates from {config_path}")

        except FileNotFoundError:
            self._logger.error(f"Templates config file not found: {config_path}")
            raise
        except json.JSONDecodeError as e:
            self._logger.error(f"Invalid JSON in templates config: {e}")
            raise
        except Exception as e:
            self._logger.error(f"Error loading templates: {e}")
            raise

    def get_templates_by_category(self, category: str) -> list[VignetteTemplate]:
        """
        Get all templates for a specific category.

        Args:
            category: Category name (e.g., "financial", "work_environment")

        Returns:
            List of templates in that category
        """
        return self._templates_by_category.get(category, [])

    def get_template_by_id(self, template_id: str) -> Optional[VignetteTemplate]:
        """
        Get a specific template by ID.

        Args:
            template_id: Unique identifier for the template

        Returns:
            VignetteTemplate or None if not found
        """
        return self._templates_by_id.get(template_id)

    async def personalize_vignette(
        self,
        template: VignetteTemplate,
        user_context: UserContext,
        previous_vignettes: Optional[list[str]] = None
    ) -> PersonalizedVignette:
        """
        Generate a personalized vignette from a template.

        Args:
            template: The vignette template to personalize
            user_context: User's background context
            previous_vignettes: List of previous vignette scenarios (to avoid repetition)

        Returns:
            PersonalizedVignette with generated content
        """
        # Generate personalized content using LLM
        generated = await self._generate_vignette_content(
            template=template,
            user_context=user_context,
            previous_vignettes=previous_vignettes or []
        )

        # Build VignetteOption objects
        option_a = VignetteOption(
            option_id="A",
            title=generated.option_a_title,
            description=generated.option_a_description,
            attributes=template.option_a  # Use template attributes
        )

        option_b = VignetteOption(
            option_id="B",
            title=generated.option_b_title,
            description=generated.option_b_description,
            attributes=template.option_b  # Use template attributes
        )

        # Build personalized Vignette with unique ID per generation
        # Use template_id + a unique suffix to ensure each generated vignette is tracked separately
        unique_suffix = str(uuid.uuid4())[:8]
        vignette = Vignette(
            vignette_id=f"{template.template_id}_{unique_suffix}",
            category=template.category,
            scenario_text=generated.scenario_intro,
            options=[option_a, option_b],
            follow_up_questions=template.follow_up_prompts,
            targeted_dimensions=template.targeted_dimensions,
            difficulty_level=template.difficulty_level
        )

        return PersonalizedVignette(
            template_id=template.template_id,
            vignette=vignette,
            generation_context={
                "user_role": user_context.current_role,
                "user_industry": user_context.industry,
                "user_level": user_context.experience_level,
                "reasoning": generated.reasoning
            }
        )

    async def _generate_vignette_content(
        self,
        template: VignetteTemplate,
        user_context: UserContext,
        previous_vignettes: list[str]
    ) -> GeneratedVignetteContent:
        """
        Call LLM to generate personalized vignette content.

        Args:
            template: The template defining trade-offs
            user_context: User's background
            previous_vignettes: Previously shown scenarios

        Returns:
            Generated vignette content
        """
        # Build context description
        user_background = self._format_user_context(user_context)

        # Build template description
        template_description = self._format_template(template)

        # Build previous vignettes list
        previous_desc = (
            "\n".join(f"- {v}" for v in previous_vignettes)
            if previous_vignettes
            else "None yet"
        )

        prompt = f"""
**User Background:**
{user_background}

**Template Trade-Off:**
{template_description}

**Previously Shown Scenarios:**
{previous_desc}

Generate a personalized vignette that feels relevant to this user's background.
"""

        caller = LLMCaller[GeneratedVignetteContent](
            model_response_type=GeneratedVignetteContent
        )

        response, _ = await caller.call_llm(
            llm=self._llm,
            llm_input=prompt,
            logger=self._logger
        )

        if response is None:
            # Failed to generate, raise error to be caught by caller
            raise Exception("Failed to generate vignette content")

        return response

    def _format_user_context(self, context: UserContext) -> str:
        """Format user context for LLM prompt."""
        parts = []

        if context.current_role:
            parts.append(f"Current/Recent Role: {context.current_role}")
        else:
            parts.append("Current/Recent Role: Not specified (use general junior-level roles)")

        if context.industry:
            parts.append(f"Industry: {context.industry}")
        else:
            parts.append("Industry: Not specified (use general industries)")

        parts.append(f"Experience Level: {context.experience_level}")

        if context.key_experiences:
            parts.append(f"Key Experiences: {', '.join(context.key_experiences)}")

        if context.background_summary:
            parts.append(f"Summary: {context.background_summary}")

        return "\n".join(parts)

    def _format_template(self, template: VignetteTemplate) -> str:
        """Format template trade-off for LLM prompt."""
        parts = [
            f"Category: {template.category}",
            f"Testing: {template.trade_off.get('dimension_a', 'unknown')} vs {template.trade_off.get('dimension_b', 'unknown')}",
            "",
            "Option A should have:",
            f"- High: {', '.join(template.option_a.get('high_dimensions', []))}",
            f"- Low: {', '.join(template.option_a.get('low_dimensions', []))}",
            f"- Salary range: {template.option_a.get('salary_range', [])} KES/month",
            "",
            "Option B should have:",
            f"- High: {', '.join(template.option_b.get('high_dimensions', []))}",
            f"- Low: {', '.join(template.option_b.get('low_dimensions', []))}",
            f"- Salary range: {template.option_b.get('salary_range', [])} KES/month",
        ]

        return "\n".join(parts)

    def get_total_templates_count(self) -> int:
        """Get total number of available templates."""
        return len(self._templates)

    def get_category_counts(self) -> dict[str, int]:
        """Get count of templates per category."""
        return {
            category: len(templates)
            for category, templates in self._templates_by_category.items()
        }

import logging
from typing import List
from pydantic import BaseModel, Field

from app.users.cv.utils.cv_responsibilities_extractor import CVResponsibilitiesExtractor
from app.agent.skill_explorer_agent._responsibilities_extraction_tool import _ResponsibilitiesExtractionTool
from app.users.cv.types import CVStructuredExtraction
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience.experience_entity import ExperienceEntity, ResponsibilitiesData
from app.agent.experience.timeline import Timeline
from app.agent.experience.work_type import WorkType
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, get_config_variation
from common_libs.retry import Retry
from app.agent.penalty import get_penalty

_TAGS_TO_FILTER = [
    "CV Markdown",
    "System Instructions",
    "User's Last Input",
    "Conversation History",
]


class CVStructuredExperience(BaseModel):
    """Structured experience data extracted from CV."""
    experience_title: str = Field(description="Job title or role")
    company: str | None = Field(default=None, description="Company or organization name")
    location: str | None = Field(default=None, description="Work location")
    start_date: str | None = Field(default=None, description="Start date")
    end_date: str | None = Field(default=None, description="End date")
    work_type: str | None = Field(default=None, description="Type of work (paid, volunteer, etc.)")
    description: str | None = Field(default=None, description="Experience description")
    experience_markdown: str | None = Field(
        default=None,
        description="Raw markdown snippet for this experience, including title and bullets"
    )


class CVStructuredExtractionResponse(BaseModel):
    """Response from enhanced CV extraction LLM."""
    experiences: list[CVStructuredExperience] = Field(default_factory=list)


class CVStructuredExperienceExtractor:
    """CV structured extractor that extracts experience data and creates agent-compatible objects."""
    
    def __init__(self, logger: logging.Logger, responsibilities_extractor: CVResponsibilitiesExtractor):
        self._logger = logger
        self._llm_caller: LLMCaller[CVStructuredExtractionResponse] = LLMCaller[CVStructuredExtractionResponse](
            model_response_type=CVStructuredExtractionResponse
        )
        self._responsibilities_extractor = responsibilities_extractor
        self._penalty_level = 1
    
    async def extract_structured_experiences(self, markdown_cv: str) -> CVStructuredExtraction:
        """
        Enhanced extraction: structured JSON extraction + parallel responsibilities extraction.
        
        :param markdown_cv: The CV content in markdown format
        :return: Structured extraction result with collected data and experience entities
        """
        
        self._logger.info("Starting enhanced CV extraction pipeline")
        
        # Stage 1: Extract structured experience data using LLM
        self._logger.debug("Stage 1: Extracting structured experiences")
        structured_experiences = await self._extract_structured_experiences(markdown_cv)
        self._logger.info("Extracted %d structured experiences", len(structured_experiences))
        
        # Stage 2: Extract responsibilities for each experience (parallel processing)
        self._logger.debug("Stage 2: Extracting responsibilities in parallel")
        experience_entities = []
        for i, experience in enumerate(structured_experiences):
            self._logger.debug("Processing experience %d: %s", i + 1, experience.experience_title)
            
            # Extract responsibilities using existing responsibilities extraction logic
            responsibilities_input = (
                experience.experience_markdown
                or experience.description
                or f"{experience.experience_title} at {experience.company or 'Unknown'}"
            )
            responsibilities_data = await self._responsibilities_extractor.extract_responsibilities(
                responsibilities_input
            )
            self._logger.info(
                "Responsibilities extracted {title=%s, company=%s, count=%d}",
                experience.experience_title,
                experience.company,
                len(responsibilities_data.responsibilities),
            )
            if responsibilities_data.responsibilities:
                self._logger.debug(
                    "Responsibilities sample for '%s': %s",
                    experience.experience_title,
                    "; ".join(responsibilities_data.responsibilities[:5])
            )
            
            # Create ExperienceEntity with extracted data
            experience_entity = self._create_experience_entity(experience, responsibilities_data)
            experience_entities.append(experience_entity)
            
            self._logger.info(
                "ExperienceEntity built {title=%s, responsibilities=%d}",
                experience.experience_title,
                len(responsibilities_data.responsibilities)
            )
        
        # Convert to CollectedData format for CollectExperiencesAgent
        self._logger.debug("Stage 3: Converting to CollectedData format")
        collected_data = self._convert_to_collected_data(experience_entities)
        
        self._logger.info("Enhanced extraction completed: %d experiences, %d collected data items", 
                         len(experience_entities), len(collected_data))
        
        return CVStructuredExtraction(
            collected_data=collected_data,
            experience_entities=experience_entities,
            extraction_metadata={"total_experiences": len(experience_entities)}
        )
    
    def _convert_to_collected_data(self, experience_entities: List[ExperienceEntity]) -> List[CollectedData]:
        """
        Convert ExperienceEntity objects to CollectedData format for CollectExperiencesAgent compatibility.
        
        :param experience_entities: List of ExperienceEntity objects to convert
        :return: List of CollectedData objects compatible with CollectExperiencesAgent
        """
        collected_data = []
        
        for i, experience in enumerate(experience_entities):
            # Extract basic info from ExperienceEntity
            collected_item = CollectedData(
                index=i,
                experience_title=experience.experience_title,
                company=experience.company,
                location=experience.location,
                start_date=experience.timeline.start if experience.timeline else None,
                end_date=experience.timeline.end if experience.timeline else None,
                paid_work=None,  # Will be determined by existing conversation flow
                work_type=experience.work_type.name if experience.work_type else None
            )
            collected_data.append(collected_item)
        
        return collected_data
    
    async def _extract_structured_experiences(self, markdown_cv: str) -> list[CVStructuredExperience]:
        """Extract structured experience data using LLM."""
        
        self._logger.info("Extracting structured experiences from markdown {md_length_chars=%s}", len(markdown_cv or ""))
        prompt = self._create_prompt((markdown_cv or "").strip())
        self._logger.debug("Prompt preview: %s", prompt[:200].replace("\n", " "))
        
        async def _callback(attempt: int, max_retries: int) -> tuple[list[CVStructuredExperience], float, BaseException | None]:
            # Vary temperature/top_p slightly across retries to escape bad local minima
            temperature_cfg = get_config_variation(start_temperature=0.0, end_temperature=0.3,
                                                   start_top_p=0.9, end_top_p=1.0,
                                                   attempt=attempt, max_retries=max_retries)
            llm = GeminiGenerativeLLM(
                system_instructions=self._create_system_instructions(),
                config=LLMConfig(
                    generation_config=temperature_cfg | JSON_GENERATION_CONFIG | {
                        "max_output_tokens": 3000
                    }
                )
            )
            try:
                model_response, _ = await self._llm_caller.call_llm(
                    llm=llm,
                    llm_input=prompt,
                    logger=self._logger,
                )
            except Exception as e:
                return [], get_penalty(self._penalty_level), e
            
            if not model_response:
                return [], get_penalty(self._penalty_level), ValueError("LLM returned no model response")
            
            experiences = model_response.experiences or []
            if not experiences:
                return [], get_penalty(self._penalty_level), ValueError("LLM returned empty experiences list")
            
            # Success
            return experiences, 0.0, None
        
        experiences, _penalty, _error = await Retry[list[CVStructuredExperience]].call_with_penalty(
            callback=_callback, logger=self._logger
        )
        if experiences:
            self._logger.info("Structured experiences extracted {items=%s}", len(experiences))
            self._logger.debug("Extraction preview: %s", "; ".join([exp.experience_title for exp in experiences[:3]]))
        else:
            self._logger.error("LLM extraction failed to produce structured experiences after retries")
        return experiences
    
    def _create_prompt(self, markdown_cv: str) -> str:
        """Create prompt for structured experience extraction."""
        clean_md = sanitize_input(markdown_cv, _TAGS_TO_FILTER)
        return f"""
<CV Markdown>
{clean_md}
</CV Markdown>
"""
    
    def _create_system_instructions(self) -> str:
        """Create system instructions for structured experience extraction."""
        return """
<System Instructions>
You are an expert CV parser that extracts structured work experience data.

Task: From the provided <CV Markdown> content, extract work experiences as structured JSON data.

JSON Output Schema (must strictly follow):
{
  "experiences": [
    {
      "experience_title": "string",
      "company": "string or null",
      "location": "string or null", 
      "start_date": "string or null",
      "end_date": "string or null",
      "work_type": "string or null",
      "description": "string or null",
      "experience_markdown": "string or null"
    }
  ]
}

Rules for extraction:
- Extract ALL work/livelihood experiences from the CV
- Each experience must have at least an experience_title
- Include company name if mentioned
- Include location if mentioned  
- Include dates if mentioned (format as strings)
- Include work type if determinable (e.g., "paid", "volunteer", "internship")
- Include description if there are responsibilities/tasks mentioned
- Provide experience_markdown as the raw markdown snippet for the experience (title + company + any bullet lists or sentences) exactly as it appears in the CV
- Do NOT include personal data (names, emails, phone numbers, addresses)
- Do NOT include education unless it's work-related
- Do NOT include skills sections unless they're part of a specific role

Examples:
- "Software Engineer at Google (2020-2023), Mountain View, CA" → experience_title: "Software Engineer", company: "Google", location: "Mountain View, CA", start_date: "2020", end_date: "2023"
- "Volunteered as tutor at local school" → experience_title: "Tutor", company: "Local School", work_type: "volunteer"
- If the CV contains:
  "- Software Engineer, TechCorp (2020-2023)\n  - Developed web applications\n  - Led team"
  then experience_markdown must contain the same lines with the same formatting.

Respond with JSON only.
</System Instructions>
"""
    
    def _create_experience_entity(self, experience: CVStructuredExperience, responsibilities_data: ResponsibilitiesData) -> ExperienceEntity:
        """Create ExperienceEntity from structured experience data and responsibilities."""
        
        # Create timeline if dates are available
        timeline = None
        if experience.start_date:
            timeline = Timeline(
                start_date=experience.start_date,
                end_date=experience.end_date or "Present"
            )
        
        # Determine work type
        work_type = self._determine_work_type(experience.work_type)
        
        return ExperienceEntity(
            experience_title=experience.experience_title,
            company=experience.company,
            location=experience.location,
            timeline=timeline,
            work_type=work_type,
            responsibilities=responsibilities_data,
            # Skills will be populated by existing skills processing pipeline
            top_skills=[],
            remaining_skills=[],
            summary=experience.description
        )
    
    def _determine_work_type(self, work_type_str: str | None) -> WorkType | None:
        """Determine WorkType from string."""
        if not work_type_str:
            return WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
        
        work_type_mapping = {
            "volunteer": WorkType.UNSEEN_UNPAID,
            "volunteering": WorkType.UNSEEN_UNPAID,
            "unpaid": WorkType.UNSEEN_UNPAID,
            "internship": WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK,
            "trainee": WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK,
            "self-employed": WorkType.SELF_EMPLOYMENT,
            "self employment": WorkType.SELF_EMPLOYMENT,
            "paid": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
            "waged": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        }
        
        return work_type_mapping.get(work_type_str.lower(), WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT)

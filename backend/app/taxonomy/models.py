"""
Defines MongoDB document schemas for:
1. Taxonomy Database (ESCO + KeSCO + Custom Occupations & Skills)
2. Labor Demand Database
3. Jobs Database
4. Training Opportunities Database
5. Preferences Database

-----Summary

# Taxonomy schemas

OccupationGroupModel                -> Hierarchical occupation groups (ESCO)
OccupationModel                     -> THE CORE MODEL - unified ESCO + KeSCO + Custom occupations
SkillModel                          -> ESCO skills taxonomy
OccupationSkillRelationModel        -> Skills required per occupation
SkillRelationModel                  -> Hierarchical skill connections
CareerPathModel                     -> Career progression routes

# Labor demand schemas

LaborDemandModel                    -> Occupation demand by region
LaborMarketInsightModel             -> Qualitative labor market analysis

# Job schemas

JobListingModel                     -> Scraped jobs from 6 Kenyan platforms
JobScrapingLogModel                 -> Monitoring scraper runs


# Training and preferences schemas

TrainingOpportunityModel            -> Upskilling courses, certifications, TVET programs
PreferenceDimensionModel            -> Canonical preference dimensions (salary, flexibility, work type)
OccupationPreferenceProfileModel    -> Preference characteristics per occupation (salary ranges, amenities)
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Annotated
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator #type:ignore
from bson import ObjectId #type:ignore


# ============================================================================
# CUSTOM TYPES AND ENUMS
# ============================================================================

# Pydantic v2 compatible ObjectId type
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class DataSource(str, Enum):
    """Source of taxonomy data"""
    ESCO = "ESCO"
    KESCO = "KeSCO"
    CUSTOM = "Custom"
    ESCO_KESCO_MERGED = "ESCO-KeSCO-Merged"


class OccupationType(str, Enum):
    """Type of occupation classification"""
    ESCO_OCCUPATION = "escooccupation"
    LOCAL_OCCUPATION = "localoccupation"


class SkillType(str, Enum):
    """ESCO skill classification"""
    SKILL_COMPETENCE = "skill/competence"
    KNOWLEDGE = "knowledge"
    LANGUAGE = "language"


class SkillReuseLevel(str, Enum):
    """ESCO skill reuse level"""
    CROSS_SECTORAL = "cross-sectoral"
    SECTOR_SPECIFIC = "sector-specific"
    OCCUPATION_SPECIFIC = "occupation-specific"
    TRANSVERSAL = "transversal"


class RelationType(str, Enum):
    """Skill-occupation relationship type"""
    ESSENTIAL = "essential"
    OPTIONAL = "optional"


class DemandCategory(str, Enum):
    """Labor demand classification"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class ContractType(str, Enum):
    """Job contract types in Kenya"""
    PERMANENT = "permanent"
    CONTRACT = "contract"
    TEMPORARY = "temporary"
    PART_TIME = "part_time"
    FULL_TIME = "full_time"
    INTERNSHIP = "internship"
    FREELANCE = "freelance"
    VOLUNTEER = "volunteer"
    GIG = "gig"
    CASUAL = "casual"


class JobStatus(str, Enum):
    """Status of job listing"""
    ACTIVE = "active"
    EXPIRED = "expired"
    FILLED = "filled"
    REMOVED = "removed"


class JobPlatform(str, Enum):
    """Kenyan job platforms"""
    BRIGHTERMONDAY = "brightermonday"
    CAREERJET = "careerjet"
    FUZU = "fuzu"
    JOBWEBKENYA = "jobwebkenya"
    MYJOBMAG = "myjobmag"
    JOBSINKENYA = "jobsinkenya"  

# ============================================================================
# COLLECTION NAME CONSTANTS
# ============================================================================

class TaxonomyCollections:
    """Taxonomy database collection names"""
    OCCUPATION_GROUPS = "occupation_groups"
    OCCUPATIONS = "occupations"
    SKILLS = "skills"
    OCCUPATION_SKILL_RELATIONS = "occupation_skill_relations"
    SKILL_RELATIONS = "skill_relations"
    CAREER_PATHS = "career_paths"


class LaborDemandCollections:
    """Labor demand database collection names"""
    LABOR_DEMAND = "labor_demand"
    MARKET_INSIGHTS = "labor_market_insights"


class JobsCollections:
    """Jobs database collection names"""
    JOB_LISTINGS = "job_listings"
    SCRAPING_LOGS = "job_scraping_logs"


class TrainingCollections:
    """Training database collection names (Milestone 2)"""
    TRAINING_OPPORTUNITIES = "training_opportunities"
    PREFERENCE_DIMENSIONS = "preference_dimensions"
    OCCUPATION_PREFERENCE_PROFILES = "occupation_preference_profiles"



# ============================================================================
# 1. TAXONOMY DATABASE SCHEMAS
# ============================================================================

class OccupationGroupModel(BaseModel):
    """
    Occupation groups for hierarchical classification (ESCO)
    Collection: occupation_groups
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    code: str = Field(..., description="Group code (e.g., '0110' for commissioned armed forces officers)")
    preferred_label: str = Field(..., description="Display name of the group")
    description: Optional[str] = Field(None, description="Detailed description")
    parent_code: Optional[str] = Field(None, description="Parent group code for hierarchy")
    level: int = Field(..., description="Hierarchy level (1=major, 2=submajor, 3=minor, 4=unit)")
    
    # Metadata
    source: DataSource = Field(..., description="Data source")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OccupationModel(BaseModel):
    """
    Individual occupations from ESCO, KeSCO, and custom additions
    Collection: occupations
    
    Combines ESCO fields with KeSCO structure and custom Kenyan occupations
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    # Primary identification
    code: str = Field(..., description="Occupation code (ESCO code, KeSCO code, or custom)")
    isco_group_code: Optional[str] = Field(None, description="4-digit ISCO-08 occupation group code (e.g., '7314')")
    preferred_label: str = Field(..., description="Main occupation title")
    alt_labels: List[str] = Field(default_factory=list, description="Alternative titles/synonyms")
    
    # ESCO-specific fields
    esco_uri: Optional[str] = Field(None, description="ESCO URI if from ESCO")
    esco_code: Optional[str] = Field(None, description="ESCO occupation code")
    esco_uuid: Optional[str] = Field(None, description="ESCO UUID history")
    occupation_type: OccupationType = Field(..., description="Type of occupation")
    
    # KeSCO-specific fields
    kesco_code: Optional[str] = Field(None, description="Original KeSCO code if applicable")
    kesco_serial_number: Optional[int] = Field(None, description="KeSCO S/No from Excel")
    
    # Descriptive content
    description: Optional[str] = Field(None, description="Full occupation description")
    definition: Optional[str] = Field(None, description="Short definition")
    scope_note: Optional[str] = Field(None, description="Scope clarification")
    regulated_profession_note: Optional[str] = Field(None, description="Regulation info")
    
    # Classification & hierarchy
    occupation_group_code: Optional[str] = Field(None, description="Parent group code")
    
    # Kenya context
    is_relevant_for_kenya: bool = Field(True, description="Whether relevant in Kenyan context")
    is_informal_sector: bool = Field(False, description="True for informal economy roles")
    is_entrepreneurship: bool = Field(False, description="True for entrepreneurship roles")
    kenya_specific_notes: Optional[str] = Field(None, description="Kenya-specific context")
    
    # *** UPDATED: Contextualization fields (KeSCO ↔ ESCO mapping with hierarchical matching) ***
    mapped_to_esco_id: Optional[PyObjectId] = Field(None, description="Auto-matched ESCO occupation (≥70% confidence)")
    suggested_esco_id: Optional[PyObjectId] = Field(None, description="Suggested ESCO match for manual review (60-69%)")
    mapping_confidence: Optional[float] = Field(None, ge=0, le=1, description="Matching confidence score (0-1)")
    mapping_method: Optional[str] = Field(None, description="Method: 'exact', 'hierarchical_group', 'hierarchical_fallback', 'fuzzy_fallback', etc.")
    requires_manual_review: bool = Field(False, description="True if mapping confidence is 60-69%")
    requires_manual_skill_assignment: bool = Field(False, description="True if no good ESCO match found (<60%)")
    has_inherited_skills: bool = Field(False, description="True if skills were inherited from ESCO")
    inherited_skills_count: int = Field(0, description="Number of skills inherited from ESCO")
    
    # Provenance & metadata
    source: DataSource = Field(..., description="Original data source")
    taxonomy_model_id: PyObjectId = Field(..., description="Reference to taxonomy model version")
    added_by: str = Field(default="system", description="User/system that added this")
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_localized: bool = Field(default=False, description="Whether localized for Kenya")
    
    # Search optimization
    search_terms: List[str] = Field(default_factory=list, description="Preprocessed search terms")


class SkillModel(BaseModel):
    """
    Skills from ESCO taxonomy with optional custom additions
    Collection: skills
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    # Primary identification
    esco_uri: str = Field(..., description="ESCO skill URI")
    esco_uuid: Optional[str] = Field(None, description="ESCO UUID history")
    preferred_label: str = Field(..., description="Main skill name")
    alt_labels: List[str] = Field(default_factory=list, description="Alternative names")
    
    # Classification
    skill_type: SkillType = Field(..., description="Type of skill")
    reuse_level: SkillReuseLevel = Field(..., description="Skill reuse level")
    
    # Descriptive content
    description: Optional[str] = Field(None, description="Detailed skill description")
    definition: Optional[str] = Field(None, description="Short definition")
    scope_note: Optional[str] = Field(None, description="Scope clarification")
    
    # Kenya context
    is_relevant_for_kenya: bool = Field(True, description="Relevant in Kenyan context")
    kenya_specific_examples: List[str] = Field(default_factory=list, description="Kenya-specific examples")
    
    # Metadata
    source: DataSource = Field(default=DataSource.ESCO, description="Data source")
    taxonomy_model_id: PyObjectId = Field(..., description="Taxonomy model version")
    is_localized: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OccupationSkillRelationModel(BaseModel):
    """
    Mapping between occupations and their required/optional skills
    Collection: occupation_skill_relations
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    # Core relationship
    occupation_id: PyObjectId = Field(..., description="Reference to occupation")
    skill_id: PyObjectId = Field(..., description="Reference to skill")
    relation_type: RelationType = Field(..., description="Essential or optional")
    
    # Additional metadata from ESCO
    signalling_value: Optional[float] = Field(None, description="ESCO signalling value")
    signalling_value_label: Optional[str] = Field(None, description="Signalling label")
    
    # Custom fields for Kenya
    skill_level: Optional[str] = Field(None, description="Required proficiency level")
    is_critical_for_kenya: bool = Field(False, description="Critical skill in Kenya market")
    
    # *** Skill inheritance tracking ***
    inherited_from_esco_id: Optional[PyObjectId] = Field(None, description="ESCO occupation this skill was inherited from")
    
    # Metadata
    source: DataSource = Field(default=DataSource.ESCO)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SkillRelationModel(BaseModel):
    """
    Hierarchical and related connections between skills
    Collection: skill_relations
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    skill_id: PyObjectId = Field(..., description="Source skill")
    related_skill_id: PyObjectId = Field(..., description="Target skill")
    relation_type: str = Field(..., description="Type of relationship (broader, narrower, related)")
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CareerPathModel(BaseModel):
    """
    Career progression paths between occupations
    Collection: career_paths
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    # Core path
    from_occupation_id: PyObjectId = Field(..., description="Starting occupation")
    to_occupation_id: PyObjectId = Field(..., description="Target occupation")
    
    # Path characteristics
    transition_likelihood: Optional[float] = Field(None, ge=0, le=1, description="Probability of transition (0-1)")
    typical_years_experience: Optional[int] = Field(None, description="Typical years before transition")
    typical_conditions: Optional[str] = Field(None, description="Common requirements for transition")
    
    # Skills gap
    skills_to_acquire: List[PyObjectId] = Field(default_factory=list, description="Skills needed for transition")
    training_recommendations: List[str] = Field(default_factory=list, description="Recommended training")
    
    # Kenya-specific
    common_in_kenya: bool = Field(True, description="Common career path in Kenya")
    kenya_specific_barriers: Optional[str] = Field(None, description="Barriers in Kenyan context")
    
    # Metadata
    source: str = Field(default="system", description="How path was identified")
    added_by: str = Field(default="system")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============================================================================
# 2. LABOR DEMAND DATABASE SCHEMAS
# ============================================================================

class LaborDemandModel(BaseModel):
    """
    Labor market demand data by occupation and region
    Collection: labor_demand
    
    Sources: Kenya National Bureau of Statistics, labor force surveys, LMIS data
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    # Core reference
    occupation_id: PyObjectId = Field(..., description="Reference to occupation")
    
    # Geographic scope
    region: str = Field(..., description="County or broader region (e.g., 'Nairobi', 'Coastal', 'National')")
    region_type: str = Field(default="county", description="'county', 'region', or 'national'")
    
    # Demand metrics
    demand_score: float = Field(..., ge=0, le=100, description="Normalized demand score (0-100)")
    demand_category: DemandCategory = Field(..., description="Categorical demand level")
    
    # Supporting data
    estimated_job_openings: Optional[int] = Field(None, description="Estimated annual openings")
    employed_count: Optional[int] = Field(None, description="Currently employed in this occupation")
    unemployment_rate: Optional[float] = Field(None, description="Unemployment rate for this occupation")
    
    # Trend analysis
    trend_direction: Optional[str] = Field(None, description="'increasing', 'stable', 'decreasing'")
    year_over_year_change: Optional[float] = Field(None, description="Percentage change from previous year")
    
    # Data provenance
    source: str = Field(..., description="Data source (e.g., 'KNBS Labor Force Survey 2024')")
    source_url: Optional[str] = Field(None, description="URL to source document")
    data_collection_period: str = Field(..., description="Period of data collection (e.g., 'Q3 2024')")
    methodology_notes: Optional[str] = Field(None, description="How demand was calculated")
    
    # Metadata
    last_updated_at: datetime = Field(..., description="When data was last updated")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data_quality_score: Optional[float] = Field(None, ge=0, le=1, description="Confidence in data (0-1)")


class LaborMarketInsightModel(BaseModel):
    """
    Qualitative insights about labor market trends
    Collection: labor_market_insights
    
    Stores analysis, reports, and expert insights
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    # Scope
    occupation_ids: List[PyObjectId] = Field(default_factory=list, description="Related occupations")
    sector: Optional[str] = Field(None, description="Economic sector (e.g., 'ICT', 'Agriculture')")
    region: Optional[str] = Field(None, description="Geographic scope")
    
    # Content
    title: str = Field(..., description="Insight title")
    summary: str = Field(..., description="Brief summary")
    full_content: Optional[str] = Field(None, description="Detailed analysis")
    key_findings: List[str] = Field(default_factory=list, description="Bullet points of findings")
    
    # Metadata
    source: str = Field(..., description="Source of insight")
    author: Optional[str] = Field(None, description="Author/organization")
    publication_date: Optional[datetime] = Field(None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============================================================================
# 3. JOBS DATABASE SCHEMAS
# ============================================================================

class JobListingModel(BaseModel):
    """
    Scraped job postings from Kenyan job platforms
    Collection: job_listings
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    # Job identification
    external_job_id: Optional[str] = Field(None, description="Job ID from source platform")
    url: str = Field(..., description="Direct URL to job posting")
    source_platform: JobPlatform = Field(..., description="Platform where job was found")
    
    # Job content
    job_title: str = Field(..., description="Job title as posted")
    normalized_title: Optional[str] = Field(None, description="Cleaned/normalized title")
    description: str = Field(..., description="Full job description")
    summary: Optional[str] = Field(None, description="Auto-generated summary")
    
    # Employer information
    employer: Optional[str] = Field(None, description="Company name")
    employer_description: Optional[str] = Field(None, description="About the company")
    employer_logo_url: Optional[str] = Field(None)
    
    # Location
    location: str = Field(..., description="Job location as posted")
    county: Optional[str] = Field(None, description="Kenyan county (normalized)")
    city: Optional[str] = Field(None, description="City/town")
    is_remote: bool = Field(default=False)
    
    # Compensation
    salary_min: Optional[float] = Field(None, description="Minimum salary (KES)")
    salary_max: Optional[float] = Field(None, description="Maximum salary (KES)")
    salary_currency: str = Field(default="KES")
    salary_period: Optional[str] = Field(None, description="'monthly', 'annual', 'hourly'")
    salary_text: Optional[str] = Field(None, description="Original salary text if not parseable")
    
    # Job details
    contract_type: Optional[ContractType] = Field(None, description="Type of employment")
    contract_duration: Optional[str] = Field(None, description="For contracts/temporary roles")
    experience_required: Optional[str] = Field(None, description="Required experience")
    education_required: Optional[str] = Field(None, description="Required education level")
    
    # Dates
    posting_date: Optional[datetime] = Field(None, description="When job was posted")
    closing_date: Optional[datetime] = Field(None, description="Application deadline")
    application_deadline: Optional[datetime] = Field(None, description="Alternative field for deadline")
    
    # Status
    status: JobStatus = Field(default=JobStatus.ACTIVE)
    is_featured: bool = Field(default=False, description="Featured/promoted posting")
    
    # Taxonomy mapping
    mapped_occupation_id: Optional[PyObjectId] = Field(None, description="Mapped to taxonomy occupation")
    mapping_confidence: Optional[float] = Field(None, ge=0, le=1, description="Confidence in mapping")
    mapped_skills: List[PyObjectId] = Field(default_factory=list, description="Extracted skills")
    
    # Application info
    how_to_apply: Optional[str] = Field(None, description="Application instructions")
    application_email: Optional[str] = Field(None)
    application_url: Optional[str] = Field(None)
    
    # Scraping metadata
    scraped_at: datetime = Field(..., description="When job was scraped")
    last_checked_at: datetime = Field(..., description="Last time we verified job is still active")
    scraper_version: str = Field(default="1.0", description="Version of scraper used")
    raw_html: Optional[str] = Field(None, description="Original HTML (for debugging)")
    
    # Search optimization
    search_keywords: List[str] = Field(default_factory=list, description="Extracted keywords")
    
    # Quality indicators
    is_duplicate: bool = Field(default=False)
    duplicate_of: Optional[PyObjectId] = Field(None, description="Original job if duplicate")
    quality_score: Optional[float] = Field(None, ge=0, le=1, description="Data quality score")


class JobScrapingLogModel(BaseModel):
    """
    Logs of scraping runs for monitoring and debugging
    Collection: job_scraping_logs
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    # Run identification
    run_id: str = Field(..., description="Unique identifier for this scraping run")
    platform: JobPlatform = Field(..., description="Platform scraped")
    scraper_version: str = Field(..., description="Version of scraper")
    
    # Run statistics
    jobs_found: int = Field(default=0)
    jobs_added: int = Field(default=0)
    jobs_updated: int = Field(default=0)
    jobs_marked_expired: int = Field(default=0)
    errors_count: int = Field(default=0)
    
    # Timing
    started_at: datetime = Field(..., description="When scraping started")
    completed_at: Optional[datetime] = Field(None, description="When scraping completed")
    duration_seconds: Optional[float] = Field(None)
    
    # Status
    status: str = Field(..., description="'running', 'completed', 'failed'")
    error_message: Optional[str] = Field(None)
    
    # Details
    pages_scraped: int = Field(default=0)
    urls_visited: List[str] = Field(default_factory=list)


# ============================================================================
# 4. TRAINING OPPORTUNITIES SCHEMAS 
# ============================================================================

class TrainingProviderType(str, Enum):
    """Types of training providers"""
    UNIVERSITY = "university"
    TVET = "tvet"
    ONLINE_PLATFORM = "online_platform"
    NGO_PARTNER = "ngo_partner"
    PRIVATE_INSTITUTION = "private_institution"
    GOVERNMENT = "government"


class TrainingOpportunityModel(BaseModel):
    """
    Training courses, certifications, and upskilling opportunities
    Collection: training_opportunities
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    # Basic info
    title: str = Field(..., description="Training/course title")
    description: str = Field(..., description="Full description")
    
    # Provider
    provider_name: str = Field(..., description="Name of provider")
    provider_type: TrainingProviderType = Field(...)
    provider_website: Optional[str] = Field(None)
    
    # Delivery
    delivery_mode: str = Field(..., description="'online', 'in-person', 'hybrid'")
    location: Optional[str] = Field(None, description="Physical location if applicable")
    region: Optional[str] = Field(None, description="County/region")
    
    # Duration & schedule
    duration: Optional[str] = Field(None, description="e.g., '3 months', '40 hours'")
    schedule: Optional[str] = Field(None, description="e.g., 'Weekends', 'Full-time'")
    start_date: Optional[datetime] = Field(None)
    end_date: Optional[datetime] = Field(None)
    
    # Cost
    cost: Optional[float] = Field(None, description="Cost in KES")
    is_free: bool = Field(default=False)
    financial_aid_available: bool = Field(default=False)
    
    # Eligibility
    required_qualifications: List[str] = Field(default_factory=list)
    required_skills: List[PyObjectId] = Field(default_factory=list, description="Prerequisite skills")
    minimum_education: Optional[str] = Field(None)
    
    # Outcomes
    target_occupation_ids: List[PyObjectId] = Field(default_factory=list, description="Leads to these occupations")
    skills_gained: List[PyObjectId] = Field(default_factory=list, description="Skills acquired")
    certification_awarded: Optional[str] = Field(None)
    
    # Metadata
    url: Optional[str] = Field(None, description="Application/info URL")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============================================================================
# 5. PREFERENCE DIMENSIONS SCHEMAS
# ============================================================================

class PreferenceDimensionModel(BaseModel):
    """
    Canonical preference dimensions for job/career preferences
    Collection: preference_dimensions
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    # Dimension identity
    dimension_key: str = Field(..., description="Unique key (e.g., 'salary_range', 'work_flexibility')")
    dimension_label: str = Field(..., description="Display name")
    category: str = Field(..., description="'financial', 'non_wage_amenities', 'task_preference'")
    
    # Description
    description: str = Field(..., description="What this dimension measures")
    question_text: Optional[str] = Field(None, description="How to ask users about this")
    
    # Value type
    value_type: str = Field(..., description="'scale', 'range', 'categorical', 'binary'")
    possible_values: Optional[List[str]] = Field(None, description="For categorical dimensions")
    min_value: Optional[float] = Field(None, description="For scale/range dimensions")
    max_value: Optional[float] = Field(None, description="For scale/range dimensions")
    
    # Metadata
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OccupationPreferenceProfileModel(BaseModel):
    """
    Preference characteristics for each occupation
    Collection: occupation_preference_profiles
    """
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
    
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    
    occupation_id: PyObjectId = Field(..., description="Reference to occupation")
    preference_values: Dict[str, Any] = Field(..., description="Key-value pairs of preference dimensions")
    
    # Metadata
    data_source: str = Field(..., description="How profile was determined")
    confidence_score: Optional[float] = Field(None, ge=0, le=1)
    last_updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
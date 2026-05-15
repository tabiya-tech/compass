"""
Recommendation Interface for the Recommender/Advisor Agent.

Handles generating or loading recommendations from:
1. Node2Vec algorithm (Jasmin's implementation)
2. Stub recommendations for development
3. Conversion from Jasmin's format to agent format

Epic 3: Recommender Agent Implementation
"""

from typing import Any, Optional
import logging

from app.matching.matching_types import (
    CompassMatchingResult,
    PreferenceVector as MatchingPreferenceVector,
    Skill as MatchingSkill,
    SkillsVector as MatchingSkillsVector,
)
from app.agent.recommender_advisor_agent.types import (
    Node2VecRecommendations,
    OccupationRecommendation,
    OpportunityRecommendation,
    SkillsTrainingRecommendation,
)
from app.agent.preference_elicitation_agent.types import PreferenceVector

logger = logging.getLogger(__name__)


# ========== SKILL GAP TO TRAINING MAPPING ==========
# Maps skill labels from Node2Vec to concrete training courses
# This bridges the gap between "learn skill X" and "take course Y at provider Z"

SKILL_TO_TRAINING_MAP = {
    # Electrical/Technical skills
    "supervise correctional procedures": {
        "training_title": "Law Enforcement and Corrections Training",
        "provider": "Zambia Police College / Zambia Correctional Service Training School",
        "cost": "ZMW 5,000-10,000",
        "estimated_hours": 240,
        "delivery_mode": "in_person",
        "location": "Lusaka",
    },
    "teach housekeeping skills": {
        "training_title": "Hospitality and Housekeeping Management",
        "provider": "Zambia Centre for Accountancy Studies (ZCAS) / Lusaka Apex Medical University",
        "cost": "ZMW 3,000-6,000",
        "estimated_hours": 160,
        "delivery_mode": "in_person",
        "location": "Lusaka / Livingstone",
    },
    "enterprise risk management": {
        "training_title": "Enterprise Risk Management Certification",
        "provider": "Zambia Institute of Chartered Accountants (ZICA)",
        "cost": "ZMW 8,000-15,000",
        "estimated_hours": 120,
        "delivery_mode": "hybrid",
        "location": "Lusaka / Online",
    },
    "control compliance of railway vehicles regulations": {
        "training_title": "Transport Safety and Compliance Training",
        "provider": "Road Transport and Safety Agency (RTSA) / Zambia Railways",
        "cost": "ZMW 2,000-4,000",
        "estimated_hours": 80,
        "delivery_mode": "in_person",
        "location": "Lusaka / Kabwe",
    },
    "handle equipment while suspended": {
        "training_title": "Industrial Rigging and Safety Certification",
        "provider": "TEVETA-registered Safety Training Centre",
        "cost": "ZMW 1,500-3,000",
        "estimated_hours": 40,
        "delivery_mode": "in_person",
        "location": "Lusaka / Kitwe / Ndola",
    },
    "lead police investigations": {
        "training_title": "Criminal Investigation and Forensics",
        "provider": "Zambia Police College",
        "cost": "ZMW 5,000-9,000",
        "estimated_hours": 200,
        "delivery_mode": "in_person",
        "location": "Lusaka",
    },
    # Programming/Tech skills
    "python": {
        "training_title": "Python for Data Science and Development",
        "provider": "ALX Africa / Coursera / UNZA ICT Centre",
        "cost": "Free - ZMW 8,000 (depending on provider)",
        "estimated_hours": 200,
        "delivery_mode": "online",
        "location": "Online / Lusaka",
    },
    "haskell": {
        "training_title": "Functional Programming with Haskell",
        "provider": "Online platforms (Coursera, edX)",
        "cost": "Free - ZMW 1,500",
        "estimated_hours": 80,
        "delivery_mode": "online",
        "location": "Online",
    },
    "git / version control": {
        "training_title": "Git and Version Control for Developers",
        "provider": "freeCodeCamp / Udemy / ALX Africa",
        "cost": "Free - ZMW 500",
        "estimated_hours": 20,
        "delivery_mode": "online",
        "location": "Online",
    },
    "sql / database management": {
        "training_title": "SQL and Database Management",
        "provider": "Coursera / Udemy / CBU ICT Department",
        "cost": "Free - ZMW 3,000",
        "estimated_hours": 60,
        "delivery_mode": "online",
        "location": "Online / Lusaka / Kitwe",
    },
    # Add more as needed...
}


def convert_skill_gaps_to_trainings(
    skill_gaps: list[dict[str, Any]]
) -> list[SkillsTrainingRecommendation]:
    """
    Convert Jasmin's skill gap recommendations to training course recommendations.

    Jasmin provides: "learn skill X" with proximity scores and job unlock counts.
    Agent wants: "take course Y at provider Z for $W".

    This function bridges the gap by mapping skills to curated training courses.
    For unmapped skills, it creates a generic training recommendation.

    Args:
        skill_gaps: List of skill gap dicts from Node2Vec output
            Format: {skill_id, skill_label, proximity_score, job_unlock_count, combined_score, reasoning}

    Returns:
        List of SkillsTrainingRecommendation objects for agent use
    """
    trainings = []

    for idx, gap in enumerate(skill_gaps):
        skill_label = gap.get("skill_label", "").lower()
        skill_id = gap.get("skill_id", "")
        reasoning = gap.get("reasoning", f"Learning this skill would help unlock {gap.get('job_unlock_count', 0)} jobs.")

        # Look up training data from map
        training_data = SKILL_TO_TRAINING_MAP.get(skill_label)

        if training_data:
            # Create training recommendation from map
            trainings.append(SkillsTrainingRecommendation(
                uuid=f"training_{skill_id}",
                originUuid=skill_id,
                rank=idx + 1,
                skill=gap.get("skill_label", "Unknown Skill"),
                training_title=training_data["training_title"],
                provider=training_data["provider"],
                cost=training_data["cost"],
                estimated_hours=training_data["estimated_hours"],
                delivery_mode=training_data["delivery_mode"],
                location=training_data.get("location"),
                justification=reasoning,
                target_occupations=[],  # Could be extracted from job_unlock_count
                fills_gap_for=[]
            ))
        else:
            # Fallback: Create generic training recommendation for unmapped skills
            logger.debug(f"No training mapping for skill: {skill_label}")
            trainings.append(SkillsTrainingRecommendation(
                uuid=f"training_{skill_id}",
                originUuid=skill_id,
                rank=idx + 1,
                skill=gap.get("skill_label", "Unknown Skill"),
                training_title=f"Training in {gap.get('skill_label', 'this skill')}",
                provider="Various training providers",
                cost="Contact training providers for pricing",
                estimated_hours=None,
                delivery_mode=None,
                location="Various locations",
                justification=reasoning,
                target_occupations=[],
                fills_gap_for=[]
            ))

    return trainings

# Node2Vec import (Jasmin's algorithm - optional)
try:
    from app.epic3.node2vec.recommender import Node2VecRecommender
    NODE2VEC_AVAILABLE = True
except ImportError:
    Node2VecRecommender = None
    NODE2VEC_AVAILABLE = False


def _compass_result_to_node2vec(result: CompassMatchingResult) -> Node2VecRecommendations:
    """Convert a unified CompassMatchingResult (produced by v1 or v2) to agent format."""
    occupations = [
        OccupationRecommendation(
            uuid=occ.uuid or "unknown",
            originUuid=occ.origin_uuid or occ.uuid or "unknown",
            rank=occ.rank or 1,
            occupation_id=occ.uuid or "unknown",
            occupation_code=occ.uuid or "unknown",
            occupation=occ.label or "Unknown",
            is_eligible=occ.is_eligible,
            final_score=occ.final_score,
            justification=occ.justification,
            description=occ.description,
        )
        for occ in result.occupations
    ]

    opportunities = [
        OpportunityRecommendation(
            uuid=opp.uuid or "unknown",
            originUuid=opp.url or opp.uuid or "unknown",
            rank=opp.rank or 1,
            opportunity_title=opp.opportunity_title or "Job opportunity",
            location=opp.location or "",
            is_eligible=opp.is_eligible,
            final_score=opp.final_score,
            justification=opp.justification,
            contract_type=opp.contract_type,
            employer=opp.employer,
            salary_range=opp.salary_text,
            posting_url=opp.url,
        )
        for opp in result.opportunities
    ]

    skill_gap_dicts = [
        {
            "skill_id": g.skill_id,
            "skill_label": g.skill_label,
            "proximity_score": g.proximity_score,
            "job_unlock_count": g.job_unlock_count,
            "combined_score": g.combined_score,
            "reasoning": g.reasoning,
        }
        for g in result.skill_gaps
    ]
    trainings = convert_skill_gaps_to_trainings(skill_gap_dicts)

    return Node2VecRecommendations(
        youth_id=result.user_id,
        occupation_recommendations=occupations,
        opportunity_recommendations=opportunities,
        skillstraining_recommendations=trainings,
        skill_gap_recommendations=skill_gap_dicts,
        algorithm_version=f"matching_service_{result.algorithm_version}",
        confidence=0.8,
    )


def _to_matching_skills_vector(skills_vector: Optional[dict]) -> MatchingSkillsVector:
    """Translate the agent's Compass skills_vector dict into the matching service's typed model.

    The agent passes `{"skills": [{preferred_label, origin_uuid, proficiency, ...}, ...]}`;
    the matching service expects `{"top_skills": [Skill(preferred_label, origin_uuid, proficiency)]}`.
    Entries missing the required identifiers are dropped.
    """
    if not skills_vector:
        return MatchingSkillsVector(top_skills=[])
    return MatchingSkillsVector(
        top_skills=[
            MatchingSkill(
                preferred_label=s["preferred_label"],
                origin_uuid=s["origin_uuid"],
                proficiency=float(s.get("proficiency", 0.5)),
            )
            for s in (skills_vector.get("skills") or [])
            if s.get("preferred_label") and s.get("origin_uuid")
        ]
    )


def _to_matching_preference_vector(preference_vector: Optional[PreferenceVector]) -> MatchingPreferenceVector:
    """Translate the agent's Bayesian PreferenceVector into the matching service's PreferenceVector.

    The two models use different dimension names (the agent uses importance scores like
    `financial_importance`; the matching service uses domain dimensions like
    `earnings_per_month`). Unmapped matching-service dimensions default to neutral 0.5.
    """
    if preference_vector is None:
        return MatchingPreferenceVector(
            earnings_per_month=0.5,
            physical_demand=0.5,
            social_interaction=0.5,
            career_growth=0.5,
        )
    return MatchingPreferenceVector(
        earnings_per_month=preference_vector.financial_importance,
        physical_demand=0.5,
        work_flexibility=preference_vector.work_life_balance_importance,
        social_interaction=0.5,
        career_growth=preference_vector.career_advancement_importance,
    )


class RecommendationInterface:
    """
    Interface for generating/loading recommendations.

    Abstracts away the source of recommendations (MatchingService or stubs)
    so the agent doesn't need to know about the implementation.
    """

    def __init__(self, matching_service: Optional[Any] = None, node2vec_client: Optional[Any] = None):
        """
        Initialize the recommendation interface.

        Args:
            matching_service: Optional MatchingService (v1 or v2) returning CompassMatchingResult.
            node2vec_client: Optional Node2Vec client (deprecated - use matching_service).
                            If None, uses stub recommendations.
        """
        self._matching_service = matching_service
        self._node2vec_client = node2vec_client  # Keep for backwards compatibility

    async def generate_recommendations(
        self,
        youth_id: str,
        city: Optional[str] = None,
        province: Optional[str] = None,
        preference_vector: Optional[PreferenceVector] = None,
        skills_vector: Optional[dict] = None,
        bws_scores: Optional[dict[str, float]] = None,
    ) -> Node2VecRecommendations:
        """
        Generate recommendations for a user.

        Tries MatchingService first, then Node2Vec, falls back to stubs if unavailable.

        Args:
            youth_id: User/youth identifier
            city: User's city (required by matching service)
            province: User's province/state (required by matching service)
            preference_vector: Preference vector from Epic 2
            skills_vector: Skills vector from Epic 4
            bws_scores: BWS ranking from Epic 2

        Returns:
            Node2VecRecommendations object (in agent format)
        """
        # Try MatchingService first (deployed service, v1 or v2)
        if self._matching_service:
            try:
                logger.info(
                    f"Generating recommendations for {youth_id} via MatchingService "
                    f"(version={self._matching_service.algorithm_version})"
                )
                result = await self._matching_service.generate_recommendations(
                    youth_id=youth_id,
                    city=city,
                    province=province,
                    skills_vector=_to_matching_skills_vector(skills_vector),
                    preference_vector=_to_matching_preference_vector(preference_vector),
                )

                # Convert unified CompassMatchingResult to agent format
                logger.debug("Converting CompassMatchingResult to agent format")
                return _compass_result_to_node2vec(result)

            except Exception as e:
                logger.warning(f"MatchingService failed, trying fallbacks: {e}")

        # Try Node2Vec client (legacy/local)
        if self._node2vec_client and NODE2VEC_AVAILABLE:
            try:
                logger.info(f"Generating recommendations for {youth_id} via Node2Vec (legacy)")
                raw_output = await self._node2vec_client.generate_recommendations(
                    youth_id=youth_id,
                    preference_vector=preference_vector,
                    skills_vector=skills_vector,
                    bws_scores=bws_scores
                )

                # Convert Jasmin's format to agent format
                logger.debug("Converting Node2Vec output to agent format")
                return Node2VecRecommendations.from_jasmin_output(raw_output)

            except Exception as e:
                logger.warning(f"Node2Vec failed, using stubs: {e}")

        # Return stub recommendations for development
        logger.info(f"Using stub recommendations for {youth_id}")
        return self.get_stub_recommendations(youth_id)
    
    def get_stub_recommendations(self, youth_id: str) -> Node2VecRecommendations:
        """
        Get stub recommendations for development without Node2Vec.

        These are realistic sample recommendations for testing the agent,
        based on a Lusaka youth persona with informal sector background.

        PERSONA: Chanda, 24, Lusaka
        - Completed Grade 12, some TEVETA vocational training
        - Has worked casual piece jobs at construction sites, helped uncle with electrical repairs
        - Good with hands, basic phone/mobile money skills
        - Wants stable income but values flexibility
        - Family expects him to contribute financially

        Args:
            youth_id: User/youth identifier

        Returns:
            Node2VecRecommendations with sample data
        """
        return Node2VecRecommendations(
            youth_id=youth_id,
            occupation_recommendations=[
                OccupationRecommendation(
                    uuid="occ_001_uuid",
                    originUuid="esco_7411_origin",
                    rank=1,
                    occupation_id="ESCO_7411",
                    occupation_code="7411",
                    occupation="Electrician / Electrical Fitter",
                    confidence_score=0.88,
                    justification="Your hands-on experience helping your uncle with electrical repairs gives you a strong foundation. High demand in Lusaka's growing construction and real estate sector.",
                    skills_match_score=0.82,
                    preference_match_score=0.85,
                    labor_demand_score=0.92,
                    graph_proximity_score=0.88,
                    essential_skills=[
                        "Basic wiring and installation",
                        "Reading electrical diagrams",
                        "Safety procedures",
                        "Using multimeter and tools",
                        "Customer communication"
                    ],
                    user_skill_coverage=0.55,
                    skill_gaps=["TEVETA trade certificate", "Industrial wiring"],
                    description="Electricians install, maintain, and repair electrical wiring and systems in homes, offices, and industrial sites.",
                    typical_tasks=[
                        "Install and repair electrical wiring in buildings",
                        "Fix faulty sockets, switches, and lighting",
                        "Install ceiling fans and water heaters",
                        "Troubleshoot electrical problems",
                        "Quote jobs and collect payment from clients"
                    ],
                    career_path_next_steps=[
                        "Apprentice/Helper → Qualified Electrician (1-2 years)",
                        "Qualified → TEVETA Certified Electrician",
                        "Certified → Contractor/Own business",
                        "Specialize in solar installation (growing demand in Zambia)"
                    ],
                    labor_demand_category="high",
                    salary_range="ZMW 150-400/day (piece work) or ZMW 4,000-9,000/month (employed)"
                ),
                OccupationRecommendation(
                    uuid="occ_002_uuid",
                    originUuid="esco_8322_origin",
                    rank=2,
                    occupation_id="ESCO_8322",
                    occupation_code="8322",
                    occupation="Motorbike / Delivery Rider",
                    confidence_score=0.79,
                    justification="Offers immediate income and flexibility you value. Your knowledge of Lusaka roads is an asset. Can start quickly while building other skills.",
                    skills_match_score=0.70,
                    preference_match_score=0.88,
                    labor_demand_score=0.85,
                    graph_proximity_score=0.72,
                    essential_skills=[
                        "Motorcycle riding (valid RTSA license)",
                        "Knowledge of local routes",
                        "Basic phone/mobile money skills",
                        "Customer service",
                        "Time management"
                    ],
                    user_skill_coverage=0.75,
                    skill_gaps=["Motorcycle license (if not yet obtained)"],
                    description="Motorbike riders provide passenger transport and delivery services using motorcycles (similar to boda boda in East Africa).",
                    typical_tasks=[
                        "Transport passengers around the city",
                        "Deliver food, packages, and goods",
                        "Navigate traffic efficiently",
                        "Manage daily earnings and fuel costs",
                        "Maintain motorcycle in good condition"
                    ],
                    career_path_next_steps=[
                        "Rider (employed) → Own motorcycle",
                        "Join local delivery networks",
                        "Build regular customer base",
                        "Grow to 2-3 bikes with riders (fleet owner)"
                    ],
                    labor_demand_category="high",
                    salary_range="ZMW 100-300/day depending on hustle"
                ),
                OccupationRecommendation(
                    uuid="occ_003_uuid",
                    originUuid="esco_9329_origin",
                    rank=3,
                    occupation_id="ESCO_9329",
                    occupation_code="9329",
                    occupation="Warehouse / Logistics Handler",
                    confidence_score=0.74,
                    justification="Your experience with casual piece work in construction is transferable. Warehouse roles at Shoprite, Zambeef, or distribution centres offer better pay and some job security.",
                    skills_match_score=0.78,
                    preference_match_score=0.65,
                    labor_demand_score=0.80,
                    graph_proximity_score=0.75,
                    essential_skills=[
                        "Physical fitness and stamina",
                        "Following safety protocols",
                        "Basic cargo handling",
                        "Teamwork",
                        "Punctuality and reliability"
                    ],
                    user_skill_coverage=0.70,
                    skill_gaps=["Forklift certification", "Inventory management basics"],
                    description="Warehouse handlers load, unload, and move goods at warehouses, distribution centres, and retail depots.",
                    typical_tasks=[
                        "Load and unload goods from trucks",
                        "Operate basic warehouse equipment",
                        "Sort and stack stock",
                        "Follow health and safety procedures",
                        "Work in shifts (day/night)"
                    ],
                    career_path_next_steps=[
                        "Casual piece worker → Permanent handler",
                        "Get forklift/equipment certification (TEVETA)",
                        "Handler → Supervisor/Stock controller",
                        "Move to logistics and supply chain roles"
                    ],
                    labor_demand_category="medium",
                    salary_range="ZMW 100-250/day (casual) or ZMW 3,500-7,000/month (permanent)"
                ),
                OccupationRecommendation(
                    uuid="occ_004_uuid",
                    originUuid="esco_7233_origin",
                    rank=4,
                    occupation_id="ESCO_7233",
                    occupation_code="7233",
                    occupation="Diesel Mechanic / Plant Fitter",
                    confidence_score=0.71,
                    justification="Zambia's mining and construction sectors have strong demand for plant fitters and diesel mechanics. Combines your electrical knowledge with mechanical work.",
                    skills_match_score=0.68,
                    preference_match_score=0.75,
                    labor_demand_score=0.70,
                    graph_proximity_score=0.72,
                    essential_skills=[
                        "Engine diagnostics and repair",
                        "Basic electrical troubleshooting",
                        "Hydraulic systems knowledge",
                        "Preventive maintenance",
                        "Customer negotiation"
                    ],
                    user_skill_coverage=0.45,
                    skill_gaps=["Diesel engine training", "Hydraulics basics"],
                    description="Diesel mechanics and plant fitters repair and maintain heavy equipment, generators, and vehicles used in mining, construction, and transport.",
                    typical_tasks=[
                        "Diagnose and repair engine faults",
                        "Service and maintain heavy machinery",
                        "Replace worn parts and components",
                        "Perform routine preventive maintenance",
                        "Work at mine sites or construction sites"
                    ],
                    career_path_next_steps=[
                        "Apprentice with experienced mechanic",
                        "Get TEVETA trade certificate in diesel mechanics",
                        "Build reputation with mining companies (Konkola, Mopani)",
                        "Open own repair workshop"
                    ],
                    labor_demand_category="medium",
                    salary_range="ZMW 200-600/job (freelance) or ZMW 5,000-12,000/month (mining sector)"
                ),
                OccupationRecommendation(
                    uuid="occ_005_uuid",
                    originUuid="esco_5221_origin",
                    rank=5,
                    occupation_id="ESCO_5221",
                    occupation_code="5221",
                    occupation="Market Vendor / Trader",
                    confidence_score=0.68,
                    justification="Low startup cost, flexible hours, and potential to grow. Your mobile money skills help with transactions.",
                    skills_match_score=0.60,
                    preference_match_score=0.80,
                    labor_demand_score=0.75,
                    graph_proximity_score=0.65,
                    essential_skills=[
                        "Basic math and pricing",
                        "Customer service",
                        "Airtel Money / MTN Money transactions",
                        "Negotiation",
                        "Stock management"
                    ],
                    user_skill_coverage=0.65,
                    skill_gaps=["Sourcing goods at good prices", "Business record-keeping"],
                    description="Market vendors sell goods (food, household items, phone accessories, etc.) at markets, streets, or small stalls.",
                    typical_tasks=[
                        "Source and buy goods for resale",
                        "Set up stall and display products",
                        "Negotiate prices with customers",
                        "Manage daily cash and mobile money payments",
                        "Track what sells well"
                    ],
                    career_path_next_steps=[
                        "Start small (phone accessories, fruits, vegetables)",
                        "Build regular customers",
                        "Get permanent stall at Lusaka City Market or Soweto Market",
                        "Grow to wholesale or multiple stalls"
                    ],
                    labor_demand_category="medium",
                    salary_range="ZMW 50-200/day profit (depends on product and location)"
                )
            ],
            opportunity_recommendations=[
                OpportunityRecommendation(
                    uuid="opp_001_uuid",
                    originUuid="job_001_origin",
                    rank=1,
                    opportunity_title="Electrical Apprenticeship - Lusaka Construction Site",
                    location="Lusaka (various sites)",
                    justification="Learn from qualified electricians while earning. Foremen at major sites are often willing to train hardworking apprentices.",
                    essential_skills=["Basic wiring", "Willingness to learn", "Physical work"],
                    employer="Local construction contractors",
                    salary_range="ZMW 80-150/day + skills training",
                    contract_type="contract",
                    related_occupation_id="occ_001_uuid"
                ),
                OpportunityRecommendation(
                    uuid="opp_002_uuid",
                    originUuid="job_002_origin",
                    rank=2,
                    opportunity_title="Motorbike Delivery Rider",
                    location="Lusaka (various zones)",
                    justification="Flexible hours, paid per delivery or daily rate. Good way to earn while exploring other opportunities.",
                    essential_skills=["Motorcycle + RTSA license", "Smartphone", "Airtel Money / MTN Money"],
                    employer="Local courier companies / restaurants",
                    salary_range="ZMW 80-200/day",
                    contract_type="freelance",
                    related_occupation_id="occ_002_uuid"
                ),
                OpportunityRecommendation(
                    uuid="opp_003_uuid",
                    originUuid="job_003_origin",
                    rank=3,
                    opportunity_title="Warehouse Handler - Shoprite / Zambeef Distribution",
                    location="Lusaka",
                    justification="Regular work available at large retail and food distribution companies. Permanent positions offer NAPSA and NHIMA benefits.",
                    essential_skills=["Physical fitness", "Reliability", "Safety awareness"],
                    employer="Shoprite Zambia / Zambeef Products",
                    salary_range="ZMW 3,500-6,000/month",
                    contract_type="contract",
                    related_occupation_id="occ_003_uuid"
                )
            ],
            skillstraining_recommendations=[
                SkillsTrainingRecommendation(
                    uuid="skill_001_uuid",
                    originUuid="training_001_origin",
                    rank=1,
                    skill="Electrical Installation (TEVETA Certification)",
                    training_title="Electrician Trade Certificate - TEVETA",
                    provider="Lusaka Technical and Vocational College (LTVC) / TEVETA-registered centre",
                    estimated_hours=160,
                    justification="A TEVETA trade certificate opens doors to formal employment and higher-paying contracts. Many companies and construction firms require certified electricians.",
                    cost="ZMW 2,000-4,000",
                    location="Lusaka",
                    delivery_mode="in_person",
                    target_occupations=["Electrician", "Maintenance Technician"],
                    fills_gap_for=["occ_001_uuid"]
                ),
                SkillsTrainingRecommendation(
                    uuid="skill_002_uuid",
                    originUuid="training_002_origin",
                    rank=2,
                    skill="Solar Panel Installation",
                    training_title="Solar PV Installation Training",
                    provider="ZESCO / Various NGOs / TEVETA-registered providers",
                    estimated_hours=40,
                    justification="Solar energy is growing rapidly in Zambia due to load-shedding and rural electrification. Adds to your electrical skills and pays well.",
                    cost="Free - ZMW 2,000 (NGO programs often subsidized)",
                    location="Lusaka / Copperbelt",
                    delivery_mode="hybrid",
                    target_occupations=["Solar Technician", "Electrician"],
                    fills_gap_for=["occ_001_uuid"]
                ),
                SkillsTrainingRecommendation(
                    uuid="skill_003_uuid",
                    originUuid="training_003_origin",
                    rank=3,
                    skill="Motorcycle Riding License",
                    training_title="RTSA Motorcycle License (Class A)",
                    provider="RTSA-approved Driving Schools",
                    estimated_hours=20,
                    justification="Required for legal motorbike work and delivery. Protects you legally and opens formal delivery opportunities.",
                    cost="ZMW 500-1,000",
                    location="Lusaka driving schools",
                    delivery_mode="in_person",
                    target_occupations=["Motorbike Rider", "Delivery Driver"],
                    fills_gap_for=["occ_002_uuid"]
                ),
                SkillsTrainingRecommendation(
                    uuid="skill_004_uuid",
                    originUuid="training_004_origin",
                    rank=4,
                    skill="Forklift Operation",
                    training_title="Forklift Operator Certificate - TEVETA",
                    provider="TEVETA Industrial Training Centres / Lusaka",
                    estimated_hours=40,
                    justification="Certified forklift operators earn significantly more in warehouses and distribution centres. Opens path to supervisor roles.",
                    cost="ZMW 1,000-2,500",
                    location="Lusaka",
                    delivery_mode="in_person",
                    target_occupations=["Forklift Operator", "Warehouse Supervisor"],
                    fills_gap_for=["occ_003_uuid"]
                )
            ],
            confidence=0.82
        )

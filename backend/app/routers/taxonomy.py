"""
Taxonomy API endpoints for occupations, skills, and relations
"""

from fastapi import APIRouter, HTTPException, Query #type:ignore
from typing import Optional, Dict, Any
from bson import ObjectId #type:ignore
from motor.motor_asyncio import AsyncIOMotorClient #type:ignore
import os
from dotenv import load_dotenv #type:ignore

from app.taxonomy.models import (
    TaxonomyCollections,
    DataSource,
    OccupationType
)

load_dotenv()

router = APIRouter(prefix="/api/taxonomy", tags=["taxonomy"])

# Database connection (singleton pattern)
_db_client = None
_taxonomy_db = None


def get_taxonomy_db():
    """Get taxonomy database connection"""
    global _db_client, _taxonomy_db
    
    if _taxonomy_db is None:
        mongodb_uri = os.getenv("TAXONOMY_MONGODB_URI", "mongodb://localhost:27017")
        db_name = os.getenv("TAXONOMY_DATABASE_NAME", "taxonomy_db")
        
        _db_client = AsyncIOMotorClient(mongodb_uri)
        _taxonomy_db = _db_client[db_name]
    
    return _taxonomy_db


@router.get("/occupations", response_model=Dict[str, Any])
async def list_occupations(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of records to return"),
    search: Optional[str] = Query(None, description="Search in occupation titles"),
    source: Optional[DataSource] = Query(None, description="Filter by data source"),
    is_relevant_for_kenya: Optional[bool] = Query(None, description="Filter by Kenya relevance"),
    is_informal_sector: Optional[bool] = Query(None, description="Filter by informal sector"),
):
    """
    List occupations with filtering and pagination
    
    Returns:
        - occupations: List of occupation objects
        - total: Total count matching filters
        - skip: Current offset
        - limit: Page size
    """
    taxonomy_db = get_taxonomy_db()
    collection = taxonomy_db[TaxonomyCollections.OCCUPATIONS]
    
    # Build filter
    filter_query = {}
    
    if search:
        filter_query["$or"] = [
            {"preferred_label": {"$regex": search, "$options": "i"}},
            {"alt_labels": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    if source:
        filter_query["source"] = source
    
    if is_relevant_for_kenya is not None:
        filter_query["is_relevant_for_kenya"] = is_relevant_for_kenya
    
    if is_informal_sector is not None:
        filter_query["is_informal_sector"] = is_informal_sector
    
    # Get total count
    total = await collection.count_documents(filter_query)
    
    # Get paginated results
    cursor = collection.find(filter_query).skip(skip).limit(limit)
    occupations = []
    
    async for doc in cursor:
        # Convert ObjectId to string for JSON serialization
        doc["_id"] = str(doc["_id"])
        if "taxonomy_model_id" in doc:
            doc["taxonomy_model_id"] = str(doc["taxonomy_model_id"])
        occupations.append(doc)
    
    return {
        "occupations": occupations,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/occupations/{occupation_id}", response_model=Dict[str, Any])
async def get_occupation(occupation_id: str):
    """
    Get a single occupation by ID
    
    Args:
        occupation_id: MongoDB ObjectId as string
    
    Returns:
        Occupation document
    """
    taxonomy_db = get_taxonomy_db()
    collection = taxonomy_db[TaxonomyCollections.OCCUPATIONS]
    
    # Validate ObjectId
    if not ObjectId.is_valid(occupation_id):
        raise HTTPException(status_code=400, detail="Invalid occupation ID format")
    
    # Find occupation
    occupation = await collection.find_one({"_id": ObjectId(occupation_id)})
    
    if not occupation:
        raise HTTPException(status_code=404, detail="Occupation not found")
    
    # Convert ObjectIds to strings
    occupation["_id"] = str(occupation["_id"])
    if "taxonomy_model_id" in occupation:
        occupation["taxonomy_model_id"] = str(occupation["taxonomy_model_id"])
    
    return occupation


@router.get("/occupations/{occupation_id}/skills", response_model=Dict[str, Any])
async def get_occupation_skills(
    occupation_id: str,
    relation_type: Optional[str] = Query(None, description="Filter by 'essential' or 'optional'"),
):
    """
    Get all skills required for an occupation
    
    Args:
        occupation_id: MongoDB ObjectId as string
        relation_type: Filter by essential or optional skills
    
    Returns:
        - occupation: Occupation details
        - skills: List of skills with relation info
        - total: Total skills count
    """
    taxonomy_db = get_taxonomy_db()
    
    # Validate ObjectId
    if not ObjectId.is_valid(occupation_id):
        raise HTTPException(status_code=400, detail="Invalid occupation ID format")
    
    # Get occupation
    occupation = await taxonomy_db[TaxonomyCollections.OCCUPATIONS].find_one(
        {"_id": ObjectId(occupation_id)}
    )
    
    if not occupation:
        raise HTTPException(status_code=404, detail="Occupation not found")
    
    # Build filter for relations
    relations_filter = {"occupation_id": occupation_id}
    if relation_type:
        relations_filter["relation_type"] = relation_type.lower()
    
    # Get skill relations
    relations_cursor = taxonomy_db[TaxonomyCollections.OCCUPATION_SKILL_RELATIONS].find(
        relations_filter
    )
    
    # Collect skill IDs
    skill_relations = {}
    async for relation in relations_cursor:
        skill_id = relation["skill_id"]
        skill_relations[skill_id] = {
            "relation_type": relation["relation_type"],
            "signalling_value": relation.get("signalling_value"),
            "is_critical_for_kenya": relation.get("is_critical_for_kenya", False)
        }
    
    # Get skills
    skill_ids = [ObjectId(sid) for sid in skill_relations.keys() if ObjectId.is_valid(sid)]
    skills_cursor = taxonomy_db[TaxonomyCollections.SKILLS].find(
        {"_id": {"$in": skill_ids}}
    )
    
    skills = []
    async for skill in skills_cursor:
        skill_id_str = str(skill["_id"])
        skill["_id"] = skill_id_str
        if "taxonomy_model_id" in skill:
            skill["taxonomy_model_id"] = str(skill["taxonomy_model_id"])
        
        # Add relation info
        skill["relation_info"] = skill_relations.get(skill_id_str, {})
        skills.append(skill)
    
    # Convert occupation ObjectIds
    occupation["_id"] = str(occupation["_id"])
    if "taxonomy_model_id" in occupation:
        occupation["taxonomy_model_id"] = str(occupation["taxonomy_model_id"])
    
    return {
        "occupation": occupation,
        "skills": skills,
        "total": len(skills)
    }


@router.get("/skills", response_model=Dict[str, Any])
async def list_skills(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search in skill names"),
    skill_type: Optional[str] = Query(None, description="Filter by skill type"),
):
    """
    List skills with filtering and pagination
    
    Returns:
        - skills: List of skill objects
        - total: Total count matching filters
        - skip: Current offset
        - limit: Page size
    """
    taxonomy_db = get_taxonomy_db()
    collection = taxonomy_db[TaxonomyCollections.SKILLS]
    
    # Build filter
    filter_query = {}
    
    if search:
        filter_query["$or"] = [
            {"preferred_label": {"$regex": search, "$options": "i"}},
            {"alt_labels": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    if skill_type:
        filter_query["skill_type"] = skill_type
    
    # Get total count
    total = await collection.count_documents(filter_query)
    
    # Get paginated results
    cursor = collection.find(filter_query).skip(skip).limit(limit)
    skills = []
    
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "taxonomy_model_id" in doc:
            doc["taxonomy_model_id"] = str(doc["taxonomy_model_id"])
        skills.append(doc)
    
    return {
        "skills": skills,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/skills/{skill_id}/occupations", response_model=Dict[str, Any])
async def get_skill_occupations(skill_id: str):
    """
    Get all occupations that require this skill
    
    Args:
        skill_id: MongoDB ObjectId as string
    
    Returns:
        - skill: Skill details
        - occupations: List of occupations requiring this skill
        - total: Total occupations count
    """
    taxonomy_db = get_taxonomy_db()
    
    # Validate ObjectId
    if not ObjectId.is_valid(skill_id):
        raise HTTPException(status_code=400, detail="Invalid skill ID format")
    
    # Get skill
    skill = await taxonomy_db[TaxonomyCollections.SKILLS].find_one(
        {"_id": ObjectId(skill_id)}
    )
    
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    # Get occupation relations
    relations_cursor = taxonomy_db[TaxonomyCollections.OCCUPATION_SKILL_RELATIONS].find(
        {"skill_id": skill_id}
    )
    
    # Collect occupation IDs with relation info
    occupation_relations = {}
    async for relation in relations_cursor:
        occ_id = relation["occupation_id"]
        occupation_relations[occ_id] = {
            "relation_type": relation["relation_type"],
            "signalling_value": relation.get("signalling_value")
        }
    
    # Get occupations
    occupation_ids = [ObjectId(oid) for oid in occupation_relations.keys() if ObjectId.is_valid(oid)]
    occupations_cursor = taxonomy_db[TaxonomyCollections.OCCUPATIONS].find(
        {"_id": {"$in": occupation_ids}}
    )
    
    occupations = []
    async for occupation in occupations_cursor:
        occ_id_str = str(occupation["_id"])
        occupation["_id"] = occ_id_str
        if "taxonomy_model_id" in occupation:
            occupation["taxonomy_model_id"] = str(occupation["taxonomy_model_id"])
        
        # Add relation info
        occupation["relation_info"] = occupation_relations.get(occ_id_str, {})
        occupations.append(occupation)
    
    # Convert skill ObjectIds
    skill["_id"] = str(skill["_id"])
    if "taxonomy_model_id" in skill:
        skill["taxonomy_model_id"] = str(skill["taxonomy_model_id"])
    
    return {
        "skill": skill,
        "occupations": occupations,
        "total": len(occupations)
    }


@router.post("/occupations", response_model=Dict[str, Any], status_code=201)
async def create_custom_occupation(occupation_data: Dict[str, Any]):
    """
    Create a custom Kenyan occupation (e.g., Boda Boda Rider)
    
    Args:
        occupation_data: Occupation details
    
    Returns:
        Created occupation with assigned ID
    """
    taxonomy_db = get_taxonomy_db()
    collection = taxonomy_db[TaxonomyCollections.OCCUPATIONS]
    
    # Validate required fields
    required_fields = ["code", "preferred_label"]
    for field in required_fields:
        if field not in occupation_data:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required field: {field}"
            )
    
    # Set defaults for custom occupations
    occupation_data.setdefault("source", DataSource.CUSTOM)
    occupation_data.setdefault("occupation_type", OccupationType.LOCAL_OCCUPATION)
    occupation_data.setdefault("is_relevant_for_kenya", True)
    occupation_data.setdefault("added_by", "api")
    
    # Get taxonomy model ID from config
    from app.taxonomy.importers.config import TAXONOMY_MODEL_ID
    occupation_data.setdefault("taxonomy_model_id", str(TAXONOMY_MODEL_ID))
    
    # Insert occupation
    try:
        result = await collection.insert_one(occupation_data)
        
        # Fetch created document
        created = await collection.find_one({"_id": result.inserted_id})
        created["_id"] = str(created["_id"])
        if "taxonomy_model_id" in created:
            created["taxonomy_model_id"] = str(created["taxonomy_model_id"])
        
        return created
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create occupation: {str(e)}")


@router.patch("/occupations/{occupation_id}", response_model=Dict[str, Any])
async def update_occupation(
    occupation_id: str,
    update_data: Dict[str, Any]
):
    """
    Update occupation fields (e.g., Kenya relevance flags)
    
    Args:
        occupation_id: MongoDB ObjectId as string
        update_data: Fields to update
    
    Returns:
        Updated occupation
    """
    taxonomy_db = get_taxonomy_db()
    collection = taxonomy_db[TaxonomyCollections.OCCUPATIONS]
    
    # Validate ObjectId
    if not ObjectId.is_valid(occupation_id):
        raise HTTPException(status_code=400, detail="Invalid occupation ID format")
    
    # Check occupation exists
    existing = await collection.find_one({"_id": ObjectId(occupation_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Occupation not found")
    
    # Allowed fields to update
    allowed_fields = [
        "is_relevant_for_kenya",
        "is_informal_sector",
        "is_entrepreneurship",
        "kenya_specific_notes"
    ]
    
    # Filter update data
    filtered_update = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not filtered_update:
        raise HTTPException(
            status_code=400,
            detail=f"No valid fields to update. Allowed: {allowed_fields}"
        )
    
    # Update occupation
    await collection.update_one(
        {"_id": ObjectId(occupation_id)},
        {"$set": filtered_update}
    )
    
    # Fetch updated document
    updated = await collection.find_one({"_id": ObjectId(occupation_id)})
    updated["_id"] = str(updated["_id"])
    if "taxonomy_model_id" in updated:
        updated["taxonomy_model_id"] = str(updated["taxonomy_model_id"])
    
    return updated
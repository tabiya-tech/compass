import argparse
import asyncio
import logging
from collections import deque
from textwrap import dedent

from bson import ObjectId
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorCollection
from pydantic import BaseModel
from pydantic_settings import BaseSettings

from common_libs.database.get_mongo_db_connection import get_mongo_db_connection
from common_libs.logging.log_utilities import setup_logging_config


# ====================== TYPES ==================================
class CollectionNames(BaseModel):
    skills: str
    skill_groups: str
    skill_hierarchies: str


class Settings(BaseSettings):
    taxonomy_model_id: str

    source_mongo_db_uri: str
    source_mongo_db_name: str
    source_collection_names: CollectionNames

    target_mongo_db_uri: str
    target_mongo_db_name: str
    target_collection_names: str

    class Config:
        env_prefix = "GENERATE_SKILLS_WITH_GROUPS_SCRIPT_"


class TaxonomyEntity(BaseModel):
    id: str
    UUID: str
    preferred_label: str


class SkillHierarchy(BaseModel):
    child_id: str
    child_type: str
    parent_id: str
    parent_type: str


# ====================== FUNCTIONS ==================================

skills_with_parent_links_cache = {}


def fetch_skill_parents_links(skill_hierarchies: list[SkillHierarchy], skill_id: str) -> list[SkillHierarchy]:
    """
    Returns a list of links to the parents of a given skill.
    """

    # if a skill_id is already cached, return it
    if skill_id in skills_with_parent_links_cache:
        return skills_with_parent_links_cache[skill_id]

    parent_links: list[SkillHierarchy] = []
    for link in skill_hierarchies:
        if link.child_id == skill_id:
            parent_links.append(link)

    # Update the cache with the found parent links
    skills_with_parent_links_cache[skill_id] = parent_links
    return parent_links


def filter_out_to_skills_links(skill_hierarchies: list[SkillHierarchy]) -> list[SkillHierarchy]:
    """
    From the list of skill hierarchies, filter out the ones, which parent is not a skill group.
    """

    to_skill_groups_links = []
    for hierarchy in skill_hierarchies:
        if hierarchy.parent_type == "skillgroup":
            to_skill_groups_links.append(hierarchy)

    return to_skill_groups_links


def get_parent_skill_groups_links(skill_hierarchies: list[SkillHierarchy], skill_id: str) -> list[SkillHierarchy]:
    """
    Returns a list of links where the skill is a child, and the parent is a skill group.
    """

    # queue holds skill IDs to explore upward
    queue = deque([str(skill_id)])
    visited = set()  # guard against cycles

    links_to_skill_group: list[SkillHierarchy] = []  # container of the groups to return to the user.

    while queue:
        current_id = queue.popleft()
        if current_id in visited:
            continue

        visited.add(current_id)

        parent_hierarchies_docs = fetch_skill_parents_links(skill_hierarchies, current_id)

        # If the *starting* node has no parents, log an error and return an empty list.
        if not parent_hierarchies_docs and current_id == str(skill_id):
            logger.error(f"No parents found for skill: {skill_id}")
            return []

        # Case 1: if this node has direct links to skill groups, take them.
        skill_groups_parents_hierarchies_docs = filter_out_to_skills_links(parent_hierarchies_docs)
        if skill_groups_parents_hierarchies_docs:
            links_to_skill_group.extend(skill_groups_parents_hierarchies_docs)
            continue

        # Case 2: no direct groups here — keep traversing upward via the parents' parentId
        # Only skills are left in this case, because only a skill can have a (skill-group, or skill) parent.
        for to_skills_links in parent_hierarchies_docs:
            parent_id = to_skills_links.parent_id
            if parent_id and parent_id not in visited:
                queue.append(parent_id)

    return links_to_skill_group


def deduplicate_skill_hierarchies(skill_hierarchies: list[SkillHierarchy]) -> list[SkillHierarchy]:
    """
    Deduplicates skill hierarchies by parent id;
    """

    seen = set()
    deduplicated = []
    for hierarchy in skill_hierarchies:
        if hierarchy.parent_id not in seen:
            seen.add(hierarchy.parent_id)
            deduplicated.append(hierarchy)

    return deduplicated


setup_logging_config("logging.cfg.yaml")

logger = logging.getLogger(__name__)


def get_skill_groups_map(skill_groups: list[TaxonomyEntity]) -> dict[str, TaxonomyEntity]:
    skill_groups_map = {}

    for skill_group in skill_groups:
        skill_groups_map[skill_group.id] = skill_group

    return skill_groups_map


# ====================== REPOSITORIES ==================================
async def get_skills(collection: AsyncIOMotorCollection, filter_query: dict) -> list[TaxonomyEntity]:
    """
    Fetches skills from the database based on the provided filter query.
    """
    cursor = collection.find(filter_query, {"UUID": 1, "preferredLabel": 1})
    return [TaxonomyEntity(
        id=doc["_id"].__str__(),
        preferred_label=doc["preferredLabel"],
        UUID=doc["UUID"]
    ) async for doc in cursor.batch_size(2000)]


async def get_skill_groups(collection: AsyncIOMotorCollection, filter_query: dict) -> list[TaxonomyEntity]:
    """
    Fetches skill groups from the database based on the provided filter query.
    """
    cursor = collection.find(filter_query, {"UUID": 1, "preferredLabel": 1})
    return [TaxonomyEntity(
        id=doc["_id"].__str__(),
        preferred_label=doc["preferredLabel"],
        UUID=doc["UUID"]
    ) async for doc in cursor.batch_size(2000)]


async def get_skills_hierarchies(collection: AsyncIOMotorCollection, filter_query: dict) -> list[SkillHierarchy]:
    """
    Fetches skill hierarchies from the database based on the provided filter query.
    """
    cursor = collection.find(filter_query, {"childId": 1, "childType": 1, "parentId": 1, "parentType": 1})
    return [SkillHierarchy(
        child_id=doc["childId"].__str__(),
        child_type=doc["childType"],
        parent_id=doc["parentId"].__str__(),
        parent_type=doc["parentType"]
    ) async for doc in cursor.batch_size(2000)]


# ====================== MAIN ==================================

async def main():
    logger.info("Starting to generate skills with groups import script...")
    settings = Settings()  # type: ignore

    db = get_mongo_db_connection(settings.source_mongo_db_uri, settings.source_mongo_db_name)

    filter_query = {"modelId": {"$eq": ObjectId(settings.taxonomy_model_id)}}
    try:
        skills, skill_groups, skill_hierarchies = await asyncio.gather(
            get_skills(db.get_collection(settings.source_collection_names.skills), filter_query),
            get_skill_groups(db.get_collection(settings.source_collection_names.skill_groups), filter_query),
            get_skills_hierarchies(db.get_collection(settings.source_collection_names.skill_hierarchies), filter_query)
        )

        logger.info(f"Total skills fetched: {len(skills)}")
        logger.info(f"Total skill groups fetched: {len(skill_groups)}")
        logger.info(f"Total skill hierarchy fetched: {len(skill_hierarchies)}")

        skill_groups_map = get_skill_groups_map(skill_groups)

        skills_with_groups = []
        for skill in skills:
            # logger.info(f"Fetching skill groups for skill: {skill.preferred_label}")
            skill_groups_parents = get_parent_skill_groups_links(skill_hierarchies, skill.id)
            # remove duplicates
            skill_groups_parents = deduplicate_skill_hierarchies(skill_groups_parents)
            formatted_skill_groups = []

            if len(skill_groups_parents) == 0:
                logger.error(f"No skill groups found for skill: {skill.preferred_label} (UUID: {skill.UUID})")
                continue

            for _hierarchy in skill_groups_parents:
                skill_group = skill_groups_map[_hierarchy.parent_id]
                formatted_skill_groups.append({
                    "UUID": skill_group.UUID,
                    "preferredLabel": skill_group.preferred_label
                })

            skills_with_groups.append({
                "modelId": ObjectId(settings.taxonomy_model_id),
                "UUID": skill.UUID,
                "preferredLabel": skill.preferred_label,
                "skillGroups": formatted_skill_groups
            })

        target_db = get_mongo_db_connection(
            settings.target_mongo_db_uri, settings.target_mongo_db_name)
        target_collection = target_db[settings.target_collection_names]

        await target_collection.delete_many(filter_query)
        await target_collection.insert_many(skills_with_groups)

        # create an index on UUID and modelId
        await target_collection.create_index("UUID", unique=True)
    except Exception as e:
        logger.error(f"An error occurred while processing skills: {e}")
        db.client.close()
        raise


if __name__ == "__main__":
    # 1. load environment variables form .env
    parser = argparse.ArgumentParser(description=dedent("""
                                    This script generates skills with associated skill groups.
                                    Used temporally to generate skills with groups from the taxonomy database.
                                    
                                    It saves the data into the database specified in the environment variables.
                                    """),
                                     formatter_class=argparse.RawTextHelpFormatter)

    parser.parse_args()

    load_dotenv()
    asyncio.run(main())

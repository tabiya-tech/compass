import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase #type:ignore
from bson import ObjectId #type:ignore
from datetime import datetime, timezone
from typing import Dict

from app.taxonomy.models import TaxonomyCollections
from .config import MONGODB_URI, TAXONOMY_DB_NAME

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def inherit_skills_for_matched_kesco(db: AsyncIOMotorDatabase) -> Dict[str, int]:
    """
    Inherit skill relations from ESCO to auto-matched KeSCO occupations.
    
    Args:
        db: MongoDB database connection
        
    Returns:
        Dictionary with statistics
    """
    logger.info("Starting skill inheritance for auto-matched KeSCO occupations...")
    
    occupations_coll = db[TaxonomyCollections.OCCUPATIONS]
    relations_coll = db[TaxonomyCollections.OCCUPATION_SKILL_RELATIONS]
    
    stats = {
        'total_matched': 0,
        'occupations_with_skills': 0,
        'total_skills_inherited': 0,
        'occupations_no_skills': 0
    }
    
    # Find all auto-matched KeSCO occupations
    cursor = occupations_coll.find({
        "source": "KeSCO",
        "mapped_to_esco_id": {"$exists": True, "$ne": None}
    })
    
    matched_kesco = await cursor.to_list(length=None)
    stats['total_matched'] = len(matched_kesco)
    
    logger.info(f"Found {stats['total_matched']} auto-matched KeSCO occupations")
    
    for i, kesco_occ in enumerate(matched_kesco, 1):
        kesco_id = kesco_occ['_id']
        esco_id_str = kesco_occ['mapped_to_esco_id']
        esco_id = ObjectId(esco_id_str)
        
        # Find all skills for the matched ESCO occupation
        esco_relations_cursor = relations_coll.find({
            'occupation_id': esco_id_str
        })
        esco_relations = await esco_relations_cursor.to_list(length=None)
        
        if esco_relations:
            # Create new relations for KeSCO occupation
            new_relations = []
            for rel in esco_relations:
                new_rel = {
                    'occupation_id': str(kesco_id),
                    'skill_id': rel['skill_id'],
                    'relation_type': rel.get('relation_type', 'essential'),
                    'signalling_value': rel.get('signalling_value'),
                    'signalling_value_label': rel.get('signalling_value_label'),
                    'inherited_from_esco_id': esco_id_str,
                    'source': 'inherited_from_esco',
                    'created_at': datetime.now(timezone.utc)
                }
                new_relations.append(new_rel)
            
            # Bulk insert
            if new_relations:
                try:
                    await relations_coll.insert_many(new_relations)
                    stats['total_skills_inherited'] += len(new_relations)
                    stats['occupations_with_skills'] += 1
                    
                    # Update KeSCO occupation to mark it has inherited skills
                    await occupations_coll.update_one(
                        {'_id': kesco_id},
                        {
                            '$set': {
                                'has_inherited_skills': True,
                                'inherited_skills_count': len(new_relations),
                                'updated_at': datetime.now(timezone.utc)
                            }
                        }
                    )
                except Exception as e:
                    logger.error(f"Error inserting skills for {kesco_occ.get('preferred_label')}: {e}")
        else:
            stats['occupations_no_skills'] += 1
        
        if i % 50 == 0 or i == stats['total_matched']:
            logger.info(f"Processed {i}/{stats['total_matched']} occupations...")
    
    logger.info("\n" + "=" * 80)
    logger.info("SKILL INHERITANCE COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Total auto-matched KeSCO occupations: {stats['total_matched']}")
    logger.info(f"Occupations with inherited skills: {stats['occupations_with_skills']}")
    logger.info(f"Total skills inherited: {stats['total_skills_inherited']}")
    logger.info(f"Occupations with no skills in ESCO: {stats['occupations_no_skills']}")
    logger.info("=" * 80 + "\n")
    
    return stats


async def main():
    """Standalone execution"""
    from motor.motor_asyncio import AsyncIOMotorClient #type:ignore
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[TAXONOMY_DB_NAME]
    
    stats = await inherit_skills_for_matched_kesco(db)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
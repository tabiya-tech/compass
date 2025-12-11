# app/taxonomy/importers/run_all_imports.py
"""
Master import script for all taxonomy data with HIERARCHICAL SEMANTIC CONTEXTUALIZATION
Runs all importers in correct order with inline KeSCO-ESCO matching
"""

import asyncio
import logging
import time
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from .config import MONGODB_URI, TAXONOMY_DB_NAME
from .esco_occupations_importer import ESCOOccupationsImporter
from .esco_skills_importer import ESCOSkillsImporter
from .esco_relations_importer import ESCORelationsImporter
from .kesco_importer import KeSCOImporter
from .hierarchical_semantic_matcher import build_hierarchical_matcher_from_db

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)


async def main():
    """Run all taxonomy imports in correct order with hierarchical semantic matching"""
    
    start_time = time.time()
    
    logger.info("\n" + "="*80)
    logger.info("TAXONOMY IMPORT WITH HIERARCHICAL SEMANTIC CONTEXTUALIZATION")
    logger.info("="*80)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[TAXONOMY_DB_NAME]
    
    all_stats = {}
    
    try:
        # ========================================================================
        # STEP 1: Import ESCO Occupations
        # ========================================================================
        logger.info("\n" + "="*80)
        logger.info("STEP 1/5: Importing ESCO Occupations")
        logger.info("="*80)
        
        esco_occ_importer = ESCOOccupationsImporter(db)
        all_stats['esco_occupations'] = await esco_occ_importer.import_occupations()
        
        # ========================================================================
        # STEP 2: Import ESCO Skills
        # ========================================================================
        logger.info("\n" + "="*80)
        logger.info("STEP 2/5: Importing ESCO Skills")
        logger.info("="*80)
        
        esco_skills_importer = ESCOSkillsImporter(db)
        all_stats['esco_skills'] = await esco_skills_importer.import_skills()
        
        # ========================================================================
        # STEP 3: Import ESCO Occupation-Skill Relations
        # ========================================================================
        logger.info("\n" + "="*80)
        logger.info("STEP 3/5: Importing ESCO Occupation-Skill Relations")
        logger.info("="*80)
        
        esco_relations_importer = ESCORelationsImporter(db)
        all_stats['esco_relations'] = await esco_relations_importer.import_relations()
        
        # ========================================================================
        # STEP 4: Build Hierarchical Semantic Matcher
        # ========================================================================
        logger.info("\n" + "="*80)
        logger.info("STEP 4/5: Building Hierarchical Semantic Matcher ()")
        logger.info("="*80)
        logger.info("✓ Using SEMANTIC MATCHING")
        
        # Build hierarchical semantic matcher from database
        # This builds its own lookups internally with alt labels and ISCO groups
        hierarchical_matcher, esco_lookup, _ = \
            await build_hierarchical_matcher_from_db(db)
        
        # ========================================================================
        # STEP 5: Import KeSCO with HIERARCHICAL SEMANTIC CONTEXTUALIZATION
        # ========================================================================
        logger.info("\n" + "="*80)
        logger.info("STEP 5/5: Importing KeSCO with HIERARCHICAL SEMANTIC CONTEXTUALIZATION")
        logger.info("="*80)
        
        kesco_importer = KeSCOImporter(
            db, 
            esco_lookup=esco_lookup,
            hierarchical_matcher=hierarchical_matcher
        )
        all_stats['kesco_occupations'] = await kesco_importer.import_occupations()
        
        # Export matches for review
        kesco_importer.export_matches_to_csv()
        
        # ========================================================================
        # FINAL SUMMARY
        # ========================================================================
        duration = time.time() - start_time
        
        logger.info("\n" + "="*80)
        logger.info("IMPORT COMPLETE - FINAL SUMMARY")
        logger.info("="*80)
        logger.info(f"Total duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
        
        logger.info("\nESCO_OCCUPATIONS:")
        logger.info(f"  ✓ Imported: {all_stats['esco_occupations']['imported']}")
        logger.info(f"  ⊘ Skipped: {all_stats['esco_occupations']['skipped']}")
        logger.info(f"  ✗ Errors: {all_stats['esco_occupations']['errors']}")
        
        logger.info("\nESCO_SKILLS:")
        logger.info(f"  ✓ Imported: {all_stats['esco_skills']['imported']}")
        logger.info(f"  ⊘ Skipped: {all_stats['esco_skills']['skipped']}")
        logger.info(f"  ✗ Errors: {all_stats['esco_skills']['errors']}")
        
        logger.info("\nESCO_RELATIONS:")
        logger.info(f"  ✓ Imported: {all_stats['esco_relations']['imported']}")
        logger.info(f"  ⊘ Skipped: {all_stats['esco_relations']['skipped']}")
        logger.info(f"  ✗ Errors: {all_stats['esco_relations']['errors']}")
        
        logger.info("\nKESCO_OCCUPATIONS:")
        logger.info(f"  ✓ Imported: {all_stats['kesco_occupations']['imported']}")
        logger.info(f"  ⊘ Skipped: {all_stats['kesco_occupations']['skipped']}")
        logger.info(f"  ✗ Errors: {all_stats['kesco_occupations']['errors']}")
        logger.info(f"  INFO:: Auto-matched: {all_stats['kesco_occupations']['auto_matched']}")
        logger.info(f"  INFO:: Manual review: {all_stats['kesco_occupations']['manual_review']}")
        logger.info(f"  INFO:: No match: {all_stats['kesco_occupations']['no_match']}")
        
        # Matching method breakdown
        logger.info("\n  MATCHING METHODS:")
        logger.info(f"    • Exact: {all_stats['kesco_occupations'].get('exact_matches', 0)}")
        logger.info(f"    • Hierarchical (within group): {all_stats['kesco_occupations'].get('hierarchical_group_matches', 0)}")
        logger.info(f"    • Hierarchical (full catalog): {all_stats['kesco_occupations'].get('hierarchical_fallback_matches', 0)}")
        
        # Calculate totals
        total_imported = sum(s['imported'] for s in all_stats.values())
        total_skipped = sum(s['skipped'] for s in all_stats.values())
        total_errors = sum(s['errors'] for s in all_stats.values())
        
        logger.info("\nTOTALS:")
        logger.info(f"  ✓ Total Imported: {total_imported:,} records")
        logger.info(f"  ⊘ Total Skipped: {total_skipped:,} records")
        logger.info(f"  ✗ Total Errors: {total_errors:,} records")
        logger.info("="*80)
        
        logger.info("\n✅ TAXONOMY IMPORT WITH HIERARCHICAL SEMANTIC CONTEXTUALIZATION COMPLETE!")
        logger.info("\nNEXT STEPS:")
        logger.info("1. Review /home/steve/tabiya/resources/kesco_esco_hierarchical_matches.csv")
        logger.info("2. Manually verify 60-69% confidence matches")
        logger.info("3. Run skill inheritance: python3 -m app.taxonomy.importers.inherit_skills")
        logger.info("4. Assign skills to unmatched occupations (<60%)")
        logger.info("="*80)
        
    except Exception as e:
        logger.error(f"\n❌ Import failed with error: {str(e)}")
        raise
    
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
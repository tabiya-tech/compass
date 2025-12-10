import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient #type:ignore
from datetime import datetime

from .esco_occupations_importer import ESCOOccupationsImporter
from .esco_skills_importer import ESCOSkillsImporter
from .esco_relations_importer import ESCORelationsImporter
from .kesco_importer import KeSCOImporter
from .config import MONGODB_URI, TAXONOMY_DB_NAME, validate_files

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def run_all_imports():
    """Run all taxonomy imports with inline contextualization"""
    
    # Validate files exist
    logger.info("Validating data files...")
    try:
        validate_files()
        logger.info("✅ All data files found")
    except FileNotFoundError as e:
        logger.error(f"❌ {e}")
        return
    
    start_time = datetime.now()
    logger.info("="*80)
    logger.info("TAXONOMY DATABASE IMPORT WITH INLINE CONTEXTUALIZATION")
    logger.info("="*80)
    logger.info(f"MongoDB URI: {MONGODB_URI[:50]}...")
    logger.info(f"Database: {TAXONOMY_DB_NAME}")
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
        # STEP 2: Build ESCO Lookup Dictionary
        # ========================================================================
        logger.info("\n" + "="*80)
        logger.info("STEP 2/5: Building ESCO Lookup Dictionary for Contextualization")
        logger.info("="*80)
        esco_lookup = await esco_occ_importer.build_esco_lookup()
        logger.info(f"✓ Lookup ready with {len(esco_lookup)} searchable titles")
        
        # ========================================================================
        # STEP 3: Import ESCO Skills
        # ========================================================================
        logger.info("\n" + "="*80)
        logger.info("STEP 3/5: Importing ESCO Skills")
        logger.info("="*80)
        esco_skills_importer = ESCOSkillsImporter(db)
        all_stats['esco_skills'] = await esco_skills_importer.import_skills()
        
        # ========================================================================
        # STEP 4: Import ESCO Occupation-Skill Relations
        # ========================================================================
        logger.info("\n" + "="*80)
        logger.info("STEP 4/5: Importing ESCO Occupation-Skill Relations")
        logger.info("="*80)
        esco_relations_importer = ESCORelationsImporter(db)
        all_stats['esco_relations'] = await esco_relations_importer.import_relations()
        
        # ========================================================================
        # STEP 5: Build Semantic Matcher
        # ========================================================================
        logger.info("\n" + "="*80)
        logger.info("STEP 5/6: Building Semantic Matcher for High-Quality Contextualization")
        logger.info("="*80)

        from .semantic_matcher import build_semantic_matcher_from_db

        # Build semantic matcher
        semantic_matcher, esco_lookup_enhanced = await build_semantic_matcher_from_db(db)

        # ========================================================================
        # STEP 6: Import KeSCO with SEMANTIC CONTEXTUALIZATION
        # ========================================================================
        logger.info("\n" + "="*80)
        logger.info("STEP 6/6: Importing KeSCO with SEMANTIC CONTEXTUALIZATION")
        logger.info("="*80)

        kesco_importer = KeSCOImporter(
            db, 
            esco_lookup=esco_lookup_enhanced,
            semantic_matcher=semantic_matcher  
        )
        all_stats['kesco_occupations'] = await kesco_importer.import_occupations()

        # Export matches for review
        kesco_importer.export_matches_to_csv()
        
    finally:
        client.close()
    
    # ============================================================================
    # FINAL SUMMARY
    # ============================================================================
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    logger.info("\n" + "="*80)
    logger.info("IMPORT COMPLETE - FINAL SUMMARY")
    logger.info("="*80)
    logger.info(f"Total duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
    logger.info("")
    
    total_imported = 0
    total_skipped = 0
    total_errors = 0
    
    for dataset, stats in all_stats.items():
        if dataset == 'skill_inheritance':
            logger.info(f"{dataset.upper()}:")
            logger.info(f"  ✓ Occupations processed: {stats.get('total_matched', 0)}")
            logger.info(f"  ✓ Skills inherited: {stats.get('total_skills_inherited', 0)}")
        else:
            logger.info(f"{dataset.upper()}:")
            logger.info(f"  ✓ Imported: {stats['imported']}")
            logger.info(f"  ⊘ Skipped: {stats['skipped']}")
            logger.info(f"  ✗ Errors: {stats['errors']}")
            
            if dataset == 'kesco_occupations':
                logger.info(f"  🎯 Auto-matched: {stats.get('auto_matched', 0)}")
                logger.info(f"  ⚠️  Manual review: {stats.get('manual_review', 0)}")
                logger.info(f"  ❓ No match: {stats.get('no_match', 0)}")
        
        logger.info("")
        
        total_imported += stats.get('imported', 0)
        total_skipped += stats.get('skipped', 0)
        total_errors += stats.get('errors', 0)
    
    logger.info("TOTALS:")
    logger.info(f"  ✓ Total Imported: {total_imported:,} records")
    logger.info(f"  ⊘ Total Skipped: {total_skipped:,} records")
    logger.info(f"  ✗ Total Errors: {total_errors:,} records")
    logger.info("="*80)
    logger.info("\n✅ TAXONOMY IMPORT WITH INLINE CONTEXTUALIZATION COMPLETE!")
    logger.info("\nNEXT STEPS:")
    logger.info("1. Review /home/steve/tabiya/resources/kesco_esco_inline_matches.csv")
    logger.info("2. Manually verify 70-84% confidence matches")
    logger.info("3. Assign skills to unmatched occupations (<70%)")
    logger.info("="*80 + "\n")
    
    return all_stats


if __name__ == "__main__":
    asyncio.run(run_all_imports())
"""
Runs all taxonomy imports in correct order
"""

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
    """Run all taxonomy imports in the correct order"""
    
    # Validate files exist before starting
    logger.info("Validating data files...")
    try:
        validate_files()
        logger.info("✅ All data files found")
    except FileNotFoundError as e:
        logger.error(f"❌ {e}")
        return
    
    start_time = datetime.now()
    logger.info("="*80)
    logger.info("STARTING TAXONOMY DATABASE IMPORT")
    logger.info("="*80)
    logger.info(f"MongoDB URI: {MONGODB_URI[:50]}...")
    logger.info(f"Database: {TAXONOMY_DB_NAME}")
    logger.info("="*80)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[TAXONOMY_DB_NAME]
    
    all_stats = {}
    
    try:
        # 1. Import ESCO Occupations
        logger.info("\n" + "="*80)
        logger.info("STEP 1/4: Importing ESCO Occupations")
        logger.info("="*80)
        esco_occ_importer = ESCOOccupationsImporter(db)
        all_stats['esco_occupations'] = await esco_occ_importer.import_occupations()
        
        # 2. Import ESCO Skills
        logger.info("\n" + "="*80)
        logger.info("STEP 2/4: Importing ESCO Skills")
        logger.info("="*80)
        esco_skills_importer = ESCOSkillsImporter(db)
        all_stats['esco_skills'] = await esco_skills_importer.import_skills()
        
        # 3. Import ESCO Relations
        logger.info("\n" + "="*80)
        logger.info("STEP 3/4: Importing ESCO Occupation-Skill Relations")
        logger.info("="*80)
        esco_relations_importer = ESCORelationsImporter(db)
        all_stats['esco_relations'] = await esco_relations_importer.import_relations()
        
        # 4. Import KeSCO Occupations
        logger.info("\n" + "="*80)
        logger.info("STEP 4/4: Importing KeSCO Occupations")
        logger.info("="*80)
        kesco_importer = KeSCOImporter(db)
        all_stats['kesco_occupations'] = await kesco_importer.import_occupations()
        
    finally:
        client.close()
    
    # Print final summary
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
        logger.info(f"{dataset.upper()}:")
        logger.info(f"  ✓ Imported: {stats['imported']}")
        logger.info(f"  ⊘ Skipped: {stats['skipped']}")
        logger.info(f"  ✗ Errors: {stats['errors']}")
        logger.info("")
        
        total_imported += stats['imported']
        total_skipped += stats['skipped']
        total_errors += stats['errors']
    
    logger.info("TOTALS:")
    logger.info(f"  ✓ Total Imported: {total_imported:,} records")
    logger.info(f"  ⊘ Total Skipped: {total_skipped:,} records")
    logger.info(f"  ✗ Total Errors: {total_errors:,} records")
    logger.info("="*80)
    
    return all_stats


if __name__ == "__main__":
    asyncio.run(run_all_imports())
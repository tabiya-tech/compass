"""
Import ESCO skills from skills.csv into taxonomy_db
"""

import pandas as pd #type:ignore
from motor.motor_asyncio import AsyncIOMotorDatabase #type:ignore
from bson import ObjectId #type:ignore
from typing import Dict, Any, Optional
import asyncio
import logging

from app.taxonomy.models import (
    SkillModel,
    DataSource,
    SkillType,
    SkillReuseLevel,
    TaxonomyCollections
)
from .config import ESCO_SKILLS_CSV, TAXONOMY_MODEL_ID, MONGODB_URI, TAXONOMY_DB_NAME

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ESCOSkillsImporter:
    """Import ESCO skills from CSV"""
    
    def __init__(self, db: AsyncIOMotorDatabase, csv_path: str = None, taxonomy_model_id: ObjectId = None):
        self.db = db
        self.csv_path = csv_path or ESCO_SKILLS_CSV
        self.taxonomy_model_id = taxonomy_model_id or TAXONOMY_MODEL_ID
        self.stats = {
            "total_rows": 0,
            "imported": 0,
            "skipped": 0,
            "errors": 0
        }
    
    def _parse_alt_labels(self, alt_labels_str: Optional[str]) -> list:
        """Parse alternative labels from pipe-separated string"""
        if pd.isna(alt_labels_str) or not alt_labels_str:
            return []
        return [label.strip() for label in str(alt_labels_str).split('\n') if label.strip()]
    
    def _parse_skill_type(self, skill_type_str: str) -> SkillType:
        """Parse ESCO skill type to enum"""
        skill_type_lower = str(skill_type_str).lower()
        
        if 'knowledge' in skill_type_lower:
            return SkillType.KNOWLEDGE
        elif 'language' in skill_type_lower:
            return SkillType.LANGUAGE
        else:
            return SkillType.SKILL_COMPETENCE
    
    def _parse_reuse_level(self, reuse_level_str: str) -> SkillReuseLevel:
        """Parse ESCO reuse level to enum"""
        reuse_lower = str(reuse_level_str).lower().replace(' ', '-')
        
        if 'cross-sectoral' in reuse_lower or 'transversal' in reuse_lower:
            return SkillReuseLevel.CROSS_SECTORAL
        elif 'sector-specific' in reuse_lower or 'sector specific' in reuse_lower:
            return SkillReuseLevel.SECTOR_SPECIFIC
        elif 'occupation-specific' in reuse_lower or 'occupation specific' in reuse_lower:
            return SkillReuseLevel.OCCUPATION_SPECIFIC
        else:
            return SkillReuseLevel.TRANSVERSAL
    
    def _row_to_skill_model(self, row: pd.Series) -> SkillModel:
        """Convert CSV row to SkillModel"""
        
        skill = SkillModel(
            esco_uri=row['ORIGINURI'],
            esco_uuid=row.get('UUIDHISTORY'),
            preferred_label=row['PREFERREDLABEL'],
            alt_labels=self._parse_alt_labels(row.get('ALTLABELS')),
            skill_type=self._parse_skill_type(row['SKILLTYPE']),
            reuse_level=self._parse_reuse_level(row['REUSELEVEL']),
            description=row.get('DESCRIPTION') if pd.notna(row.get('DESCRIPTION')) else None,
            definition=row.get('DEFINITION') if pd.notna(row.get('DEFINITION')) else None,
            scope_note=row.get('SCOPENOTE') if pd.notna(row.get('SCOPENOTE')) else None,
            is_relevant_for_kenya=True,
            source=DataSource.ESCO,
            taxonomy_model_id=self.taxonomy_model_id,
            is_localized=bool(row.get('ISLOCALIZED')) if pd.notna(row.get('ISLOCALIZED')) else False
        )
        
        return skill
    
    async def import_skills(self, batch_size: int = 500) -> Dict[str, Any]:
        """
        Import all ESCO skills from CSV
        
        Args:
            batch_size: Number of documents to insert per batch
            
        Returns:
            Dictionary with import statistics
        """
        logger.info(f"Starting ESCO skills import from {self.csv_path}")
        
        # Read CSV
        logger.info("Reading CSV file...")
        df = pd.read_csv(self.csv_path)
        self.stats['total_rows'] = len(df)
        logger.info(f"Found {self.stats['total_rows']} skills in CSV")
        
        # Get collection
        collection = self.db[TaxonomyCollections.SKILLS]
        
        # Create index on esco_uri to prevent duplicates
        try:
            await collection.create_index("esco_uri", unique=True)
        except Exception as e:
            logger.warning(f"Could not create esco_uri index: {e}")
        
        # Process in batches
        batch = []
        for idx, row in df.iterrows():
            try:
                skill = self._row_to_skill_model(row)
                batch.append(skill.model_dump(by_alias=True, exclude_none=True, mode='python'))
                
                # Insert batch when full
                if len(batch) >= batch_size:
                    await self._insert_batch(collection, batch)
                    batch = []
                    
                    # Log progress
                    if (idx + 1) % 2000 == 0:
                        logger.info(f"Processed {idx + 1}/{self.stats['total_rows']} skills")
                
            except Exception as e:
                logger.error(f"Error processing row {idx}: {str(e)}")
                self.stats['errors'] += 1
        
        # Insert remaining batch
        if batch:
            await self._insert_batch(collection, batch)
        
        logger.info("Import complete!")
        logger.info(f"Statistics: {self.stats}")
        
        return self.stats
    
    async def _insert_batch(self, collection, batch: list):
        """Insert a batch of documents"""
        if not batch:
            return
        
        try:
            result = await collection.insert_many(batch, ordered=False)
            self.stats['imported'] += len(result.inserted_ids)
        except Exception as e:
            if "duplicate key error" in str(e).lower():
                error_count = str(e).count("duplicate key")
                inserted = len(batch) - error_count
                self.stats['imported'] += inserted
                self.stats['skipped'] += error_count
                logger.warning(f"Skipped {error_count} duplicates in batch")
            else:
                logger.error(f"Batch insert error: {str(e)}")
                self.stats['errors'] += len(batch)


async def main():
    """Example usage"""
    from motor.motor_asyncio import AsyncIOMotorClient #type:ignore
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[TAXONOMY_DB_NAME]
    
    importer = ESCOSkillsImporter(db)
    stats = await importer.import_skills()
    
    print(f"\n✅ Import complete!")
    print(f"   Total rows: {stats['total_rows']}")
    print(f"   Imported: {stats['imported']}")
    print(f"   Skipped (duplicates): {stats['skipped']}")
    print(f"   Errors: {stats['errors']}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
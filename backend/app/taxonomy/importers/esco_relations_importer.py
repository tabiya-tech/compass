# app/taxonomy/importers/esco_relations_importer.py
"""
Import ESCO occupation-to-skill relations from occupation_to_skill_relations.csv
"""
import pandas as pd #type:ignore
from motor.motor_asyncio import AsyncIOMotorDatabase #type:ignore
from bson import ObjectId #type:ignore
from typing import Dict, Any
import asyncio
import logging

from app.taxonomy.models import (
    OccupationSkillRelationModel,
    RelationType,
    DataSource,
    TaxonomyCollections
)
from .config import ESCO_RELATIONS_CSV, MONGODB_URI, TAXONOMY_DB_NAME

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ESCORelationsImporter:
    """Import ESCO occupation-skill relations"""
    
    def __init__(self, db: AsyncIOMotorDatabase, csv_path: str = None):
        self.db = db
        self.csv_path = csv_path or ESCO_RELATIONS_CSV
        self.stats = {
            "total_rows": 0,
            "imported": 0,
            "skipped": 0,
            "errors": 0,
            "invalid_id": 0
        }
    
    def _parse_relation_type(self, relation_type_str: str) -> RelationType:
        """Parse relation type from CSV"""
        relation_lower = str(relation_type_str).lower()
        
        if 'essential' in relation_lower:
            return RelationType.ESSENTIAL
        else:
            return RelationType.OPTIONAL
    
    def _parse_objectid(self, id_str: str) -> ObjectId:
        """Convert string ID to ObjectId"""
        if pd.isna(id_str):
            return None
        try:
            return ObjectId(str(id_str).strip())
        except Exception:
            return None
    
    async def import_relations(self, batch_size: int = 1000) -> Dict[str, Any]:
        """
        Import all occupation-skill relations
        
        Args:
            batch_size: Number of documents to insert per batch
            
        Returns:
            Dictionary with import statistics
        """
        logger.info(f"Starting ESCO relations import from {self.csv_path}")
        
        # Read CSV
        logger.info("Reading relations CSV file...")
        df = pd.read_csv(self.csv_path)
        self.stats['total_rows'] = len(df)
        logger.info(f"Found {self.stats['total_rows']} relations in CSV")
        logger.info(f"CSV Columns: {df.columns.tolist()}")
        
        # Get collection
        collection = self.db[TaxonomyCollections.OCCUPATION_SKILL_RELATIONS]
        
        # Create compound index to prevent duplicates
        try:
            await collection.create_index([("occupation_id", 1), ("skill_id", 1)], unique=True)
            logger.info("✓ Created compound index on (occupation_id, skill_id)")
        except Exception as e:
            logger.warning(f"⚠ Could not create compound index: {e}")
        
        # Process in batches
        batch = []
        for idx, row in df.iterrows():
            try:
                # Parse ObjectIds from CSV
                occupation_id = self._parse_objectid(row['OCCUPATIONID'])
                skill_id = self._parse_objectid(row['SKILLID'])
                
                if not occupation_id or not skill_id:
                    self.stats['invalid_id'] += 1
                    continue
                
                # Create relation
                relation = OccupationSkillRelationModel(
                    occupation_id=str(occupation_id),  # Convert to string for Pydantic
                    skill_id=str(skill_id),
                    relation_type=self._parse_relation_type(row['RELATIONTYPE']),
                    signalling_value=float(row['SIGNALLINGVALUE']) if pd.notna(row.get('SIGNALLINGVALUE')) else None,
                    signalling_value_label=row.get('SIGNALLINGVALUELABEL') if pd.notna(row.get('SIGNALLINGVALUELABEL')) else None,
                    source=DataSource.ESCO
                )
                
                batch.append(relation.model_dump(by_alias=True, exclude_none=True, mode='python'))
                
                # Insert batch when full
                if len(batch) >= batch_size:
                    await self._insert_batch(collection, batch)
                    batch = []
                    
                    # Log progress
                    if (idx + 1) % 10000 == 0:
                        logger.info(f"Processed {idx + 1}/{self.stats['total_rows']} relations")
                
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
            else:
                logger.error(f"Batch insert error: {str(e)}")
                self.stats['errors'] += len(batch)


async def main():
    """Example usage"""
    from motor.motor_asyncio import AsyncIOMotorClient #type:ignore
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[TAXONOMY_DB_NAME]
    
    importer = ESCORelationsImporter(db)
    stats = await importer.import_relations()
    
    print(f"\n✅ Import complete!")
    print(f"   Total rows: {stats['total_rows']}")
    print(f"   Imported: {stats['imported']}")
    print(f"   Skipped (duplicates): {stats['skipped']}")
    print(f"   Invalid IDs: {stats['invalid_id']}")
    print(f"   Errors: {stats['errors']}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
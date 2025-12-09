# app/taxonomy/importers/kesco_importer.py
"""
Import KeSCO occupations from Excel into taxonomy_db
"""

import pandas as pd #type:ignore
from motor.motor_asyncio import AsyncIOMotorDatabase #type:ignore
from bson import ObjectId #type:ignore
from typing import Dict, Any
import asyncio
import logging

from app.taxonomy.models import (
    OccupationModel,
    DataSource,
    OccupationType,
    TaxonomyCollections
)
from .config import KESCO_OCCUPATIONS_XLSX, TAXONOMY_MODEL_ID, MONGODB_URI, TAXONOMY_DB_NAME

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KeSCOImporter:
    """Import KeSCO occupations from Excel"""
    
    def __init__(self, db: AsyncIOMotorDatabase, excel_path: str = None, taxonomy_model_id: ObjectId = None):
        self.db = db
        self.excel_path = excel_path or KESCO_OCCUPATIONS_XLSX
        self.taxonomy_model_id = taxonomy_model_id or TAXONOMY_MODEL_ID
        self.stats = {
            "total_rows": 0,
            "imported": 0,
            "skipped": 0,
            "errors": 0
        }
    
    def _row_to_occupation_model(self, row: pd.Series) -> OccupationModel:
        """Convert Excel row to OccupationModel"""
        
        # KeSCO code format: 7314-33
        kesco_code = str(row['KeSCO Code']).strip()
        
        occupation = OccupationModel(
            code=kesco_code,  # Use KeSCO code directly
            preferred_label=row['Occupational Title'].strip(),
            alt_labels=[],
            occupation_type=OccupationType.LOCAL_OCCUPATION,
            kesco_code=kesco_code,
            kesco_serial_number=int(row['S/No']),
            is_relevant_for_kenya=True,
            is_informal_sector=False,  # Can be updated later
            is_entrepreneurship=False,
            source=DataSource.KESCO,
            taxonomy_model_id=self.taxonomy_model_id,
            added_by="kesco_importer"
        )
        
        return occupation
    
    async def import_occupations(self, batch_size: int = 500) -> Dict[str, Any]:
        """
        Import all KeSCO occupations from Excel
        
        Args:
            batch_size: Number of documents to insert per batch
            
        Returns:
            Dictionary with import statistics
        """
        logger.info(f"Starting KeSCO occupations import from {self.excel_path}")
        
        # Read Excel
        logger.info("Reading Excel file...")
        df = pd.read_excel(self.excel_path)
        self.stats['total_rows'] = len(df)
        logger.info(f"Found {self.stats['total_rows']} occupations in Excel")
        
        # Get collection
        collection = self.db[TaxonomyCollections.OCCUPATIONS]
        
        # Note: code index already created by ESCO importer
        # This will prevent duplicate codes across ESCO and KeSCO
        
        # Process in batches
        batch = []
        for idx, row in df.iterrows():
            try:
                occupation = self._row_to_occupation_model(row)
                batch.append(occupation.model_dump(by_alias=True, exclude_none=True, mode='python'))
                
                # Insert batch when full
                if len(batch) >= batch_size:
                    await self._insert_batch(collection, batch)
                    batch = []
                    
                    # Log progress
                    if (idx + 1) % 1000 == 0:
                        logger.info(f"Processed {idx + 1}/{self.stats['total_rows']} occupations")
                
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
    
    importer = KeSCOImporter(db)
    stats = await importer.import_occupations()
    
    print(f"\n✅ Import complete!")
    print(f"   Total rows: {stats['total_rows']}")
    print(f"   Imported: {stats['imported']}")
    print(f"   Skipped (duplicates): {stats['skipped']}")
    print(f"   Errors: {stats['errors']}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
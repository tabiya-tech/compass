"""
Import ESCO occupations from occupations.csv into taxonomy_db
"""

import pandas as pd #type:ignore
from motor.motor_asyncio import AsyncIOMotorDatabase #type:ignore
from bson import ObjectId #type:ignore
from typing import Dict, Any, Optional
import asyncio
import logging

from app.taxonomy.models import (
    OccupationModel,
    DataSource,
    OccupationType,
    TaxonomyCollections
)
from .config import ESCO_OCCUPATIONS_CSV, TAXONOMY_MODEL_ID

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ESCOOccupationsImporter:
    """Import ESCO occupations from CSV"""
    
    def __init__(self, db: AsyncIOMotorDatabase, csv_path: str = None, taxonomy_model_id: ObjectId = None):
        self.db = db
        self.csv_path = csv_path or ESCO_OCCUPATIONS_CSV
        self.taxonomy_model_id = taxonomy_model_id or TAXONOMY_MODEL_ID
        self.stats = {
            "total_rows": 0,
            "imported": 0,
            "skipped": 0,
            "errors": 0
        }
    
    def _parse_alt_labels(self, alt_labels_str: Optional[str]) -> list:
        """Parse alternative labels from newline-separated string"""
        # Handle NaN, None, empty string, and non-string types
        if pd.isna(alt_labels_str) or not alt_labels_str or not isinstance(alt_labels_str, str):
            return []
        return [label.strip() for label in str(alt_labels_str).split('\n') if label.strip()]
    
    def _extract_code_from_uri(self, uri: str) -> str:
        """Extract occupation code from ESCO URI"""
        return uri.split('/')[-1]
    
    def _row_to_occupation_model(self, row: pd.Series) -> OccupationModel:
        """Convert CSV row to OccupationModel"""
        
        code = self._extract_code_from_uri(row['ORIGINURI'])
        
        occupation_type_str = str(row.get('OCCUPATIONTYPE', '')).lower()
        if 'esco' in occupation_type_str:
            occupation_type = OccupationType.ESCO_OCCUPATION
        else:
            occupation_type = OccupationType.LOCAL_OCCUPATION
        
        occupation = OccupationModel(
            id=str(ObjectId(row['ID'])),
            code=code,
            preferred_label=row['PREFERREDLABEL'],
            alt_labels=self._parse_alt_labels(row.get('ALTLABELS')),
            esco_uri=row['ORIGINURI'],
            esco_uuid=row.get('UUIDHISTORY'),
            occupation_type=occupation_type,
            description=row.get('DESCRIPTION') if pd.notna(row.get('DESCRIPTION')) else None,
            definition=row.get('DEFINITION') if pd.notna(row.get('DEFINITION')) else None,
            scope_note=row.get('SCOPENOTE') if pd.notna(row.get('SCOPENOTE')) else None,
            regulated_profession_note=row.get('REGULATEDPROFESSIONNOTE') if pd.notna(row.get('REGULATEDPROFESSIONNOTE')) else None,
            occupation_group_code=row.get('OCCUPATIONGROUPCODE') if pd.notna(row.get('OCCUPATIONGROUPCODE')) else None,
            is_relevant_for_kenya=True,
            is_informal_sector=False,
            is_entrepreneurship=False,
            source=DataSource.ESCO,
            taxonomy_model_id=self.taxonomy_model_id,
            added_by="esco_importer",
            is_localized=bool(row.get('ISLOCALIZED')) if pd.notna(row.get('ISLOCALIZED')) else False
        )
        
        return occupation
    
    async def import_occupations(self, batch_size: int = 500) -> Dict[str, Any]:
        """Import all ESCO occupations from CSV"""
        logger.info(f"Starting ESCO occupations import from {self.csv_path}")
        
        logger.info("Reading CSV file...")
        df = pd.read_csv(self.csv_path)
        self.stats['total_rows'] = len(df)
        logger.info(f"Found {self.stats['total_rows']} occupations in CSV")
        
        collection = self.db[TaxonomyCollections.OCCUPATIONS]
        try:
            await collection.create_index("code", unique=True)
        except Exception as e:
            logger.warning(f"Could not create index (will continue anyway): {e}")
        
        batch = []
        for idx, row in df.iterrows():
            try:
                occupation = self._row_to_occupation_model(row)
                batch.append(occupation.model_dump(by_alias=True, exclude_none=True, mode='python'))
                
                if len(batch) >= batch_size:
                    await self._insert_batch(collection, batch)
                    batch = []
                    
                    if (idx + 1) % 1000 == 0:
                        logger.info(f"Processed {idx + 1}/{self.stats['total_rows']} occupations")
                
            except Exception as e:
                logger.error(f"Error processing row {idx}: {str(e)}")
                self.stats['errors'] += 1
        
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
    from .config import MONGODB_URI, TAXONOMY_DB_NAME
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[TAXONOMY_DB_NAME]
    
    importer = ESCOOccupationsImporter(db)
    stats = await importer.import_occupations()
    
    print(f"\n✅ Import complete!")
    print(f"   Total rows: {stats['total_rows']}")
    print(f"   Imported: {stats['imported']}")
    print(f"   Skipped (duplicates): {stats['skipped']}")
    print(f"   Errors: {stats['errors']}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
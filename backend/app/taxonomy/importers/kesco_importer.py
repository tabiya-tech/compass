import pandas as pd #type:ignore
from motor.motor_asyncio import AsyncIOMotorDatabase #type:ignore
from bson import ObjectId #type:ignore
from typing import Dict, Any, Optional, Tuple
import asyncio
import logging
from thefuzz import fuzz, process #type:ignore

from app.taxonomy.models import OccupationModel, DataSource, OccupationType, TaxonomyCollections
from .config import KESCO_OCCUPATIONS_XLSX, TAXONOMY_MODEL_ID, MONGODB_URI, TAXONOMY_DB_NAME

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class KeSCOImporter:
    """Import KeSCO occupations with semantic ESCO matching"""
    
    def __init__(
        self, 
        db: AsyncIOMotorDatabase, 
        excel_path: str = None, 
        taxonomy_model_id: ObjectId = None,
        esco_lookup: Dict[str, Dict] = None,
        semantic_matcher = None  
    ):
        """
        Initialize KeSCO importer with semantic matcher.
        
        Args:
            db: MongoDB database
            excel_path: Path to KeSCO Excel file
            taxonomy_model_id: Taxonomy version ID
            esco_lookup: ESCO lookup dictionary (for exact matches)
            semantic_matcher: SemanticOccupationMatcher instance 
        """
        self.db = db
        self.excel_path = excel_path or KESCO_OCCUPATIONS_XLSX
        self.taxonomy_model_id = taxonomy_model_id or TAXONOMY_MODEL_ID
        self.esco_lookup = esco_lookup or {}
        self.semantic_matcher = semantic_matcher
        
        self.stats = {
            "total_rows": 0,
            "imported": 0,
            "skipped": 0,
            "errors": 0,
            "auto_matched": 0,
            "manual_review": 0,
            "no_match": 0
        }
        
        # For reporting
        self.matches = []
    
    def fuzzy_match_to_esco(self, kesco_title: str) -> Tuple[Optional[Dict], float, str]:
        """
        Fuzzy match KeSCO occupation to ESCO (OLD METHOD - fallback only).
        
        Args:
            kesco_title: KeSCO occupation title
            
        Returns:
            Tuple of (matched_esco_dict, confidence_score, match_method)
        """
        if not self.esco_lookup:
            return None, 0.0, "no_esco_lookup"
        
        kesco_title_clean = kesco_title.lower().strip()
        
        # Method 1: Exact match (100%)
        if kesco_title_clean in self.esco_lookup:
            return self.esco_lookup[kesco_title_clean], 100.0, "exact"
        
        # Method 2: Fuzzy matching
        esco_titles = list(self.esco_lookup.keys())
        
        matches = []
        
        # Token sort ratio (good for reordered words)
        result = process.extractOne(
            kesco_title_clean, 
            esco_titles, 
            scorer=fuzz.token_sort_ratio
        )
        if result:
            matches.append(('token_sort', result[0], result[1]))
        
        # Token set ratio (good for partial matches)
        result = process.extractOne(
            kesco_title_clean,
            esco_titles,
            scorer=fuzz.token_set_ratio
        )
        if result:
            matches.append(('token_set', result[0], result[1]))
        
        # Partial ratio (good for substrings)
        result = process.extractOne(
            kesco_title_clean,
            esco_titles,
            scorer=fuzz.partial_ratio
        )
        if result:
            matches.append(('partial', result[0], result[1]))
        
        # Take best match
        if matches:
            best_match = max(matches, key=lambda x: x[2])
            method, matched_title, score = best_match
            return self.esco_lookup.get(matched_title), float(score), f"fuzzy_{method}"
        
        return None, 0.0, "no_match"
    
    def semantic_match_to_esco(self, kesco_title: str) -> Tuple[Optional[Dict], float, str]:
        """
        Semantic match KeSCO occupation to ESCO (MUCH BETTER than fuzzy).
        
        Args:
            kesco_title: KeSCO occupation title
            
        Returns:
            Tuple of (matched_esco_dict, confidence_score, match_method)
        """
        if not self.semantic_matcher:
            # Fallback to old fuzzy if semantic matcher not available
            logger.warning("⚠️  Semantic matcher not available, using fuzzy matching")
            return self.fuzzy_match_to_esco(kesco_title)
        
        return self.semantic_matcher.match_with_fallback(
            kesco_title,
            fuzzy_lookup=self.esco_lookup,
            semantic_threshold=0.70,  # 70% semantic similarity for auto-match
            fuzzy_threshold=70
        )
    
    def _row_to_occupation_model(self, row: pd.Series) -> OccupationModel:
        """
        Convert Excel row to OccupationModel with SEMANTIC CONTEXTUALIZATION
        """
        kesco_code = str(row['KeSCO Code']).strip()
        kesco_title = row['Occupational Title'].strip()
        
        # *** USE SEMANTIC MATCHING ***
        esco_match, confidence, method = self.semantic_match_to_esco(kesco_title)
        confidence_decimal = confidence / 100.0
        
        # Determine mapping fields based on confidence
        mapped_to_esco_id = None
        suggested_esco_id = None
        requires_manual_review = False
        requires_manual_skill_assignment = False
        is_localized = False
        
        if esco_match:
            esco_id = str(esco_match['_id'])
            
            if confidence >= 70:
                # Auto-match (high confidence)
                mapped_to_esco_id = esco_id
                is_localized = True
                self.stats['auto_matched'] += 1
            elif confidence >= 60:
                # Manual review (medium confidence)
                suggested_esco_id = esco_id
                requires_manual_review = True
                self.stats['manual_review'] += 1
            else:
                # No good match
                requires_manual_skill_assignment = True
                self.stats['no_match'] += 1
        else:
            # No match at all
            requires_manual_skill_assignment = True
            self.stats['no_match'] += 1
        
        # Track match for reporting
        self.matches.append({
            'kesco_code': kesco_code,
            'kesco_title': kesco_title,
            'esco_title': esco_match.get('preferred_label', '') if esco_match else '',
            'esco_code': esco_match.get('code', '') if esco_match else '',
            'confidence': confidence,
            'method': method
        })
        
        # Create occupation model with contextualization
        occupation = OccupationModel(
            code=kesco_code,
            preferred_label=kesco_title,
            alt_labels=[],
            occupation_type=OccupationType.LOCAL_OCCUPATION,
            kesco_code=kesco_code,
            kesco_serial_number=int(row['S/No']),
            
            # *** Contextualization fields ***
            mapped_to_esco_id=mapped_to_esco_id,
            suggested_esco_id=suggested_esco_id,
            mapping_confidence=confidence_decimal if esco_match else None,
            mapping_method=method if esco_match else None,
            requires_manual_review=requires_manual_review,
            requires_manual_skill_assignment=requires_manual_skill_assignment,
            is_localized=is_localized,
            
            # Standard fields
            is_relevant_for_kenya=True,
            is_informal_sector=False,
            is_entrepreneurship=False,
            source=DataSource.KESCO,
            taxonomy_model_id=self.taxonomy_model_id,
            added_by="kesco_importer_semantic"
        )
        
        return occupation
    
    async def import_occupations(self, batch_size: int = 100) -> Dict[str, Any]:
        """
        Import all KeSCO occupations with semantic contextualization
        """
        logger.info(f"Starting KeSCO occupations import from {self.excel_path}")
        
        if not self.esco_lookup:
            logger.warning("⚠️  No ESCO lookup provided! Contextualization will be skipped.")
        else:
            logger.info(f"✓ ESCO lookup loaded with {len(self.esco_lookup)} searchable titles")
        
        if not self.semantic_matcher:
            logger.warning("⚠️  No semantic matcher provided! Will use fuzzy matching (lower quality).")
        else:
            logger.info("✓ Semantic matcher available for high-quality contextualization")
        
        # Read Excel
        logger.info("Reading Excel file...")
        df = pd.read_excel(self.excel_path)
        self.stats['total_rows'] = len(df)
        logger.info(f"Found {self.stats['total_rows']} KeSCO occupations")
        
        # Get collection
        collection = self.db[TaxonomyCollections.OCCUPATIONS]
        
        # Process in batches
        batch = []
        for idx, row in df.iterrows():
            try:
                occupation = self._row_to_occupation_model(row)
                batch.append(occupation.model_dump(by_alias=True, exclude_none=True, mode='python'))
                
                if len(batch) >= batch_size:
                    await self._insert_batch(collection, batch)
                    batch = []
                    
                    if (idx + 1) % 100 == 0:
                        logger.info(f"Processed {idx + 1}/{self.stats['total_rows']} occupations")
                
            except Exception as e:
                logger.error(f"Error processing row {idx}: {str(e)}")
                self.stats['errors'] += 1
        
        # Insert remaining batch
        if batch:
            await self._insert_batch(collection, batch)
        
        # Print contextualization summary
        self._print_contextualization_summary()
        
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
    
    def _print_contextualization_summary(self):
        """Print summary of contextualization results"""
        total = self.stats['total_rows']
        
        print("\n" + "=" * 80)
        print("KESCO ↔ ESCO CONTEXTUALIZATION SUMMARY (SEMANTIC)")
        print("=" * 80)
        print(f"Total KeSCO occupations: {total}")
        print(f"Auto-matched (≥70% confidence): {self.stats['auto_matched']} ({self.stats['auto_matched']/total*100:.1f}%)")
        print(f"Manual review (60-69%): {self.stats['manual_review']} ({self.stats['manual_review']/total*100:.1f}%)")
        print(f"No match (<60%): {self.stats['no_match']} ({self.stats['no_match']/total*100:.1f}%)")
        
        # Show sample auto-matches
        print("\n" + "-" * 80)
        print("SAMPLE AUTO-MATCHED (≥70% confidence):")
        print("-" * 80)
        auto_matches = [m for m in self.matches if m['confidence'] >= 70][:10]
        for match in auto_matches:
            print(f"{match['confidence']:.0f}% | {match['kesco_title']} → {match['esco_title']}")
        
        # Show sample manual review cases
        print("\n" + "-" * 80)
        print("SAMPLE MANUAL REVIEW NEEDED (60-69% confidence):")
        print("-" * 80)
        manual_reviews = [m for m in self.matches if 60 <= m['confidence'] < 70][:10]
        for match in manual_reviews:
            print(f"{match['confidence']:.0f}% | {match['kesco_title']} → {match['esco_title']} ⚠️")
        
        print("=" * 80 + "\n")
    
    def export_matches_to_csv(self, output_path: str = None):
        """Export match results to CSV for review"""
        if not output_path:
            output_path = "/home/steve/tabiya/resources/kesco_esco_semantic_matches.csv"
        
        df = pd.DataFrame(self.matches)
        df.to_csv(output_path, index=False)
        logger.info(f"✓ Exported matches to {output_path}")


async def main():
    """Example usage"""
    from motor.motor_asyncio import AsyncIOMotorClient #type:ignore
    from .semantic_matcher import build_semantic_matcher_from_db
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[TAXONOMY_DB_NAME]
    
    # Build semantic matcher
    semantic_matcher, esco_lookup = await build_semantic_matcher_from_db(db)
    
    # Import KeSCO with semantic contextualization
    kesco_importer = KeSCOImporter(
        db, 
        esco_lookup=esco_lookup,
        semantic_matcher=semantic_matcher
    )
    stats = await kesco_importer.import_occupations()
    
    print(f"\n✅ Import complete!")
    print(f"   Total rows: {stats['total_rows']}")
    print(f"   Imported: {stats['imported']}")
    print(f"   Skipped (duplicates): {stats['skipped']}")
    print(f"   Errors: {stats['errors']}")
    
    # Export matches
    kesco_importer.export_matches_to_csv()
    
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
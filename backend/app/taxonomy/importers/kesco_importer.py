"""
Import KeSCO occupations from Excel with HIERARCHICAL SEMANTIC CONTEXTUALIZATION
Algorithm: Filter by ISCO group first, then semantic match within group
"""

import pandas as pd #type:ignore
from motor.motor_asyncio import AsyncIOMotorDatabase #type:ignore
from bson import ObjectId #type:ignore
from typing import Dict, Any, Optional, Tuple
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
    """Import KeSCO occupations with hierarchical semantic ESCO matching"""
    
    def __init__(
        self, 
        db: AsyncIOMotorDatabase, 
        excel_path: str = None, 
        taxonomy_model_id: ObjectId = None,
        esco_lookup: Dict[str, Dict] = None,
        hierarchical_matcher = None  # HierarchicalSemanticMatcher
    ):
        """
        Initialize KeSCO importer with hierarchical semantic matcher.
        
        Args:
            db: MongoDB database
            excel_path: Path to KeSCO Excel file
            taxonomy_model_id: Taxonomy version ID
            esco_lookup: ESCO lookup dictionary (for exact matches only)
            hierarchical_matcher: HierarchicalSemanticMatcher instance
        """
        self.db = db
        self.excel_path = excel_path or KESCO_OCCUPATIONS_XLSX
        self.taxonomy_model_id = taxonomy_model_id or TAXONOMY_MODEL_ID
        self.esco_lookup = esco_lookup or {}
        self.hierarchical_matcher = hierarchical_matcher
        
        self.stats = {
            "total_rows": 0,
            "imported": 0,
            "skipped": 0,
            "errors": 0,
            "auto_matched": 0,
            "manual_review": 0,
            "no_match": 0,
            "exact_matches": 0,
            "hierarchical_group_matches": 0,
            "hierarchical_fallback_matches": 0
        }
        
        # For reporting
        self.matches = []
    
    def _extract_kesco_isco_group(self, kesco_code: str) -> Optional[str]:
        """
        Extract 4-digit ISCO group code from KeSCO code.
        
        Examples:
            "7314-11" -> "7314"
            "2411-12" -> "2411"
            "1211-14" -> "1211"
        """
        if not kesco_code:
            return None
        
        # Split by dash and take first part
        parts = str(kesco_code).split('-')
        if len(parts) > 0:
            group_code = parts[0].strip()
            
            # Validate it's a 4-digit number
            if len(group_code) == 4 and group_code.isdigit():
                return group_code
        
        return None
    
    def hierarchical_match_to_esco(
        self, 
        kesco_title: str,
        kesco_isco_group: str = None
    ) -> Tuple[Optional[Dict], float, str]:
        """
        Hierarchical semantic match (Jasmin's approach)
        
        Args:
            kesco_title: KeSCO occupation title
            kesco_isco_group: 4-digit ISCO group code from KeSCO
            
        Returns:
            Tuple of (matched_esco_dict, confidence_score, match_method)
        """
        kesco_title_clean = kesco_title.lower().strip()
        
        # Step 1: Try exact match first (fastest)
        if self.esco_lookup and kesco_title_clean in self.esco_lookup:
            self.stats['exact_matches'] += 1
            return self.esco_lookup[kesco_title_clean], 100.0, "exact"
        
        # Step 2: Use hierarchical semantic matcher
        if not self.hierarchical_matcher:
            logger.warning("⚠️  Hierarchical matcher not available!")
            return None, 0.0, "no_matcher"
        
        # Use hierarchical matcher with ISCO group filtering
        # Aggressive 55% threshold for maximum auto-matching
        esco_match, confidence, method = self.hierarchical_matcher.match_with_fallback(
            kesco_title,
            kesco_isco_group=kesco_isco_group,
            fuzzy_lookup=None,
            semantic_threshold=0.55
        )
        
        # Track which method was used
        if method.startswith('hierarchical_group'):
            self.stats['hierarchical_group_matches'] += 1
        elif method.startswith('hierarchical_fallback'):
            self.stats['hierarchical_fallback_matches'] += 1
        
        return esco_match, confidence, method
    
    def _row_to_occupation_model(self, row: pd.Series) -> OccupationModel:
        """
        Convert Excel row to OccupationModel with HIERARCHICAL SEMANTIC CONTEXTUALIZATION
        """
        kesco_code = str(row['KeSCO Code']).strip()
        kesco_title = row['Occupational Title'].strip()
        
        # Extract ISCO group code from KeSCO code
        kesco_isco_group = self._extract_kesco_isco_group(kesco_code)
        
        # *** USE HIERARCHICAL SEMANTIC MATCHING ***
        esco_match, confidence, method = self.hierarchical_match_to_esco(
            kesco_title,
            kesco_isco_group
        )
        confidence_decimal = confidence / 100.0
        
        # Determine mapping fields based on confidence
        mapped_to_esco_id = None
        suggested_esco_id = None
        requires_manual_review = False
        requires_manual_skill_assignment = False
        is_localized = False
        
        if esco_match:
            esco_id = str(esco_match['_id'])
            
            if confidence >= 55:
                # Auto-match (high confidence)
                mapped_to_esco_id = esco_id
                is_localized = True
                self.stats['auto_matched'] += 1
            elif confidence >= 45:
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
            'kesco_isco_group': kesco_isco_group or '',
            'kesco_title': kesco_title,
            'esco_title': esco_match.get('preferred_label', '') if esco_match else '',
            'esco_code': esco_match.get('code', '') if esco_match else '',
            'esco_isco_group': esco_match.get('isco_group_code', '') if esco_match else '',
            'confidence': confidence,
            'method': method
        })
        
        # Get alt_labels from matched ESCO occupation
        alt_labels = []
        if esco_match:
            # Copy alt_labels from ESCO (excluding the KeSCO title itself)
            esco_alt_labels = esco_match.get('alt_labels', [])
            kesco_title_lower = kesco_title.lower().strip()
            alt_labels = [
                label for label in esco_alt_labels 
                if label.lower().strip() != kesco_title_lower
            ][:10]  # Limit to 10 alt labels
        
        # Create occupation model with contextualization
        occupation = OccupationModel(
            code=kesco_code,
            isco_group_code=kesco_isco_group,
            preferred_label=kesco_title,
            alt_labels=alt_labels,
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
            added_by="kesco_importer_hierarchical"
        )
        
        return occupation
    
    async def import_occupations(self, batch_size: int = 100) -> Dict[str, Any]:
        """
        Import all KeSCO occupations with hierarchical semantic contextualization
        """
        logger.info(f"Starting KeSCO occupations import from {self.excel_path}")
        
        if not self.esco_lookup:
            logger.warning("⚠️  No ESCO lookup provided! Exact matching will be skipped.")
        else:
            logger.info(f"✓ ESCO lookup loaded with {len(self.esco_lookup)} searchable titles")
        
        if not self.hierarchical_matcher:
            logger.error("❌ No hierarchical matcher provided! Cannot proceed.")
            return self.stats
        else:
            logger.info("✓ Hierarchical semantic matcher available (Jasmin's approach)")
            logger.info("✓ AGGRESSIVE 55% threshold for maximum auto-matching")
        
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
        print("KESCO ↔ ESCO CONTEXTUALIZATION SUMMARY (HIERARCHICAL SEMANTIC)")
        print("=" * 80)
        print(f"Total KeSCO occupations: {total}")
        print(f"Auto-matched (≥55% confidence): {self.stats['auto_matched']} ({self.stats['auto_matched']/total*100:.1f}%)")
        print(f"Manual review (45-54%): {self.stats['manual_review']} ({self.stats['manual_review']/total*100:.1f}%)")
        print(f"No match (<45%): {self.stats['no_match']} ({self.stats['no_match']/total*100:.1f}%)")
        
        print("\n" + "-" * 80)
        print("MATCHING METHOD BREAKDOWN:")
        print("-" * 80)
        print(f"Exact matches: {self.stats['exact_matches']} (perfect title match)")
        print(f"Hierarchical group matches: {self.stats['hierarchical_group_matches']} (semantic within ISCO group)")
        print(f"Hierarchical fallback matches: {self.stats['hierarchical_fallback_matches']} (semantic across all occupations)")
        
        # Show sample auto-matches with ISCO groups
        print("\n" + "-" * 80)
        print("SAMPLE AUTO-MATCHED (≥55% confidence):")
        print("-" * 80)
        auto_matches = [m for m in self.matches if m['confidence'] >= 55][:10]
        for match in auto_matches:
            kesco_group = f"[{match['kesco_isco_group']}]" if match['kesco_isco_group'] else "[N/A]"
            esco_group = f"[{match['esco_isco_group']}]" if match['esco_isco_group'] else "[N/A]"
            method_display = match['method'].replace('_', ' ').title()
            print(f"{match['confidence']:.0f}% | {kesco_group} {match['kesco_title']} → {esco_group} {match['esco_title']} ({method_display})")
        
        # Show sample manual review cases
        print("\n" + "-" * 80)
        print("SAMPLE MANUAL REVIEW NEEDED (45-54% confidence):")
        print("-" * 80)
        manual_reviews = [m for m in self.matches if 45 <= m['confidence'] < 55][:10]
        for match in manual_reviews:
            kesco_group = f"[{match['kesco_isco_group']}]" if match['kesco_isco_group'] else "[N/A]"
            esco_group = f"[{match['esco_isco_group']}]" if match['esco_isco_group'] else "[N/A]"
            method_display = match['method'].replace('_', ' ').title()
            print(f"{match['confidence']:.0f}% | {kesco_group} {match['kesco_title']} → {esco_group} {match['esco_title']} ({method_display}) ⚠️")
        
        print("=" * 80 + "\n")
    
    def export_matches_to_csv(self, output_path: str = None):
        """Export match results to CSV for review"""
        if not output_path:
            output_path = "/home/steve/tabiya/resources/kesco_esco_hierarchical_matches.csv"
        
        df = pd.DataFrame(self.matches)
        df.to_csv(output_path, index=False)
        logger.info(f"✓ Exported matches to {output_path}")


async def main():
    """Example usage"""
    from motor.motor_asyncio import AsyncIOMotorClient #type:ignore
    from .hierarchical_semantic_matcher import build_hierarchical_matcher_from_db
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[TAXONOMY_DB_NAME]
    
    # Build hierarchical semantic matcher
    hierarchical_matcher, esco_lookup, _ = await build_hierarchical_matcher_from_db(db)
    
    # Import KeSCO with hierarchical semantic contextualization
    kesco_importer = KeSCOImporter(
        db, 
        esco_lookup=esco_lookup,
        hierarchical_matcher=hierarchical_matcher
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
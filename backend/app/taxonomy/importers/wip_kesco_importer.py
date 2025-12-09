"""
KeSCO Occupations Importer with Built-in Contextualization
===========================================================
Imports KeSCO occupations ALREADY CONTEXTUALIZED - no post-processing needed.

For each KeSCO occupation:
1. Fuzzy match to ESCO occupations (in memory)
2. If good match (≥85%): inherit ESCO skills immediately
3. Save to database ALREADY LINKED and USEFUL
"""

import asyncio
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from bson import ObjectId
from thefuzz import fuzz, process
import os
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.taxonomy.importers.config import ImporterConfig


class ContextualizedKeSCOImporter:
    """Import KeSCO occupations with contextualization built-in."""
    
    def __init__(self):
        self.config = ImporterConfig()
        self.client = AsyncIOMotorClient(self.config.mongodb_uri)
        self.db = self.client[self.config.database_name]
        
        # Collections
        self.occupations = self.db.occupations
        self.relations = self.db.occupation_skill_relations
        
        # In-memory caches for fast fuzzy matching
        self.esco_occupations = {}  # title -> full doc
        self.esco_skills_by_occupation = {}  # occupation_id -> list of skill relations
        
        # Statistics
        self.stats = {
            'total': 0,
            'exact_match': 0,
            'fuzzy_match': 0,
            'manual_review': 0,
            'no_match': 0,
            'skills_inherited': 0,
            'inserted': 0,
            'errors': 0
        }
    
    async def load_esco_context(self):
        """Load ESCO occupations and skills into memory for fast matching."""
        print("Loading ESCO context into memory...")
        
        # Load ESCO occupations
        cursor = self.occupations.find({"source": "ESCO"})
        async for occ in cursor:
            title = occ['preferred_label'].lower().strip()
            self.esco_occupations[title] = occ
            
            # Also index alternative labels
            for alt in occ.get('alternative_labels', []):
                alt_title = alt.lower().strip()
                if alt_title not in self.esco_occupations:
                    self.esco_occupations[alt_title] = occ
        
        print(f"  ✓ Loaded {len(self.esco_occupations)} ESCO occupation titles")
        
        # Load ESCO skill relations grouped by occupation
        cursor = self.relations.find({})
        async for rel in cursor:
            occ_id = rel['occupation_id']
            if occ_id not in self.esco_skills_by_occupation:
                self.esco_skills_by_occupation[occ_id] = []
            self.esco_skills_by_occupation[occ_id].append(rel)
        
        print(f"  ✓ Loaded skill relations for {len(self.esco_skills_by_occupation)} occupations")
    
    def fuzzy_match_to_esco(self, kesco_title: str):
        """
        Fuzzy match KeSCO title to ESCO.
        Returns: (esco_doc, confidence, method) or (None, 0, "no_match")
        """
        kesco_clean = kesco_title.lower().strip()
        
        # Exact match
        if kesco_clean in self.esco_occupations:
            return self.esco_occupations[kesco_clean], 100, "exact"
        
        # Fuzzy matching
        esco_titles = list(self.esco_occupations.keys())
        
        # Try multiple algorithms, take best
        best_score = 0
        best_title = None
        best_method = None
        
        # Token sort ratio
        result = process.extractOne(kesco_clean, esco_titles, scorer=fuzz.token_sort_ratio)
        if result and result[1] > best_score:
            best_score = result[1]
            best_title = result[0]
            best_method = "fuzzy_token_sort"
        
        # Token set ratio
        result = process.extractOne(kesco_clean, esco_titles, scorer=fuzz.token_set_ratio)
        if result and result[1] > best_score:
            best_score = result[1]
            best_title = result[0]
            best_method = "fuzzy_token_set"
        
        # Partial ratio
        result = process.extractOne(kesco_clean, esco_titles, scorer=fuzz.partial_ratio)
        if result and result[1] > best_score:
            best_score = result[1]
            best_title = result[0]
            best_method = "fuzzy_partial"
        
        if best_score >= 70:
            return self.esco_occupations[best_title], best_score, best_method
        
        return None, 0, "no_match"
    
    async def import_with_contextualization(self):
        """Import KeSCO occupations with contextualization built-in."""
        print("\n" + "=" * 80)
        print("IMPORTING KESCO OCCUPATIONS (CONTEXTUALIZED)")
        print("=" * 80)
        
        # Load KeSCO data
        kesco_file = "/home/steve/tabiya/resources/kesco_occupations.xlsx"
        print(f"\nLoading KeSCO data from {kesco_file}...")
        df = pd.read_excel(kesco_file)
        self.stats['total'] = len(df)
        print(f"  ✓ Loaded {len(df)} KeSCO occupations")
        
        # Process each KeSCO occupation
        print("\nProcessing KeSCO occupations with contextualization...")
        print("-" * 80)
        
        batch = []
        relations_batch = []
        
        for idx, row in df.iterrows():
            try:
                kesco_title = str(row['Occupational Title']).strip()
                kesco_code = str(row['KeSCO Code']).strip()
                
                # Fuzzy match to ESCO
                esco_match, confidence, method = self.fuzzy_match_to_esco(kesco_title)
                
                # Build occupation document
                occ_doc = {
                    'source': 'KeSCO',
                    'preferred_label': kesco_title,
                    'code': kesco_code,
                    'alternative_labels': [],
                    'created_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc)
                }
                
                # Contextualization based on match quality
                if confidence == 100:
                    # Exact match
                    self.stats['exact_match'] += 1
                    occ_doc.update({
                        'mapped_to_esco_id': esco_match['_id'],
                        'mapping_confidence': 1.0,
                        'mapping_method': method,
                        'is_localized': True,
                        'is_relevant_for_kenya': True,
                        'contextualization_status': 'auto_matched_exact'
                    })
                    
                    # Inherit skills
                    esco_skills = self.esco_skills_by_occupation.get(esco_match['_id'], [])
                    if esco_skills:
                        occ_id = ObjectId()
                        occ_doc['_id'] = occ_id
                        occ_doc['has_skill_relations'] = True
                        occ_doc['skill_relations_count'] = len(esco_skills)
                        
                        # Prepare skill relations
                        for skill_rel in esco_skills:
                            relations_batch.append({
                                'occupation_id': occ_id,
                                'skill_id': skill_rel['skill_id'],
                                'relation_type': skill_rel.get('relation_type', 'essential'),
                                'source': 'inherited_from_esco',
                                'inherited_from_esco_id': esco_match['_id'],
                                'created_at': datetime.now(timezone.utc)
                            })
                        self.stats['skills_inherited'] += len(esco_skills)
                
                elif confidence >= 85:
                    # High confidence fuzzy match
                    self.stats['fuzzy_match'] += 1
                    occ_doc.update({
                        'mapped_to_esco_id': esco_match['_id'],
                        'mapping_confidence': confidence / 100.0,
                        'mapping_method': method,
                        'is_localized': True,
                        'is_relevant_for_kenya': True,
                        'contextualization_status': 'auto_matched_fuzzy'
                    })
                    
                    # Inherit skills
                    esco_skills = self.esco_skills_by_occupation.get(esco_match['_id'], [])
                    if esco_skills:
                        occ_id = ObjectId()
                        occ_doc['_id'] = occ_id
                        occ_doc['has_skill_relations'] = True
                        occ_doc['skill_relations_count'] = len(esco_skills)
                        
                        for skill_rel in esco_skills:
                            relations_batch.append({
                                'occupation_id': occ_id,
                                'skill_id': skill_rel['skill_id'],
                                'relation_type': skill_rel.get('relation_type', 'essential'),
                                'source': 'inherited_from_esco',
                                'inherited_from_esco_id': esco_match['_id'],
                                'created_at': datetime.now(timezone.utc)
                            })
                        self.stats['skills_inherited'] += len(esco_skills)
                
                elif confidence >= 70:
                    # Medium confidence - flag for manual review
                    self.stats['manual_review'] += 1
                    occ_doc.update({
                        'suggested_esco_id': esco_match['_id'],
                        'mapping_confidence': confidence / 100.0,
                        'mapping_method': method,
                        'requires_manual_review': True,
                        'is_relevant_for_kenya': True,  # Assume relevant, but needs review
                        'contextualization_status': 'needs_manual_review'
                    })
                
                else:
                    # No good match - needs manual skill assignment
                    self.stats['no_match'] += 1
                    occ_doc.update({
                        'requires_manual_skill_assignment': True,
                        'is_relevant_for_kenya': True,  # Kenyan occupation, so relevant
                        'contextualization_status': 'needs_manual_skills'
                    })
                
                batch.append(occ_doc)
                
                # Batch insert every 100 records
                if len(batch) >= 100:
                    await self.occupations.insert_many(batch, ordered=False)
                    if relations_batch:
                        await self.relations.insert_many(relations_batch, ordered=False)
                    self.stats['inserted'] += len(batch)
                    print(f"  Processed {self.stats['inserted']}/{self.stats['total']}...")
                    batch = []
                    relations_batch = []
                
            except Exception as e:
                print(f"  ✗ Error processing {kesco_title}: {e}")
                self.stats['errors'] += 1
        
        # Insert remaining batch
        if batch:
            await self.occupations.insert_many(batch, ordered=False)
            if relations_batch:
                await self.relations.insert_many(relations_batch, ordered=False)
            self.stats['inserted'] += len(batch)
        
        print(f"\n✓ Import complete!")
    
    def print_summary(self):
        """Print import summary."""
        print("\n" + "=" * 80)
        print("IMPORT SUMMARY")
        print("=" * 80)
        print(f"\nTotal KeSCO occupations: {self.stats['total']}")
        print(f"Successfully inserted: {self.stats['inserted']}")
        print(f"Errors: {self.stats['errors']}")
        print(f"\nContextualization Breakdown:")
        print(f"  • Exact matches (100%): {self.stats['exact_match']} ({self.stats['exact_match']/self.stats['total']*100:.1f}%)")
        print(f"  • Fuzzy matches (≥85%): {self.stats['fuzzy_match']} ({self.stats['fuzzy_match']/self.stats['total']*100:.1f}%)")
        print(f"  • Manual review (70-84%): {self.stats['manual_review']} ({self.stats['manual_review']/self.stats['total']*100:.1f}%)")
        print(f"  • No match (<70%): {self.stats['no_match']} ({self.stats['no_match']/self.stats['total']*100:.1f}%)")
        print(f"\nSkills inherited: {self.stats['skills_inherited']}")
        print(f"\n✓ Database is CONTEXTUALIZED and USEFUL from day 1!")
        print("=" * 80)
    
    async def run(self):
        """Execute the import with contextualization."""
        try:
            # Step 1: Load ESCO context
            await self.load_esco_context()
            
            # Step 2: Import KeSCO with contextualization
            await self.import_with_contextualization()
            
            # Step 3: Print summary
            self.print_summary()
            
        finally:
            self.client.close()


async def main():
    importer = ContextualizedKeSCOImporter()
    await importer.run()


if __name__ == "__main__":
    asyncio.run(main())
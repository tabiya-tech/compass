# app/taxonomy/contextualization/kesco_esco_merger.py
"""
KeSCO ↔ ESCO Fuzzy Merger
==========================
Contextualizes the taxonomy by merging KeSCO occupations to ESCO equivalents.

This is the CORE VALUE-ADD that requires Kenyan labor market knowledge:
- Fuzzy match KeSCO occupation titles to ESCO occupation titles
- Auto-link high-confidence matches (≥85%)
- Flag medium-confidence matches (70-84%) for manual review
- Inherit skill relations from ESCO for matched occupations
- Generate detailed reports for quality assurance

"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient
from thefuzz import fuzz, process
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check if environment variables are set
if not os.getenv("APPLICATION_MONGODB_URI"):
    print("ERROR: Environment variables not found!")
    print("\nPlease set the following environment variables:")
    print("  export APPLICATION_MONGODB_URI='your_mongodb_uri'")
    print("  export APPLICATION_DATABASE_NAME='compass-kenya-application-local'")
    print("\nOr run with:")
    print("  APPLICATION_MONGODB_URI='...' APPLICATION_DATABASE_NAME='...' python3 kesco_esco_merger.py")
    sys.exit(1)


class TaxonomyContextualizer:
    """Contextualizes taxonomy by merging KeSCO and ESCO occupations."""
    
    def __init__(self):
        """Initialize the contextualizer with database connection."""
        self.client = AsyncIOMotorClient(os.getenv("APPLICATION_MONGODB_URI"))
        self.db = self.client[os.getenv("APPLICATION_DATABASE_NAME")]
        
        # Collections
        self.occupations = self.db.occupations
        self.skills = self.db.skills
        self.relations = self.db.occupation_skill_relations
        
        # Data caches
        self.esco_occupations: List[Dict] = []
        self.kesco_occupations: List[Dict] = []
        self.esco_lookup: Dict[str, Dict] = {}  # title -> occupation
        
        # Results tracking
        self.stats = {
            'total_kesco': 0,
            'auto_matched': 0,
            'manual_review': 0,
            'no_match': 0,
            'skills_inherited': 0,
            'start_time': datetime.now(timezone.utc)
        }
        
        self.matches: List[Dict] = []
        
    async def load_data(self):
        """Load ESCO and KeSCO occupations from database."""
        print("Loading taxonomy data from database...")
        
        # Load ESCO occupations
        cursor = self.occupations.find({"source": "ESCO"})
        self.esco_occupations = await cursor.to_list(length=None)
        print(f"  ✓ Loaded {len(self.esco_occupations)} ESCO occupations")
        
        # Create lookup dictionary for faster searching
        for occ in self.esco_occupations:
            title = occ.get('preferred_label', '').lower().strip()
            if title:
                self.esco_lookup[title] = occ
                
                # Also add alternative labels to lookup
                alt_labels = occ.get('alternative_labels', [])
                for alt in alt_labels:
                    alt_title = alt.lower().strip()
                    if alt_title and alt_title not in self.esco_lookup:
                        self.esco_lookup[alt_title] = occ
        
        # Load KeSCO occupations
        cursor = self.occupations.find({"source": "KeSCO"})
        self.kesco_occupations = await cursor.to_list(length=None)
        print(f"  ✓ Loaded {len(self.kesco_occupations)} KeSCO occupations")
        
        self.stats['total_kesco'] = len(self.kesco_occupations)
        
    def fuzzy_match_occupation(self, kesco_title: str) -> Tuple[Optional[Dict], int, str]:
        """
        Fuzzy match a KeSCO occupation to ESCO occupations.
        
        Args:
            kesco_title: KeSCO occupation title to match
            
        Returns:
            Tuple of (matched_esco_occupation, confidence_score, match_method)
        """
        kesco_title_clean = kesco_title.lower().strip()
        
        # Method 1: Exact match (100%)
        if kesco_title_clean in self.esco_lookup:
            return self.esco_lookup[kesco_title_clean], 100, "exact"
        
        # Method 2: Fuzzy matching on all ESCO titles
        esco_titles = list(self.esco_lookup.keys())
        
        # Use multiple fuzzy matching algorithms
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
        
        # Take the best match
        if matches:
            best_match = max(matches, key=lambda x: x[2])
            method, matched_title, score = best_match
            return self.esco_lookup.get(matched_title), score, f"fuzzy_{method}"
        
        return None, 0, "no_match"
    
    async def merge_kesco_to_esco(self):
        """Perform fuzzy matching of all KeSCO occupations to ESCO."""
        print("\nPerforming KeSCO → ESCO fuzzy matching...")
        print("-" * 80)
        
        for i, kesco_occ in enumerate(self.kesco_occupations, 1):
            kesco_id = kesco_occ['_id']
            kesco_title = kesco_occ.get('preferred_label', '')
            kesco_code = kesco_occ.get('code', '')
            
            # Perform fuzzy matching
            esco_match, confidence, method = self.fuzzy_match_occupation(kesco_title)
            
            match_record = {
                'kesco_id': kesco_id,
                'kesco_title': kesco_title,
                'kesco_code': kesco_code,
                'esco_match': None,
                'esco_id': None,
                'esco_title': None,
                'esco_code': None,
                'confidence': confidence,
                'match_method': method,
                'status': 'no_match',
                'timestamp': datetime.now(timezone.utc)
            }
            
            if esco_match and confidence >= 70:
                esco_id = esco_match['_id']
                esco_title = esco_match.get('preferred_label', '')
                esco_code = esco_match.get('code', '')
                
                match_record.update({
                    'esco_match': esco_match,
                    'esco_id': esco_id,
                    'esco_title': esco_title,
                    'esco_code': esco_code
                })
                
                # Categorize by confidence
                if confidence >= 85:
                    match_record['status'] = 'auto_matched'
                    self.stats['auto_matched'] += 1
                    
                    # Update KeSCO occupation in database
                    await self.occupations.update_one(
                        {'_id': kesco_id},
                        {
                            '$set': {
                                'mapped_to_esco_id': esco_id,
                                'mapping_confidence': confidence / 100.0,
                                'mapping_method': method,
                                'is_localized': True,
                                'updated_at': datetime.now(timezone.utc)
                            }
                        }
                    )
                    
                else:  # 70-84%
                    match_record['status'] = 'manual_review'
                    self.stats['manual_review'] += 1
                    
                    # Still save the suggestion but mark for review
                    await self.occupations.update_one(
                        {'_id': kesco_id},
                        {
                            '$set': {
                                'suggested_esco_id': esco_id,
                                'mapping_confidence': confidence / 100.0,
                                'mapping_method': method,
                                'requires_manual_review': True,
                                'updated_at': datetime.now(timezone.utc)
                            }
                        }
                    )
            else:
                match_record['status'] = 'no_match'
                self.stats['no_match'] += 1
                
                # Mark as needing manual skill assignment
                await self.occupations.update_one(
                    {'_id': kesco_id},
                    {
                        '$set': {
                            'requires_manual_skill_assignment': True,
                            'updated_at': datetime.now(timezone.utc)
                        }
                    }
                )
            
            self.matches.append(match_record)
            
            # Progress indicator
            if i % 100 == 0 or i == len(self.kesco_occupations):
                print(f"  Processed {i}/{len(self.kesco_occupations)} KeSCO occupations...")
        
        print(f"\n✓ Matching complete!")
        
    async def inherit_skill_relations(self):
        """Inherit skill relations from ESCO to auto-matched KeSCO occupations."""
        print("\nInheriting skill relations for auto-matched occupations...")
        print("-" * 80)
        
        auto_matched = [m for m in self.matches if m['status'] == 'auto_matched']
        
        for i, match in enumerate(auto_matched, 1):
            kesco_id = match['kesco_id']
            esco_id = match['esco_id']
            
            # Find all skills for the matched ESCO occupation
            esco_relations = await self.relations.find({
                'occupation_id': esco_id
            }).to_list(length=None)
            
            if esco_relations:
                # Create new relations for KeSCO occupation
                new_relations = []
                for rel in esco_relations:
                    new_rel = {
                        'occupation_id': kesco_id,
                        'skill_id': rel['skill_id'],
                        'relation_type': rel.get('relation_type', 'essential'),
                        'source': 'inherited_from_esco',
                        'inherited_from_esco_id': esco_id,
                        'created_at': datetime.now(timezone.utc)
                    }
                    new_relations.append(new_rel)
                
                # Bulk insert
                if new_relations:
                    await self.relations.insert_many(new_relations)
                    self.stats['skills_inherited'] += len(new_relations)
                    
                    # Update KeSCO occupation to mark it has skills
                    await self.occupations.update_one(
                        {'_id': kesco_id},
                        {
                            '$set': {
                                'has_skill_relations': True,
                                'skill_relations_count': len(new_relations)
                            }
                        }
                    )
            
            if i % 50 == 0 or i == len(auto_matched):
                print(f"  Processed {i}/{len(auto_matched)} auto-matched occupations...")
        
        print(f"\n✓ Skill inheritance complete!")
    
    def generate_reports(self):
        """Generate detailed reports of the matching process."""
        print("\n" + "=" * 80)
        print("KESCO ↔ ESCO FUZZY MATCHING REPORT")
        print("=" * 80)
        
        # Summary statistics
        print("\nSUMMARY STATISTICS:")
        print("-" * 80)
        print(f"Total KeSCO occupations: {self.stats['total_kesco']}")
        print(f"Auto-matched (≥85% confidence): {self.stats['auto_matched']} ({self.stats['auto_matched']/self.stats['total_kesco']*100:.1f}%)")
        print(f"Manual review needed (70-84%): {self.stats['manual_review']} ({self.stats['manual_review']/self.stats['total_kesco']*100:.1f}%)")
        print(f"No match found (<70%): {self.stats['no_match']} ({self.stats['no_match']/self.stats['total_kesco']*100:.1f}%)")
        print(f"Skill relations inherited: {self.stats['skills_inherited']}")
        
        duration = (datetime.now(timezone.utc) - self.stats['start_time']).total_seconds()
        print(f"\nProcessing time: {duration:.2f} seconds")
        
        # Sample of auto-matches
        print("\n" + "=" * 80)
        print("SAMPLE AUTO-MATCHED OCCUPATIONS (Confidence ≥85%)")
        print("=" * 80)
        auto_matches = [m for m in self.matches if m['status'] == 'auto_matched'][:20]
        for match in auto_matches:
            print(f"\n{match['confidence']}% | {match['match_method']}")
            print(f"  KeSCO: {match['kesco_title']} ({match['kesco_code']})")
            print(f"  ESCO:  {match['esco_title']} ({match['esco_code']})")
        
        # Sample of manual review cases
        print("\n" + "=" * 80)
        print("SAMPLE MANUAL REVIEW CASES (Confidence 70-84%)")
        print("=" * 80)
        manual_reviews = [m for m in self.matches if m['status'] == 'manual_review'][:20]
        for match in manual_reviews:
            print(f"\n{match['confidence']}% | {match['match_method']}")
            print(f"  KeSCO: {match['kesco_title']} ({match['kesco_code']})")
            print(f"  ESCO:  {match['esco_title']} ({match['esco_code']})")
            print(f"  ⚠️  REQUIRES MANUAL VERIFICATION")
        
        # Sample of no matches
        print("\n" + "=" * 80)
        print("SAMPLE NO MATCH CASES (Confidence <70%)")
        print("=" * 80)
        no_matches = [m for m in self.matches if m['status'] == 'no_match'][:20]
        for match in no_matches:
            print(f"\n  KeSCO: {match['kesco_title']} ({match['kesco_code']})")
            print(f"  ⚠️  REQUIRES MANUAL SKILL ASSIGNMENT")
    
    async def export_results(self):
        """Export results to CSV files for review."""
        print("\n" + "=" * 80)
        print("EXPORTING RESULTS TO CSV")
        print("=" * 80)
        
        # Convert matches to DataFrame
        df = pd.DataFrame([{
            'KeSCO Code': m['kesco_code'],
            'KeSCO Title': m['kesco_title'],
            'ESCO Code': m.get('esco_code', ''),
            'ESCO Title': m.get('esco_title', ''),
            'Confidence': m['confidence'],
            'Match Method': m['match_method'],
            'Status': m['status']
        } for m in self.matches])
        
        # Export all matches
        all_matches_file = '/home/steve/tabiya/resources/kesco_esco_all_matches.csv'
        df.to_csv(all_matches_file, index=False)
        print(f"✓ All matches: {all_matches_file}")
        
        # Export manual review cases
        manual_review_df = df[df['Status'] == 'manual_review']
        manual_review_file = '/home/steve/tabiya/resources/kesco_esco_manual_review.csv'
        manual_review_df.to_csv(manual_review_file, index=False)
        print(f"✓ Manual review cases: {manual_review_file}")
        
        # Export no match cases
        no_match_df = df[df['Status'] == 'no_match']
        no_match_file = '/home/steve/tabiya/resources/kesco_esco_no_matches.csv'
        no_match_df.to_csv(no_match_file, index=False)
        print(f"✓ No match cases: {no_match_file}")
        
        # Export auto-matched
        auto_match_df = df[df['Status'] == 'auto_matched']
        auto_match_file = '/home/steve/tabiya/resources/kesco_esco_auto_matched.csv'
        auto_match_df.to_csv(auto_match_file, index=False)
        print(f"✓ Auto-matched cases: {auto_match_file}")
        
        print(f"\n✓ All results exported successfully!")
    
    async def run(self):
        """Execute the complete contextualization workflow."""
        try:
            print("\n" + "=" * 80)
            print("TAXONOMY CONTEXTUALIZATION - KESCO ↔ ESCO FUZZY MERGER")
            print("=" * 80)
            print("\nThis tool adds the CORE VALUE that requires Kenyan labor market expertise:")
            print("  • Fuzzy matching KeSCO occupations to ESCO equivalents")
            print("  • Automatic linking of high-confidence matches")
            print("  • Flagging medium-confidence matches for expert review")
            print("  • Inheriting skill relations from ESCO")
            print("  • Identifying occupations needing manual skill assignment")
            print("\n" + "=" * 80 + "\n")
            
            # Step 1: Load data
            await self.load_data()
            
            # Step 2: Perform fuzzy matching
            await self.merge_kesco_to_esco()
            
            # Step 3: Inherit skills for auto-matched occupations
            await self.inherit_skill_relations()
            
            # Step 4: Generate reports
            self.generate_reports()
            
            # Step 5: Export results
            await self.export_results()
            
            print("\n" + "=" * 80)
            print("✓ CONTEXTUALIZATION COMPLETE!")
            print("=" * 80)
            print("\nNEXT STEPS:")
            print("1. Review manual_review.csv - verify 70-84% confidence matches")
            print("2. Review no_matches.csv - assign skills to unmatched occupations")
            print("3. Use the provided CSV files to make informed decisions")
            print("4. Update the database with your expert knowledge")
            print("\nYou've now added the CONTEXTUALIZATION value the client expects!")
            print("=" * 80 + "\n")
            
        finally:
            self.client.close()


async def main():
    """Main entry point."""
    contextualizer = TaxonomyContextualizer()
    await contextualizer.run()


if __name__ == "__main__":
    asyncio.run(main())
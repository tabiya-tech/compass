"""
Hierarchical semantic matcher using ISCO group codes.
Algorithm: Filter by ISCO group first, then semantic match within group.
"""

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Tuple, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HierarchicalSemanticMatcher:
    """
    Two-stage hierarchical matching:
    1. Filter ESCO occupations by ISCO group code
    2. Semantic match within that group
    3. Fallback to full catalog if needed
    """
    
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        """Initialize with sentence transformer model"""
        logger.info(f"Loading sentence transformer model: {model_name}")
        self.model = SentenceTransformer(model_name)
        logger.info("✓ Model loaded successfully")
        
        # Group-based indices
        self.group_indices = {}  # {group_code: {titles: [], embeddings: np.array, lookup: {}}}
        
        # Full catalog index (fallback)
        self.all_titles = []
        self.all_embeddings = None
        self.all_lookup = {}
    
    def build_indices(
        self, 
        esco_lookup: Dict[str, Dict],
        esco_group_lookup: Dict[str, List[Dict]]
    ):
        """
        Build both group-based and full catalog indices.
        
        Args:
            esco_lookup: Flat lookup (title -> occupation)
            esco_group_lookup: Grouped lookup (isco_code -> [occupations])
        """
        logger.info("Building hierarchical semantic indices...")
        
        # Build group-based indices
        self._build_group_indices(esco_group_lookup)
        
        # Build full catalog index (for fallback)
        self._build_full_index(esco_lookup)
        
        logger.info("✓ Hierarchical indices built successfully")
    
    def _build_group_indices(self, esco_group_lookup: Dict[str, List[Dict]]):
        """Build semantic index for each ISCO group"""
        logger.info(f"Building group-based indices for {len(esco_group_lookup)} groups...")
        
        for group_code, occupations in esco_group_lookup.items():
            # Extract unique titles
            titles = []
            lookup = {}
            
            seen_ids = set()
            for occ in occupations:
                occ_id = str(occ['_id'])
                if occ_id not in seen_ids:
                    seen_ids.add(occ_id)
                    
                    title = occ.get('preferred_label', '')
                    if title:
                        titles.append(title)
                        lookup[title] = occ
            
            if not titles:
                continue
            
            # Generate embeddings for this group 
            embeddings = self.model.encode(
                titles,
                show_progress_bar=False,
                convert_to_numpy=True
            )
            
            self.group_indices[group_code] = {
                'titles': titles,
                'embeddings': embeddings,
                'lookup': lookup
            }
        
        logger.info(f"✓ Built {len(self.group_indices)} group indices")
    
    def _build_full_index(self, esco_lookup: Dict[str, Dict]):
        """Build full catalog index for fallback"""
        logger.info("Building full catalog index...")
        
        # Extract unique occupations
        seen_ids = set()
        unique_occupations = []
        
        for title, occ in esco_lookup.items():
            occ_id = str(occ['_id'])
            if occ_id not in seen_ids:
                seen_ids.add(occ_id)
                unique_occupations.append(occ)
        
        # Store titles and lookup
        self.all_titles = []
        self.all_lookup = {}
        
        for occ in unique_occupations:
            title = occ.get('preferred_label', '')
            if title:
                self.all_titles.append(title)
                self.all_lookup[title] = occ
        
        # Generate embeddings 
        logger.info(f"Generating embeddings for {len(self.all_titles)} occupations...")
        self.all_embeddings = self.model.encode(
            self.all_titles,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        logger.info(f"✓ Full catalog index built: {self.all_embeddings.shape}")
    
    def match_hierarchical(
        self,
        kesco_title: str,
        kesco_isco_group: str = None,
        top_k: int = 1
    ) -> List[Tuple[Dict, float, str]]:
        """
        Match using hierarchical approach:
        1. Try matching within ISCO group first
        2. Fall back to full catalog if needed
        
        Args:
            kesco_title: KeSCO occupation title
            kesco_isco_group: 4-digit ISCO group code
            top_k: Number of matches to return
            
        Returns:
            List of (occupation_dict, confidence_0_to_1, method)
        """
        # Stage 1: Try group-based matching
        if kesco_isco_group and kesco_isco_group in self.group_indices:
            group_matches = self._match_within_group(
                kesco_title, 
                kesco_isco_group,
                top_k
            )
            
            if group_matches and group_matches[0][1] >= 0.65:  # 65% threshold
                # Good match found in group
                return [(m[0], m[1], 'hierarchical_group') for m in group_matches]
        
        # Stage 2: Fall back to full catalog
        full_matches = self._match_full_catalog(kesco_title, top_k)
        return [(m[0], m[1], 'hierarchical_fallback') for m in full_matches]
    
    def _match_within_group(
        self,
        kesco_title: str,
        group_code: str,
        top_k: int = 1
    ) -> List[Tuple[Dict, float]]:
        """Match within a specific ISCO group"""
        if group_code not in self.group_indices:
            return []
        
        group_data = self.group_indices[group_code]
        
        # Generate embedding for KeSCO title 
        kesco_embedding = self.model.encode(
            [kesco_title],
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        # Calculate cosine similarity
        similarities = cosine_similarity(
            kesco_embedding,
            group_data['embeddings']
        )[0]
        
        # Get top K matches
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        
        matches = []
        for idx in top_indices:
            title = group_data['titles'][idx]
            occ = group_data['lookup'][title]
            similarity = float(similarities[idx])
            matches.append((occ, similarity))
        
        return matches
    
    def _match_full_catalog(
        self,
        kesco_title: str,
        top_k: int = 1
    ) -> List[Tuple[Dict, float]]:
        """Match against full ESCO catalog"""
        if self.all_embeddings is None:
            return []
        
        # Generate embedding 
        kesco_embedding = self.model.encode(
            [kesco_title],
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        # Calculate cosine similarity
        similarities = cosine_similarity(
            kesco_embedding,
            self.all_embeddings
        )[0]
        
        # Get top K
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        
        matches = []
        for idx in top_indices:
            title = self.all_titles[idx]
            occ = self.all_lookup[title]
            similarity = float(similarities[idx])
            matches.append((occ, similarity))
        
        return matches
    
    def match_with_fallback(
        self,
        kesco_title: str,
        kesco_isco_group: str = None,
        fuzzy_lookup: Dict[str, Dict] = None,
        semantic_threshold: float = 0.70,
    ) -> Tuple[Optional[Dict], float, str]:
        """
        Complete matching pipeline WITHOUT fuzzy fallback.
        
        Returns:
            (matched_esco_dict, confidence_0_to_100, match_method)
        """
        kesco_title_clean = kesco_title.lower().strip()
        
        # Try exact match first (fastest)
        if fuzzy_lookup and kesco_title_clean in fuzzy_lookup:
            return fuzzy_lookup[kesco_title_clean], 100.0, "exact"
        
        # Try hierarchical semantic matching
        hierarchical_matches = self.match_hierarchical(
            kesco_title,
            kesco_isco_group,
            top_k=1
        )
        
        if hierarchical_matches:
            esco_occ, similarity, method = hierarchical_matches[0]
            confidence = similarity * 100
            
            if similarity >= semantic_threshold:
                return esco_occ, confidence, f"{method}_high_conf"
            elif similarity >= 0.60:
                return esco_occ, confidence, f"{method}_medium_conf"
        
        # NO FUZZY FALLBACK - just return no match
        return None, 0.0, "no_match"

# Convenience builder function
async def build_hierarchical_matcher_from_db(
    db,
    model_name: str = 'all-MiniLM-L6-v2'
):
    """
    Build hierarchical semantic matcher from database.
    
    Returns:
        Tuple of (HierarchicalSemanticMatcher, esco_lookup, esco_group_lookup)
    """
    from app.taxonomy.models import TaxonomyCollections
    
    logger.info("Building hierarchical semantic matcher from database...")
    
    # Load ESCO occupations
    cursor = db[TaxonomyCollections.OCCUPATIONS].find({"source": "ESCO"})
    esco_occupations = await cursor.to_list(length=None)
    
    # Build flat lookup (for exact matching)
    esco_lookup = {}
    for occ in esco_occupations:
        title = occ.get('preferred_label', '').lower().strip()
        if title:
            esco_lookup[title] = occ
        
        # Add alt labels
        for alt in occ.get('alt_labels', []):
            alt_title = alt.lower().strip()
            if alt_title and alt_title not in esco_lookup:
                esco_lookup[alt_title] = occ
    
    # Build group lookup
    esco_group_lookup = {}
    no_group_count = 0
    
    for occ in esco_occupations:
        group_code = occ.get('isco_group_code')
        
        if group_code:
            if group_code not in esco_group_lookup:
                esco_group_lookup[group_code] = []
            esco_group_lookup[group_code].append(occ)
        else:
            no_group_count += 1
    
    logger.info(f"✓ Loaded {len(esco_occupations)} ESCO occupations")
    logger.info(f"✓ Built flat lookup with {len(esco_lookup)} searchable titles")
    logger.info(f"✓ Built group lookup with {len(esco_group_lookup)} ISCO groups")
    if no_group_count > 0:
        logger.warning(f"  ⚠️  {no_group_count} occupations without ISCO group code")
    
    # Create and initialize matcher
    matcher = HierarchicalSemanticMatcher(model_name=model_name)
    matcher.build_indices(esco_lookup, esco_group_lookup)
    
    return matcher, esco_lookup, esco_group_lookup
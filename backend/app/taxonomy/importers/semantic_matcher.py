import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Tuple, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SemanticOccupationMatcher:
    """Semantic matching using sentence transformers."""
    
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        """
        Initialize semantic matcher.
        
        Args:
            model_name: Sentence transformer model to use
                       'all-MiniLM-L6-v2' - Fast, good quality (default)
                       'all-mpnet-base-v2' - Slower, best quality
        """
        logger.info(f"Loading sentence transformer model: {model_name}")
        self.model = SentenceTransformer(model_name)
        logger.info("✓ Model loaded successfully")
        
        self.esco_titles = []
        self.esco_embeddings = None
        self.esco_lookup = {}
    
    def build_index(self, esco_lookup: Dict[str, Dict]):
        """
        Build semantic index from ESCO occupations.
        
        Args:
            esco_lookup: Dictionary mapping lowercase titles to occupation dicts
        """
        logger.info("Building semantic index from ESCO occupations...")
        
        # Extract unique occupations (not just alt labels)
        seen_ids = set()
        unique_occupations = []
        
        for title, occ in esco_lookup.items():
            occ_id = str(occ['_id'])
            if occ_id not in seen_ids:
                seen_ids.add(occ_id)
                unique_occupations.append(occ)
        
        logger.info(f"Found {len(unique_occupations)} unique ESCO occupations")
        
        # Store titles and create lookup
        self.esco_titles = []
        self.esco_lookup = {}
        
        for occ in unique_occupations:
            title = occ.get('preferred_label', '')
            if title:
                self.esco_titles.append(title)
                self.esco_lookup[title] = occ
        
        # Generate embeddings
        logger.info(f"Generating semantic embeddings for {len(self.esco_titles)} titles...")
        self.esco_embeddings = self.model.encode(
            self.esco_titles,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        
        logger.info(f"✓ Semantic index built: {self.esco_embeddings.shape}")
    
    def match(
        self, 
        kesco_title: str, 
        top_k: int = 3
    ) -> List[Tuple[Dict, float, str]]:
        """
        Find semantically similar ESCO occupations.
        
        Args:
            kesco_title: KeSCO occupation title to match
            top_k: Number of top matches to return
            
        Returns:
            List of tuples: (esco_occupation_dict, similarity_score, method)
        """
        if not kesco_title or self.esco_embeddings is None:
            return []
        
        # Generate embedding for KeSCO title
        kesco_embedding = self.model.encode(
            [kesco_title],
            convert_to_numpy=True
        )
        
        # Calculate cosine similarity with all ESCO titles
        similarities = cosine_similarity(
            kesco_embedding,
            self.esco_embeddings
        )[0]
        
        # Get top K matches
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        
        matches = []
        for idx in top_indices:
            esco_title = self.esco_titles[idx]
            esco_occ = self.esco_lookup[esco_title]
            similarity = float(similarities[idx])
            
            matches.append((esco_occ, similarity, 'semantic_embedding'))
        
        return matches
    
    def match_with_fallback(
        self,
        kesco_title: str,
        fuzzy_lookup: Dict[str, Dict] = None,
        semantic_threshold: float = 0.75,
        fuzzy_threshold: int = 85
    ) -> Tuple[Optional[Dict], float, str]:
        """
        Match using semantic similarity with fuzzy fallback.
        
        Args:
            kesco_title: KeSCO title to match
            fuzzy_lookup: Optional fuzzy lookup dict for fallback
            semantic_threshold: Minimum semantic similarity (0-1)
            fuzzy_threshold: Minimum fuzzy match score (0-100)
            
        Returns:
            Tuple of (matched_esco_dict, confidence, match_method)
        """
        kesco_title_clean = kesco_title.lower().strip()
        
        # Try exact match first (fastest)
        if fuzzy_lookup and kesco_title_clean in fuzzy_lookup:
            return fuzzy_lookup[kesco_title_clean], 100.0, "exact"
        
        # Try semantic matching
        semantic_matches = self.match(kesco_title, top_k=1)
        
        if semantic_matches:
            esco_occ, similarity, method = semantic_matches[0]
            
            # Convert similarity (0-1) to confidence percentage (0-100)
            confidence = similarity * 100
            
            if similarity >= semantic_threshold:
                return esco_occ, confidence, f"{method}_high_conf"
            elif similarity >= 0.65:  # Medium confidence
                return esco_occ, confidence, f"{method}_medium_conf"
        
        # Fallback to fuzzy if semantic didn't work
        if fuzzy_lookup:
            from thefuzz import fuzz, process
            
            esco_titles = list(fuzzy_lookup.keys())
            result = process.extractOne(
                kesco_title_clean,
                esco_titles,
                scorer=fuzz.token_sort_ratio
            )
            
            if result and result[1] >= fuzzy_threshold:
                matched_title = result[0]
                return fuzzy_lookup[matched_title], float(result[1]), "fuzzy_fallback"
        
        return None, 0.0, "no_match"


# Convenience function for imports
async def build_semantic_matcher_from_db(db, model_name: str = 'all-MiniLM-L6-v2'):
    """
    Build semantic matcher from database.
    
    Args:
        db: MongoDB database connection
        model_name: Sentence transformer model name
        
    Returns:
        Tuple of (SemanticOccupationMatcher, esco_lookup_dict)
    """
    from app.taxonomy.models import TaxonomyCollections
    
    logger.info("Building semantic matcher from database...")
    
    # Load ESCO occupations
    cursor = db[TaxonomyCollections.OCCUPATIONS].find({"source": "ESCO"})
    esco_occupations = await cursor.to_list(length=None)
    
    # Build lookup
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
    
    # Create and initialize matcher
    matcher = SemanticOccupationMatcher(model_name=model_name)
    matcher.build_index(esco_lookup)
    
    return matcher, esco_lookup
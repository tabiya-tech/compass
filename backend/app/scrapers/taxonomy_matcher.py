"""
Taxonomy matcher - Maps job titles and descriptions to ESCO/KeSCO occupations and skills.
Uses fuzzy matching with thefuzz library.
"""

from typing import List, Optional, Dict, Tuple
from thefuzz import fuzz, process
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TaxonomyMatcher")


class TaxonomyMatcher:
    """Matches job titles/descriptions to taxonomy occupations and skills."""
    
    def __init__(self, occupations: List[Dict], skills: List[Dict]):
        """
        Initialize matcher with taxonomy data.
        
        Args:
            occupations: List of occupation dicts with 'id' and 'preferred_label'
            skills: List of skill dicts with 'id' and 'preferred_label'
        """
        self.occupations = occupations
        self.skills = skills
        
        # Create lookup dictionaries
        self.occupation_labels = {occ['preferred_label']: occ['id'] for occ in occupations}
        self.skill_labels = {skill['preferred_label']: skill['id'] for skill in skills}
        
        logger.info(f"Initialized matcher with {len(occupations)} occupations and {len(skills)} skills")
    
    def match_occupation(
        self, 
        job_title: str, 
        threshold: int = 70
    ) -> Optional[Tuple[str, str, int]]:
        """
        Find best matching occupation for a job title.
        
        Args:
            job_title: Job title to match
            threshold: Minimum match score (0-100)
        
        Returns:
            Tuple of (occupation_id, matched_label, score) or None
        """
        if not job_title:
            return None
        
        # Use process.extractOne for best match
        result = process.extractOne(
            job_title,
            self.occupation_labels.keys(),
            scorer=fuzz.token_sort_ratio
        )
        
        if result and result[1] >= threshold:
            matched_label = result[0]
            score = result[1]
            occupation_id = self.occupation_labels[matched_label]
            
            logger.debug(f"Matched '{job_title}' → '{matched_label}' (score: {score})")
            return (occupation_id, matched_label, score)
        
        logger.debug(f"No match found for '{job_title}' (threshold: {threshold})")
        return None
    
    def match_skills(
        self, 
        job_description: str, 
        threshold: int = 80,
        max_skills: int = 10
    ) -> List[Tuple[str, str, int]]:
        """
        Extract skills from job description.
        
        Args:
            job_description: Job description text
            threshold: Minimum match score (0-100)
            max_skills: Maximum number of skills to return
        
        Returns:
            List of tuples (skill_id, matched_label, score)
        """
        if not job_description:
            return []
        
        matched_skills = []
        
        # Use process.extract for multiple matches
        results = process.extract(
            job_description,
            self.skill_labels.keys(),
            scorer=fuzz.partial_ratio,
            limit=max_skills * 2  # Get more to filter
        )
        
        for matched_label, score in results:
            if score >= threshold:
                skill_id = self.skill_labels[matched_label]
                matched_skills.append((skill_id, matched_label, score))
        
        # Sort by score and limit
        matched_skills.sort(key=lambda x: x[2], reverse=True)
        matched_skills = matched_skills[:max_skills]
        
        logger.debug(f"Matched {len(matched_skills)} skills from description")
        return matched_skills
    
    def match_job(
        self,
        job_data: Dict,
        occupation_threshold: int = 70,
        skill_threshold: int = 80
    ) -> Dict:
        """
        Match both occupation and skills for a complete job posting.
        
        Args:
            job_data: Job dictionary with 'title' and 'description'
            occupation_threshold: Threshold for occupation matching
            skill_threshold: Threshold for skill matching
        
        Returns:
            Dictionary with 'mapped_occupation_id', 'mapped_skills', and match scores
        """
        result = {
            'mapped_occupation_id': None,
            'occupation_match_label': None,
            'occupation_match_score': None,
            'mapped_skills': [],
            'skill_matches': []
        }
        
        # Match occupation
        occupation_match = self.match_occupation(
            job_data.get('title', ''),
            threshold=occupation_threshold
        )
        
        if occupation_match:
            result['mapped_occupation_id'] = occupation_match[0]
            result['occupation_match_label'] = occupation_match[1]
            result['occupation_match_score'] = occupation_match[2]
        
        # Match skills
        skill_matches = self.match_skills(
            job_data.get('description', ''),
            threshold=skill_threshold
        )
        
        if skill_matches:
            result['mapped_skills'] = [match[0] for match in skill_matches]
            result['skill_matches'] = [
                {'skill_id': match[0], 'label': match[1], 'score': match[2]}
                for match in skill_matches
            ]
        
        return result
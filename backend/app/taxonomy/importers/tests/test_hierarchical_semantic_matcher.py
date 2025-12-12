"""
BDD tests for HierarchicalSemanticMatcher

Tests the hierarchical semantic matching algorithm that maps KeSCO occupations to ESCO occupations
using ISCO group filtering and semantic similarity.
"""

import pytest
from unittest.mock import Mock, MagicMock
import numpy as np

from app.taxonomy.importers.hierarchical_semantic_matcher import HierarchicalSemanticMatcher


# ============================================================================
# Test Suite: HierarchicalSemanticMatcher Initialization
# ============================================================================

describe = pytest.mark.describe


@describe("test HierarchicalSemanticMatcher initialization")
class TestHierarchicalSemanticMatcherInitialization:
    """Test that the matcher initializes correctly with sentence transformer model"""
    
    def test_should_initialize_with_default_model(self):
        """should initialize with default model 'all-MiniLM-L6-v2'"""
        # GIVEN no specific model name
        
        # WHEN the matcher is initialized
        actualMatcher = HierarchicalSemanticMatcher()
        
        # THEN expect the matcher to be created
        assert actualMatcher is not None
        # AND expect the model to be loaded
        assert actualMatcher.model is not None
        # AND expect empty indices initially
        assert len(actualMatcher.group_indices) == 0
        assert actualMatcher.all_embeddings is None
    
    def test_should_initialize_with_custom_model(self):
        """should initialize with custom model name"""
        # GIVEN a custom model name
        givenModelName = "all-mpnet-base-v2"
        
        # WHEN the matcher is initialized with the custom model
        actualMatcher = HierarchicalSemanticMatcher(model_name=givenModelName)
        
        # THEN expect the matcher to be created
        assert actualMatcher is not None
        # AND expect the model to be loaded
        assert actualMatcher.model is not None


# ============================================================================
# Test Suite: Building Indices
# ============================================================================

@describe("test build_indices() method")
class TestBuildIndices:
    """Test that indices are built correctly from ESCO data"""
    
    def test_should_build_group_and_full_indices_from_esco_data(self):
        """should build both group-based and full catalog indices"""
        # GIVEN a matcher instance
        givenMatcher = HierarchicalSemanticMatcher()
        
        # AND ESCO lookup data with occupations
        givenEscoLookup = {
            "software developer": {
                "_id": "esco_001",
                "preferred_label": "Software Developer",
                "isco_group_code": "2512"
            },
            "web developer": {
                "_id": "esco_002", 
                "preferred_label": "Web Developer",
                "isco_group_code": "2512"
            },
            "accountant": {
                "_id": "esco_003",
                "preferred_label": "Accountant",
                "isco_group_code": "2411"
            }
        }
        
        # AND ESCO group lookup organized by ISCO code
        givenEscoGroupLookup = {
            "2512": [
                givenEscoLookup["software developer"],
                givenEscoLookup["web developer"]
            ],
            "2411": [
                givenEscoLookup["accountant"]
            ]
        }
        
        # WHEN the indices are built
        givenMatcher.build_indices(givenEscoLookup, givenEscoGroupLookup)
        
        # THEN expect group indices to be created for each ISCO code
        assert len(givenMatcher.group_indices) == 2
        assert "2512" in givenMatcher.group_indices
        assert "2411" in givenMatcher.group_indices
        
        # AND expect the 2512 group to have 2 occupations
        assert len(givenMatcher.group_indices["2512"]["titles"]) == 2
        # AND expect embeddings to be generated
        assert givenMatcher.group_indices["2512"]["embeddings"] is not None
        
        # AND expect full catalog index to be built
        assert len(givenMatcher.all_titles) == 3
        assert givenMatcher.all_embeddings is not None
        assert givenMatcher.all_embeddings.shape[0] == 3


# ============================================================================
# Test Suite: Hierarchical Matching
# ============================================================================

@describe("test match_hierarchical() method")
class TestMatchHierarchical:
    """Test hierarchical matching with ISCO group filtering"""
    
    @pytest.fixture
    def matcher_with_test_data(self):
        """Fixture providing a matcher with pre-built test data"""
        # GIVEN a matcher with test data
        givenMatcher = HierarchicalSemanticMatcher()
        
        givenEscoLookup = {
            "software developer": {
                "_id": "esco_001",
                "preferred_label": "Software Developer",
                "code": "2512.1",
                "isco_group_code": "2512"
            },
            "web developer": {
                "_id": "esco_002",
                "preferred_label": "Web Developer", 
                "code": "2512.2",
                "isco_group_code": "2512"
            },
            "accountant": {
                "_id": "esco_003",
                "preferred_label": "Accountant",
                "code": "2411.1",
                "isco_group_code": "2411"
            }
        }
        
        givenEscoGroupLookup = {
            "2512": [
                givenEscoLookup["software developer"],
                givenEscoLookup["web developer"]
            ],
            "2411": [
                givenEscoLookup["accountant"]
            ]
        }
        
        givenMatcher.build_indices(givenEscoLookup, givenEscoGroupLookup)
        
        return givenMatcher
    
    def test_should_match_within_isco_group_when_good_similarity(self, matcher_with_test_data):
        """should match within ISCO group when similarity is above threshold"""
        # GIVEN a matcher with test data
        givenMatcher = matcher_with_test_data
        
        # AND a KeSCO title similar to an ESCO occupation in group 2512
        givenKescoTitle = "Software Engineer"
        givenIscoGroup = "2512"
        
        # WHEN hierarchical matching is performed
        actualMatches = givenMatcher.match_hierarchical(
            givenKescoTitle,
            givenIscoGroup,
            top_k=1
        )
        
        # THEN expect one match to be returned
        assert len(actualMatches) == 1
        
        # AND expect the match to be from group 2512
        actualMatch, actualConfidence, actualMethod = actualMatches[0]
        assert actualMatch["isco_group_code"] == "2512"
        
        # AND expect the method to be hierarchical_group
        assert actualMethod == "hierarchical_group"
        
        # AND expect confidence to be reasonable
        assert actualConfidence > 0.5
    
    def test_should_fallback_to_full_catalog_when_group_match_is_poor(self, matcher_with_test_data):
        """should fall back to full catalog search when group-based match is below threshold"""
        # GIVEN a matcher with test data
        givenMatcher = matcher_with_test_data
        
        # AND a KeSCO title that doesn't match well within its ISCO group
        givenKescoTitle = "Financial Analyst"  # Similar to Accountant but in different semantic space
        givenIscoGroup = "2512"  # Looking in wrong group
        
        # WHEN hierarchical matching is performed
        actualMatches = givenMatcher.match_hierarchical(
            givenKescoTitle,
            givenIscoGroup,
            top_k=1
        )
        
        # THEN expect one match to be returned
        assert len(actualMatches) == 1
        
        # AND expect the method to be hierarchical_fallback
        actualMatch, actualConfidence, actualMethod = actualMatches[0]
        assert actualMethod == "hierarchical_fallback"
    
    def test_should_use_full_catalog_when_isco_group_not_provided(self, matcher_with_test_data):
        """should use full catalog search when ISCO group code is not provided"""
        # GIVEN a matcher with test data
        givenMatcher = matcher_with_test_data
        
        # AND a KeSCO title without ISCO group
        givenKescoTitle = "Software Developer"
        givenIscoGroup = None
        
        # WHEN hierarchical matching is performed
        actualMatches = givenMatcher.match_hierarchical(
            givenKescoTitle,
            givenIscoGroup,
            top_k=1
        )
        
        # THEN expect one match to be returned
        assert len(actualMatches) == 1
        
        # AND expect the method to be hierarchical_fallback
        actualMatch, actualConfidence, actualMethod = actualMatches[0]
        assert actualMethod == "hierarchical_fallback"
    
    def test_should_return_multiple_matches_when_top_k_is_greater_than_one(self, matcher_with_test_data):
        """should return multiple matches when top_k parameter is greater than 1"""
        # GIVEN a matcher with test data
        givenMatcher = matcher_with_test_data
        
        # AND a KeSCO title
        givenKescoTitle = "Developer"
        givenIscoGroup = "2512"
        givenTopK = 2
        
        # WHEN hierarchical matching is performed with top_k=2
        actualMatches = givenMatcher.match_hierarchical(
            givenKescoTitle,
            givenIscoGroup,
            top_k=givenTopK
        )
        
        # THEN expect two matches to be returned
        assert len(actualMatches) == givenTopK
        
        # AND expect matches to be sorted by confidence (highest first)
        actualFirstConfidence = actualMatches[0][1]
        actualSecondConfidence = actualMatches[1][1]
        assert actualFirstConfidence >= actualSecondConfidence


# ============================================================================
# Test Suite: Match with Fallback
# ============================================================================

@describe("test match_with_fallback() method")
class TestMatchWithFallback:
    """Test the complete matching pipeline with exact, hierarchical, and fallback logic"""
    
    @pytest.fixture
    def matcher_with_full_pipeline(self):
        """Fixture providing a matcher with complete test data"""
        givenMatcher = HierarchicalSemanticMatcher()
        
        givenEscoLookup = {
            "software developer": {
                "_id": "esco_001",
                "preferred_label": "Software Developer",
                "code": "2512.1",
                "isco_group_code": "2512"
            },
            "accountant": {
                "_id": "esco_002",
                "preferred_label": "Accountant",
                "code": "2411.1", 
                "isco_group_code": "2411"
            }
        }
        
        givenEscoGroupLookup = {
            "2512": [givenEscoLookup["software developer"]],
            "2411": [givenEscoLookup["accountant"]]
        }
        
        givenMatcher.build_indices(givenEscoLookup, givenEscoGroupLookup)
        
        return givenMatcher, givenEscoLookup
    
    def test_should_return_exact_match_when_title_matches_perfectly(self, matcher_with_full_pipeline):
        """should return 100% confidence exact match when KeSCO title matches ESCO exactly"""
        # GIVEN a matcher and fuzzy lookup
        givenMatcher, givenFuzzyLookup = matcher_with_full_pipeline
        
        # AND a KeSCO title that exactly matches an ESCO occupation
        givenKescoTitle = "Software Developer"
        givenIscoGroup = "2512"
        
        # WHEN match_with_fallback is called
        actualMatch, actualConfidence, actualMethod = givenMatcher.match_with_fallback(
            givenKescoTitle,
            givenIscoGroup,
            givenFuzzyLookup
        )
        
        # THEN expect an exact match to be returned
        assert actualMatch is not None
        
        # AND expect 100% confidence
        assert actualConfidence == 100.0
        
        # AND expect method to be 'exact'
        assert actualMethod == "exact"
    
    def test_should_return_hierarchical_match_when_similarity_above_threshold(self, matcher_with_full_pipeline):
        """should return hierarchical match when semantic similarity is above threshold"""
        # GIVEN a matcher and fuzzy lookup
        givenMatcher, givenFuzzyLookup = matcher_with_full_pipeline
        
        # AND a KeSCO title similar to ESCO occupation
        givenKescoTitle = "Software Engineer"  # Similar to Software Developer
        givenIscoGroup = "2512"
        givenThreshold = 0.70
        
        # WHEN match_with_fallback is called
        actualMatch, actualConfidence, actualMethod = givenMatcher.match_with_fallback(
            givenKescoTitle,
            givenIscoGroup,
            givenFuzzyLookup,
            semantic_threshold=givenThreshold
        )
        
        # THEN expect a match to be returned
        assert actualMatch is not None
        
        # AND expect confidence to be between threshold and 100%
        assert 70.0 <= actualConfidence <= 100.0
        
        # AND expect method to contain 'hierarchical'
        assert "hierarchical" in actualMethod
    
    def test_should_return_no_match_when_similarity_below_threshold(self, matcher_with_full_pipeline):
        """should return no match when semantic similarity is below threshold"""
        # GIVEN a matcher and fuzzy lookup
        givenMatcher, givenFuzzyLookup = matcher_with_full_pipeline
        
        # AND a KeSCO title very different from ESCO occupations
        givenKescoTitle = "Plumber"  # Very different from Software/Accounting
        givenIscoGroup = "2512"
        givenThreshold = 0.70
        
        # WHEN match_with_fallback is called
        actualMatch, actualConfidence, actualMethod = givenMatcher.match_with_fallback(
            givenKescoTitle,
            givenIscoGroup,
            givenFuzzyLookup,
            semantic_threshold=givenThreshold
        )
        
        # THEN expect no match to be returned
        assert actualMatch is None
        
        # AND expect zero confidence
        assert actualConfidence == 0.0
        
        # AND expect method to be 'no_match'
        assert actualMethod == "no_match"
    
    def test_should_handle_case_insensitive_exact_matching(self, matcher_with_full_pipeline):
        """should match exactly regardless of case differences"""
        # GIVEN a matcher and fuzzy lookup
        givenMatcher, givenFuzzyLookup = matcher_with_full_pipeline
        
        # AND a KeSCO title with different casing
        givenKescoTitle = "SOFTWARE DEVELOPER"
        givenIscoGroup = "2512"
        
        # WHEN match_with_fallback is called
        actualMatch, actualConfidence, actualMethod = givenMatcher.match_with_fallback(
            givenKescoTitle,
            givenIscoGroup,
            givenFuzzyLookup
        )
        
        # THEN expect an exact match
        assert actualMatch is not None
        assert actualConfidence == 100.0
        assert actualMethod == "exact"


# ============================================================================
# Test Suite: Edge Cases and Error Handling
# ============================================================================

@describe("test edge cases and error handling")
class TestEdgeCases:
    """Test edge cases and error conditions"""
    
    def test_should_handle_empty_esco_lookup(self):
        """should handle empty ESCO lookup gracefully"""
        # GIVEN a matcher
        givenMatcher = HierarchicalSemanticMatcher()
        
        # AND empty ESCO data
        givenEmptyLookup = {}
        givenEmptyGroupLookup = {}
        
        # WHEN indices are built with empty data
        givenMatcher.build_indices(givenEmptyLookup, givenEmptyGroupLookup)
        
        # THEN expect empty indices
        assert len(givenMatcher.group_indices) == 0
        assert len(givenMatcher.all_titles) == 0
    
    def test_should_handle_occupation_without_isco_group_code(self):
        """should handle occupations without ISCO group codes"""
        # GIVEN a matcher
        givenMatcher = HierarchicalSemanticMatcher()
        
        # AND ESCO occupation without isco_group_code
        givenEscoLookup = {
            "custom occupation": {
                "_id": "esco_999",
                "preferred_label": "Custom Occupation",
                "isco_group_code": None
            }
        }
        givenEscoGroupLookup = {}
        
        # WHEN indices are built
        givenMatcher.build_indices(givenEscoLookup, givenEscoGroupLookup)
        
        # THEN expect occupation to still be in full catalog
        assert "Custom Occupation" in givenMatcher.all_titles
        
        # AND expect no group indices to be created
        assert len(givenMatcher.group_indices) == 0
    
    def test_should_handle_nonexistent_isco_group(self):
        """should fall back to full catalog when ISCO group doesn't exist"""
        # GIVEN a matcher with test data
        givenMatcher = HierarchicalSemanticMatcher()
        
        givenEscoLookup = {
            "software developer": {
                "_id": "esco_001",
                "preferred_label": "Software Developer",
                "isco_group_code": "2512"
            }
        }
        givenEscoGroupLookup = {
            "2512": [givenEscoLookup["software developer"]]
        }
        
        givenMatcher.build_indices(givenEscoLookup, givenEscoGroupLookup)
        
        # AND a KeSCO title with non-existent ISCO group
        givenKescoTitle = "Software Developer"
        givenNonexistentGroup = "9999"
        
        # WHEN hierarchical matching is performed
        actualMatches = givenMatcher.match_hierarchical(
            givenKescoTitle,
            givenNonexistentGroup,
            top_k=1
        )
        
        # THEN expect fallback to full catalog
        assert len(actualMatches) == 1
        actualMatch, actualConfidence, actualMethod = actualMatches[0]
        assert actualMethod == "hierarchical_fallback"
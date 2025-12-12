"""
BDD tests for KeSCOImporter

Tests the KeSCO occupation import process with hierarchical semantic contextualization
to ESCO occupations.
"""

import pytest
from unittest.mock import Mock, AsyncMock, MagicMock, patch
import pandas as pd
from bson import ObjectId

from app.taxonomy.importers.kesco_importer import KeSCOImporter
from app.taxonomy.models import DataSource


# ============================================================================
# Test Suite: ISCO Group Code Extraction
# ============================================================================

describe = pytest.mark.describe


@describe("test _extract_kesco_isco_group() method")
class TestExtractKescoIscoGroup:
    """Test extraction of 4-digit ISCO codes from KeSCO codes"""
    
    def test_should_extract_isco_code_from_standard_kesco_code(self):
        """should extract 4-digit ISCO code from standard KeSCO format"""
        # GIVEN a KeSCO importer
        givenDb = Mock()
        givenImporter = KeSCOImporter(givenDb)
        
        # AND a standard KeSCO code with dash separator
        givenKescoCode = "7314-33"
        
        # WHEN the ISCO group is extracted
        actualIscoGroup = givenImporter._extract_kesco_isco_group(givenKescoCode)
        
        # THEN expect the correct 4-digit ISCO code
        expectedIscoCode = "7314"
        assert actualIscoGroup == expectedIscoCode
    
    def test_should_extract_isco_code_from_various_formats(self):
        """should handle various KeSCO code formats"""
        # GIVEN a KeSCO importer
        givenDb = Mock()
        givenImporter = KeSCOImporter(givenDb)
        
        # AND various KeSCO code formats
        givenTestCases = [
            ("2411-11", "2411"),
            ("1211-14", "1211"),
            ("3433-11", "3433"),
            ("2120-14", "2120")
        ]
        
        # WHEN each code is processed
        # THEN expect correct ISCO extraction for all formats
        for givenKescoCode, expectedIscoCode in givenTestCases:
            actualIscoGroup = givenImporter._extract_kesco_isco_group(givenKescoCode)
            assert actualIscoGroup == expectedIscoCode
    
    def test_should_return_none_for_invalid_kesco_code(self):
        """should return None when KeSCO code is invalid"""
        # GIVEN a KeSCO importer
        givenDb = Mock()
        givenImporter = KeSCOImporter(givenDb)
        
        # AND invalid KeSCO codes
        givenInvalidCodes = [
            None,
            "",
            "ABC-123",
            "12-34",  # Too short
            "invalid"
        ]
        
        # WHEN each invalid code is processed
        # THEN expect None to be returned
        for givenInvalidCode in givenInvalidCodes:
            actualIscoGroup = givenImporter._extract_kesco_isco_group(givenInvalidCode)
            assert actualIscoGroup is None


# ============================================================================
# Test Suite: Hierarchical Matching Integration
# ============================================================================

@describe("test hierarchical_match_to_esco() method")
class TestHierarchicalMatchToEsco:
    """Test the integration of hierarchical matching in KeSCO import"""
    
    def test_should_return_exact_match_when_title_exists_in_lookup(self):
        """should return 100% confidence exact match when title is in ESCO lookup"""
        # GIVEN a KeSCO importer with ESCO lookup
        givenDb = Mock()
        givenEscoLookup = {
            "accountant": {
                "_id": ObjectId(),
                "preferred_label": "Accountant",
                "code": "2411.1",
                "isco_group_code": "2411"
            }
        }
        
        givenHierarchicalMatcher = Mock()
        givenImporter = KeSCOImporter(
            givenDb,
            esco_lookup=givenEscoLookup,
            hierarchical_matcher=givenHierarchicalMatcher
        )
        
        # AND a KeSCO title that exactly matches
        givenKescoTitle = "Accountant"
        givenIscoGroup = "2411"
        
        # WHEN hierarchical matching is performed
        actualMatch, actualConfidence, actualMethod = givenImporter.hierarchical_match_to_esco(
            givenKescoTitle,
            givenIscoGroup
        )
        
        # THEN expect exact match to be returned
        assert actualMatch is not None
        
        # AND expect 100% confidence
        assert actualConfidence == 100.0
        
        # AND expect 'exact' method
        assert actualMethod == "exact"
        
        # AND expect hierarchical matcher was not called
        givenHierarchicalMatcher.match_with_fallback.assert_not_called()
    
    def test_should_use_hierarchical_matcher_when_no_exact_match(self):
        """should use hierarchical semantic matcher when exact match not found"""
        # GIVEN a KeSCO importer with matcher
        givenDb = Mock()
        givenEscoLookup = {}
        
        givenExpectedMatch = {
            "_id": ObjectId(),
            "preferred_label": "Software Developer",
            "isco_group_code": "2512"
        }
        
        givenHierarchicalMatcher = Mock()
        givenHierarchicalMatcher.match_with_fallback.return_value = (
            givenExpectedMatch,
            75.5,
            "hierarchical_group_high_conf"
        )
        
        givenImporter = KeSCOImporter(
            givenDb,
            esco_lookup=givenEscoLookup,
            hierarchical_matcher=givenHierarchicalMatcher
        )
        
        # AND a KeSCO title without exact match
        givenKescoTitle = "Software Engineer"
        givenIscoGroup = "2512"
        
        # WHEN hierarchical matching is performed
        actualMatch, actualConfidence, actualMethod = givenImporter.hierarchical_match_to_esco(
            givenKescoTitle,
            givenIscoGroup
        )
        
        # THEN expect hierarchical matcher to be called
        givenHierarchicalMatcher.match_with_fallback.assert_called_once_with(
            givenKescoTitle,
            kesco_isco_group=givenIscoGroup,
            fuzzy_lookup=None,
            semantic_threshold=0.55
        )
        
        # AND expect match to be returned
        assert actualMatch == givenExpectedMatch
        assert actualConfidence == 75.5
        assert actualMethod == "hierarchical_group_high_conf"
    
    def test_should_handle_missing_hierarchical_matcher(self):
        """should handle gracefully when hierarchical matcher is not provided"""
        # GIVEN a KeSCO importer without hierarchical matcher
        givenDb = Mock()
        givenImporter = KeSCOImporter(
            givenDb,
            esco_lookup={},
            hierarchical_matcher=None
        )
        
        # AND a KeSCO title
        givenKescoTitle = "Software Developer"
        givenIscoGroup = "2512"
        
        # WHEN hierarchical matching is attempted
        actualMatch, actualConfidence, actualMethod = givenImporter.hierarchical_match_to_esco(
            givenKescoTitle,
            givenIscoGroup
        )
        
        # THEN expect no match to be returned
        assert actualMatch is None
        
        # AND expect zero confidence
        assert actualConfidence == 0.0
        
        # AND expect 'no_matcher' method
        assert actualMethod == "no_matcher"


# ============================================================================
# Test Suite: Occupation Model Creation
# ============================================================================

@describe("test _row_to_occupation_model() method")
class TestRowToOccupationModel:
    """Test conversion of Excel rows to OccupationModel with contextualization"""
    
    def test_should_create_occupation_model_with_high_confidence_auto_match(self):
        """should create occupation with auto-match when confidence >= 55%"""
        # GIVEN a KeSCO importer with mocked matching
        givenDb = Mock()
        givenEscoMatch = {
            "_id": ObjectId(),
            "preferred_label": "Software Developer",
            "code": "2512.1",
            "isco_group_code": "2512",
            "alt_labels": ["Developer", "Programmer"]
        }
        
        givenHierarchicalMatcher = Mock()
        givenHierarchicalMatcher.match_with_fallback.return_value = (
            givenEscoMatch,
            75.0,
            "hierarchical_group"
        )
        
        givenImporter = KeSCOImporter(
            givenDb,
            hierarchical_matcher=givenHierarchicalMatcher
        )
        
        # AND a KeSCO Excel row with high confidence match
        givenRow = pd.Series({
            "S/No": 1,
            "Occupational Title": "Software Engineer",
            "KeSCO Code": "2512-15"
        })
        
        # WHEN the row is converted to occupation model
        actualOccupation = givenImporter._row_to_occupation_model(givenRow)
        
        # THEN expect occupation to be created
        assert actualOccupation is not None
        
        # AND expect KeSCO fields to be set
        assert actualOccupation.preferred_label == "Software Engineer"
        assert actualOccupation.kesco_code == "2512-15"
        assert actualOccupation.isco_group_code == "2512"
        
        # AND expect auto-match fields to be set
        assert actualOccupation.mapped_to_esco_id == str(givenEscoMatch["_id"])
        assert actualOccupation.suggested_esco_id is None
        assert actualOccupation.mapping_confidence == 0.75
        assert actualOccupation.mapping_method == "hierarchical_group"
        
        # AND expect flags to be set correctly
        assert actualOccupation.requires_manual_review is False
        assert actualOccupation.requires_manual_skill_assignment is False
        assert actualOccupation.is_localized is True
        
        # AND expect source to be KeSCO
        assert actualOccupation.source == DataSource.KESCO
    
    def test_should_create_occupation_model_with_manual_review_needed(self):
        """should create occupation with suggested match when confidence 45-54%"""
        # GIVEN a KeSCO importer with medium confidence match
        givenDb = Mock()
        givenEscoMatch = {
            "_id": ObjectId(),
            "preferred_label": "Accountant",
            "code": "2411.1",
            "isco_group_code": "2411",
            "alt_labels": []
        }
        
        givenHierarchicalMatcher = Mock()
        givenHierarchicalMatcher.match_with_fallback.return_value = (
            givenEscoMatch,
            50.0,  # Medium confidence
            "hierarchical_fallback"
        )
        
        givenImporter = KeSCOImporter(
            givenDb,
            hierarchical_matcher=givenHierarchicalMatcher
        )
        
        # AND a KeSCO Excel row
        givenRow = pd.Series({
            "S/No": 2,
            "Occupational Title": "Financial Controller",
            "KeSCO Code": "2411-15"
        })
        
        # WHEN the row is converted
        actualOccupation = givenImporter._row_to_occupation_model(givenRow)
        
        # THEN expect suggested match instead of auto-match
        assert actualOccupation.mapped_to_esco_id is None
        assert actualOccupation.suggested_esco_id == str(givenEscoMatch["_id"])
        assert actualOccupation.mapping_confidence == 0.50
        
        # AND expect manual review flag to be set
        assert actualOccupation.requires_manual_review is True
        assert actualOccupation.requires_manual_skill_assignment is False
        assert actualOccupation.is_localized is False
    
    def test_should_create_occupation_model_with_no_match(self):
        """should create occupation requiring manual skill assignment when confidence < 45%"""
        # GIVEN a KeSCO importer with no good match
        givenDb = Mock()
        
        givenHierarchicalMatcher = Mock()
        givenHierarchicalMatcher.match_with_fallback.return_value = (
            None,  # No match
            0.0,
            "no_match"
        )
        
        givenImporter = KeSCOImporter(
            givenDb,
            hierarchical_matcher=givenHierarchicalMatcher
        )
        
        # AND a KeSCO Excel row without good match
        givenRow = pd.Series({
            "S/No": 3,
            "Occupational Title": "Traditional Healer",
            "KeSCO Code": "3230-99"
        })
        
        # WHEN the row is converted
        actualOccupation = givenImporter._row_to_occupation_model(givenRow)
        
        # THEN expect no ESCO mapping
        assert actualOccupation.mapped_to_esco_id is None
        assert actualOccupation.suggested_esco_id is None
        assert actualOccupation.mapping_confidence is None
        
        # AND expect manual skill assignment flag
        assert actualOccupation.requires_manual_review is False
        assert actualOccupation.requires_manual_skill_assignment is True
        assert actualOccupation.is_localized is False
    
    def test_should_copy_alt_labels_from_esco_match(self):
        """should copy alternative labels from matched ESCO occupation"""
        # GIVEN a KeSCO importer
        givenDb = Mock()
        givenEscoMatch = {
            "_id": ObjectId(),
            "preferred_label": "Software Developer",
            "code": "2512.1",
            "isco_group_code": "2512",
            "alt_labels": [
                "Developer",
                "Programmer",
                "Software Engineer",  # Same as KeSCO title
                "Coder"
            ]
        }
        
        givenHierarchicalMatcher = Mock()
        givenHierarchicalMatcher.match_with_fallback.return_value = (
            givenEscoMatch,
            80.0,
            "hierarchical_group"
        )
        
        givenImporter = KeSCOImporter(
            givenDb,
            hierarchical_matcher=givenHierarchicalMatcher
        )
        
        # AND a KeSCO row with title matching one of the alt labels
        givenRow = pd.Series({
            "S/No": 4,
            "Occupational Title": "Software Engineer",
            "KeSCO Code": "2512-20"
        })
        
        # WHEN the row is converted
        actualOccupation = givenImporter._row_to_occupation_model(givenRow)
        
        # THEN expect alt labels to be copied (excluding KeSCO title itself)
        assert len(actualOccupation.alt_labels) == 3
        assert "Developer" in actualOccupation.alt_labels
        assert "Programmer" in actualOccupation.alt_labels
        assert "Coder" in actualOccupation.alt_labels
        
        # AND expect KeSCO title to be excluded from alt labels
        assert "Software Engineer" not in actualOccupation.alt_labels


# ============================================================================
# Test Suite: Import Statistics Tracking
# ============================================================================

@describe("test import statistics tracking")
class TestImportStatistics:
    """Test that import statistics are tracked correctly"""
    
    @pytest.mark.asyncio
    async def test_should_track_auto_match_statistics(self):
        """should increment auto_matched counter when confidence >= 55%"""
        # GIVEN a KeSCO importer with high confidence matches
        givenDb = MagicMock()
        givenCollection = AsyncMock()
        givenDb.__getitem__.return_value = givenCollection
        
        givenEscoMatch = {
            "_id": ObjectId(),
            "preferred_label": "Accountant",
            "code": "2411.1",
            "isco_group_code": "2411",
            "alt_labels": []
        }
        
        givenHierarchicalMatcher = Mock()
        givenHierarchicalMatcher.match_with_fallback.return_value = (
            givenEscoMatch,
            75.0,  # High confidence
            "hierarchical_group"
        )
        
        # AND mock Excel data with one occupation
        with patch('pandas.read_excel') as mock_read_excel:
            givenDf = pd.DataFrame([{
                "S/No": 1,
                "Occupational Title": "Accountant",
                "KeSCO Code": "2411-11"
            }])
            mock_read_excel.return_value = givenDf
            
            givenCollection.insert_many = AsyncMock(return_value=Mock(inserted_ids=[ObjectId()]))
            
            givenImporter = KeSCOImporter(
                givenDb,
                hierarchical_matcher=givenHierarchicalMatcher
            )
            
            # WHEN import is performed
            actualStats = await givenImporter.import_occupations()
            
            # THEN expect auto_matched to be incremented
            assert actualStats['auto_matched'] == 1
            assert actualStats['manual_review'] == 0
            assert actualStats['no_match'] == 0
    
    @pytest.mark.asyncio
    async def test_should_track_manual_review_statistics(self):
        """should increment manual_review counter when confidence 45-54%"""
        # GIVEN a KeSCO importer with medium confidence match
        givenDb = MagicMock()
        givenCollection = AsyncMock()
        givenDb.__getitem__.return_value = givenCollection
        
        givenEscoMatch = {
            "_id": ObjectId(),
            "preferred_label": "Manager",
            "code": "1211.1",
            "isco_group_code": "1211",
            "alt_labels": []
        }
        
        givenHierarchicalMatcher = Mock()
        givenHierarchicalMatcher.match_with_fallback.return_value = (
            givenEscoMatch,
            50.0,  # Medium confidence
            "hierarchical_fallback"
        )
        
        # AND mock Excel data
        with patch('pandas.read_excel') as mock_read_excel:
            givenDf = pd.DataFrame([{
                "S/No": 1,
                "Occupational Title": "Supervisor",
                "KeSCO Code": "1211-99"
            }])
            mock_read_excel.return_value = givenDf
            
            givenCollection.insert_many = AsyncMock(return_value=Mock(inserted_ids=[ObjectId()]))
            
            givenImporter = KeSCOImporter(
                givenDb,
                hierarchical_matcher=givenHierarchicalMatcher
            )
            
            # WHEN import is performed
            actualStats = await givenImporter.import_occupations()
            
            # THEN expect manual_review to be incremented
            assert actualStats['auto_matched'] == 0
            assert actualStats['manual_review'] == 1
            assert actualStats['no_match'] == 0
    

    @pytest.mark.asyncio
    async def test_should_track_matching_method_breakdown(self):
        """should track exact, hierarchical_group, and hierarchical_fallback methods separately"""
        # GIVEN a KeSCO importer
        givenDb = MagicMock()
        givenCollection = AsyncMock()
        givenDb.__getitem__.return_value = givenCollection
        
        givenEscoLookup = {
            "accountant": {
                "_id": ObjectId(),
                "preferred_label": "Accountant",
                "alt_labels": []
            }
        }
        
        givenHierarchicalMatcher = Mock()
        
        # AND mock Excel with 2 occupations
        with patch('pandas.read_excel') as mock_read_excel:
            givenDf = pd.DataFrame([
                {"S/No": 1, "Occupational Title": "Accountant", "KeSCO Code": "2411-11"},
                {"S/No": 2, "Occupational Title": "Bookkeeper", "KeSCO Code": "2411-12"}
            ])
            mock_read_excel.return_value = givenDf
            
            # Configure matcher to return hierarchical match for Bookkeeper (not in lookup)
            givenHierarchicalMatcher.match_with_fallback.return_value = (
                givenEscoLookup["accountant"], 
                70.0, 
                "hierarchical_group"
            )
            
            givenCollection.insert_many = AsyncMock(return_value=Mock(inserted_ids=[ObjectId(), ObjectId()]))
            
            givenImporter = KeSCOImporter(
                givenDb,
                esco_lookup=givenEscoLookup,
                hierarchical_matcher=givenHierarchicalMatcher
            )
            
            # WHEN import is performed
            actualStats = await givenImporter.import_occupations()
            
            # THEN expect method breakdown to be tracked
            assert actualStats['exact_matches'] == 1  # Accountant exact match
            assert actualStats['hierarchical_group_matches'] == 1  # Bookkeeper hierarchical

# ============================================================================
# Test Suite: CSV Export
# ============================================================================

@describe("test export_matches_to_csv() method")
class TestExportMatchesToCsv:
    """Test exporting match results to CSV for manual review"""
    
    def test_should_export_matches_to_csv_file(self):
        """should export all matches with details to CSV file"""
        # GIVEN a KeSCO importer with match results
        givenDb = Mock()
        givenImporter = KeSCOImporter(givenDb)
        
        # AND some match results stored
        givenImporter.matches = [
            {
                'kesco_code': '2411-11',
                'kesco_isco_group': '2411',
                'kesco_title': 'Accountant',
                'esco_title': 'Accountant',
                'esco_code': '2411.1',
                'esco_isco_group': '2411',
                'confidence': 100.0,
                'method': 'exact'
            },
            {
                'kesco_code': '2512-15',
                'kesco_isco_group': '2512',
                'kesco_title': 'Software Engineer',
                'esco_title': 'Software Developer',
                'esco_code': '2512.1',
                'esco_isco_group': '2512',
                'confidence': 75.5,
                'method': 'hierarchical_group'
            }
        ]
        
        # AND a temporary output path
        givenOutputPath = "/tmp/test_matches.csv"
        
        # WHEN matches are exported to CSV
        with patch('pandas.DataFrame.to_csv') as mock_to_csv:
            givenImporter.export_matches_to_csv(givenOutputPath)
            
            # THEN expect CSV to be created
            mock_to_csv.assert_called_once_with(givenOutputPath, index=False)
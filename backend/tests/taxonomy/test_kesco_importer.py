# tests/taxonomy/test_kesco_importer.py
"""
Test KeSCO importer with inline contextualization
"""
import pytest
from app.taxonomy.importers.kesco_importer import KeSCOImporter


@pytest.mark.asyncio
class TestKeSCOImporter:
    """Test KeSCO importer with fuzzy matching"""
    
    def test_fuzzy_match_exact(self):
        """Test exact match returns 100% confidence"""
        esco_lookup = {
            "software developer": {
                "_id": "507f1f77bcf86cd799439011",
                "preferred_label": "Software Developer",
                "code": "2512"
            }
        }
        
        importer = KeSCOImporter(None, esco_lookup=esco_lookup)
        
        match, confidence, method = importer.fuzzy_match_to_esco("Software Developer")
        
        assert match is not None
        assert confidence == 100.0
        assert method == "exact"
        assert match["code"] == "2512"
    
    def test_fuzzy_match_close(self):
        """Test close match returns high confidence"""
        esco_lookup = {
            "software developer": {
                "_id": "507f1f77bcf86cd799439011",
                "preferred_label": "Software Developer",
                "code": "2512"
            }
        }
        
        importer = KeSCOImporter(None, esco_lookup=esco_lookup)
        
        match, confidence, method = importer.fuzzy_match_to_esco("Software Development Engineer")
        
        assert match is not None
        assert confidence >= 80.0
        assert "fuzzy" in method
    
    def test_fuzzy_match_no_match(self):
        """Test no match for completely different title"""
        esco_lookup = {
            "software developer": {
                "_id": "507f1f77bcf86cd799439011",
                "preferred_label": "Software Developer",
                "code": "2512"
            }
        }
        
        importer = KeSCOImporter(None, esco_lookup=esco_lookup)
        
        match, confidence, method = importer.fuzzy_match_to_esco("Medical Doctor")
        
        # Should still return something but with low confidence
        assert confidence < 70.0 or match is None
    
    def test_row_to_occupation_model_auto_match(self, sample_kesco_occupation_row):
        """Test KeSCO row conversion with auto-match"""
        esco_lookup = {
            "software developer": {
                "_id": "507f1f77bcf86cd799439011",
                "preferred_label": "Software Developer",
                "code": "2512"
            }
        }
        
        importer = KeSCOImporter(None, esco_lookup=esco_lookup)
        
        occupation = importer._row_to_occupation_model(sample_kesco_occupation_row)
        
        assert occupation.kesco_code == "2512-01"
        assert occupation.preferred_label == "Software Developer"
        assert occupation.mapped_to_esco_id is not None  # Should be auto-matched
        assert occupation.mapping_confidence == 1.0
        assert occupation.is_localized is True
    
    def test_contextualization_thresholds(self):
        """Test contextualization confidence thresholds"""
        esco_lookup = {
            "software developer": {
                "_id": "507f1f77bcf86cd799439011",
                "preferred_label": "Software Developer",
                "code": "2512"
            }
        }
        
        importer = KeSCOImporter(None, esco_lookup=esco_lookup)
        
        # Test auto-match (>=85%)
        import pandas as pd
        row_high = pd.Series({
            'S/No': 1,
            'KeSCO Code': '2512-01',
            'Occupational Title': 'Software Developer'
        })
        occ_high = importer._row_to_occupation_model(row_high)
        assert occ_high.mapped_to_esco_id is not None
        assert occ_high.requires_manual_review is False
        
        # We can't easily test 70-84% without more complex setup,
        # but the logic is there in the importer
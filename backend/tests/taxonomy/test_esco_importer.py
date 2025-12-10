# tests/taxonomy/test_esco_importer.py
"""
Test ESCO importers
"""
import pytest
from app.taxonomy.importers.esco_occupations_importer import ESCOOccupationsImporter
from app.taxonomy.models import DataSource, OccupationType


@pytest.mark.asyncio
class TestESCOOccupationsImporter:
    """Test ESCO occupations importer"""
    
    def test_parse_alt_labels(self):
        """Test parsing alternative labels"""
        importer = ESCOOccupationsImporter(None)
        
        # Test with newline-separated string
        result = importer._parse_alt_labels("Label1\nLabel2\nLabel3")
        assert len(result) == 3
        assert "Label1" in result
        
        # Test with empty string
        result = importer._parse_alt_labels("")
        assert result == []
        
        # Test with None
        result = importer._parse_alt_labels(None)
        assert result == []
    
    def test_extract_code_from_uri(self):
        """Test extracting code from ESCO URI"""
        importer = ESCOOccupationsImporter(None)
        
        uri = "http://data.europa.eu/esco/occupation/abc123"
        code = importer._extract_code_from_uri(uri)
        
        assert code == "abc123"
    
    def test_row_to_occupation_model(self, sample_esco_occupation_row):
        """Test converting CSV row to OccupationModel"""
        importer = ESCOOccupationsImporter(None)
        
        occupation = importer._row_to_occupation_model(sample_esco_occupation_row)
        
        assert occupation.preferred_label == "Software Developer"
        assert occupation.source == DataSource.ESCO
        assert occupation.occupation_type == OccupationType.ESCO_OCCUPATION
        assert len(occupation.alt_labels) == 3
        assert "Programmer" in occupation.alt_labels
    
    async def test_build_esco_lookup(self, test_db):
        """Test building ESCO lookup dictionary"""
        # Insert test occupations
        await test_db.occupations.insert_many([
            {
                "source": "ESCO",
                "preferred_label": "Software Developer",
                "alt_labels": ["Programmer", "Coder"],
                "code": "2512"
            },
            {
                "source": "ESCO",
                "preferred_label": "Data Scientist",
                "alt_labels": ["Data Analyst"],
                "code": "2513"
            }
        ])
        
        importer = ESCOOccupationsImporter(test_db)
        lookup = await importer.build_esco_lookup()
        
        # Should have 5 entries: 2 preferred + 3 alt labels
        assert len(lookup) >= 5
        assert "software developer" in lookup
        assert "programmer" in lookup
        assert "data scientist" in lookup


@pytest.mark.asyncio
class TestESCOSkillsImporter:
    """Test ESCO skills importer"""
    
    def test_parse_skill_type(self):
        """Test parsing skill type"""
        from app.taxonomy.importers.esco_skills_importer import ESCOSkillsImporter
        from app.taxonomy.models import SkillType
        
        importer = ESCOSkillsImporter(None)
        
        assert importer._parse_skill_type("knowledge") == SkillType.KNOWLEDGE
        assert importer._parse_skill_type("language") == SkillType.LANGUAGE
        assert importer._parse_skill_type("skill/competence") == SkillType.SKILL_COMPETENCE
    
    def test_parse_reuse_level(self):
        """Test parsing reuse level"""
        from app.taxonomy.importers.esco_skills_importer import ESCOSkillsImporter
        from app.taxonomy.models import SkillReuseLevel
        
        importer = ESCOSkillsImporter(None)
        
        assert importer._parse_reuse_level("cross-sectoral") == SkillReuseLevel.CROSS_SECTORAL
        assert importer._parse_reuse_level("sector-specific") == SkillReuseLevel.SECTOR_SPECIFIC
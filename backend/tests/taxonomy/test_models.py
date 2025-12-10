# tests/taxonomy/test_models.py
"""
Test Pydantic models for taxonomy database
"""

from app.taxonomy.models import (
    OccupationModel,
    SkillModel,
    OccupationSkillRelationModel,
    DataSource,
    OccupationType,
    SkillType,
    SkillReuseLevel,
    RelationType
)


class TestOccupationModel:
    """Test OccupationModel validation and fields"""
    
    def test_create_esco_occupation(self):
        """Test creating an ESCO occupation"""
        occ = OccupationModel(
            code="2512",
            preferred_label="Software Developer",
            alt_labels=["Programmer", "Coder"],
            esco_uri="http://data.europa.eu/esco/occupation/123",
            occupation_type=OccupationType.ESCO_OCCUPATION,
            source=DataSource.ESCO,
            taxonomy_model_id="507f1f77bcf86cd799439011",
            is_relevant_for_kenya=True
        )
        
        assert occ.code == "2512"
        assert occ.preferred_label == "Software Developer"
        assert len(occ.alt_labels) == 2
        assert occ.source == DataSource.ESCO
        assert occ.is_relevant_for_kenya is True
    
    def test_create_kesco_occupation(self):
        """Test creating a KeSCO occupation"""
        occ = OccupationModel(
            code="2512-01",
            preferred_label="Software Developer",
            kesco_code="2512-01",
            kesco_serial_number=100,
            occupation_type=OccupationType.LOCAL_OCCUPATION,
            source=DataSource.KESCO,
            taxonomy_model_id="507f1f77bcf86cd799439011",
            is_relevant_for_kenya=True
        )
        
        assert occ.kesco_code == "2512-01"
        assert occ.kesco_serial_number == 100
        assert occ.source == DataSource.KESCO
    
    def test_contextualization_fields(self):
        """Test contextualization fields for KeSCO occupation"""
        occ = OccupationModel(
            code="2512-01",
            preferred_label="Software Developer",
            occupation_type=OccupationType.LOCAL_OCCUPATION,
            source=DataSource.KESCO,
            taxonomy_model_id="507f1f77bcf86cd799439011",
            mapped_to_esco_id="507f1f77bcf86cd799439022",
            mapping_confidence=0.95,
            mapping_method="fuzzy_token_sort",
            requires_manual_review=False,
            is_localized=True
        )
        
        assert occ.mapped_to_esco_id == "507f1f77bcf86cd799439022"
        assert occ.mapping_confidence == 0.95
        assert occ.mapping_method == "fuzzy_token_sort"
        assert occ.is_localized is True
    
    def test_manual_review_flag(self):
        """Test manual review flag for medium confidence match"""
        occ = OccupationModel(
            code="2512-01",
            preferred_label="Software Developer",
            occupation_type=OccupationType.LOCAL_OCCUPATION,
            source=DataSource.KESCO,
            taxonomy_model_id="507f1f77bcf86cd799439011",
            suggested_esco_id="507f1f77bcf86cd799439022",
            mapping_confidence=0.75,
            requires_manual_review=True
        )
        
        assert occ.suggested_esco_id is not None
        assert occ.requires_manual_review is True
        assert occ.mapped_to_esco_id is None


class TestSkillModel:
    """Test SkillModel validation"""
    
    def test_create_skill(self):
        """Test creating a skill"""
        skill = SkillModel(
            esco_uri="http://data.europa.eu/esco/skill/123",
            preferred_label="Python programming",
            alt_labels=["Python coding"],
            skill_type=SkillType.SKILL_COMPETENCE,
            reuse_level=SkillReuseLevel.CROSS_SECTORAL,
            taxonomy_model_id="507f1f77bcf86cd799439011",
            is_relevant_for_kenya=True
        )
        
        assert skill.preferred_label == "Python programming"
        assert skill.skill_type == SkillType.SKILL_COMPETENCE
        assert skill.reuse_level == SkillReuseLevel.CROSS_SECTORAL


class TestOccupationSkillRelationModel:
    """Test OccupationSkillRelationModel"""
    
    def test_create_relation(self):
        """Test creating occupation-skill relation"""
        relation = OccupationSkillRelationModel(
            occupation_id="507f1f77bcf86cd799439011",
            skill_id="507f1f77bcf86cd799439022",
            relation_type=RelationType.ESSENTIAL,
            signalling_value=0.8
        )
        
        assert relation.occupation_id == "507f1f77bcf86cd799439011"
        assert relation.skill_id == "507f1f77bcf86cd799439022"
        assert relation.relation_type == RelationType.ESSENTIAL
    
    def test_inherited_relation(self):
        """Test inherited skill relation"""
        relation = OccupationSkillRelationModel(
            occupation_id="507f1f77bcf86cd799439011",
            skill_id="507f1f77bcf86cd799439022",
            relation_type=RelationType.ESSENTIAL,
            inherited_from_esco_id="507f1f77bcf86cd799439033",
            source=DataSource.ESCO
        )
        
        assert relation.inherited_from_esco_id == "507f1f77bcf86cd799439033"
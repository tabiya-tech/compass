# tests/taxonomy/test_integration.py
"""
Integration tests for complete taxonomy import pipeline
"""
import pytest
from app.taxonomy.importers.inherit_skills import inherit_skills_for_matched_kesco


@pytest.mark.asyncio
class TestTaxonomyIntegration:
    """Test end-to-end taxonomy import and contextualization"""
    
    async def test_skill_inheritance(self, test_db):
        """Test that skills are inherited from ESCO to KeSCO"""
        # Insert ESCO occupation
        esco_id = "507f1f77bcf86cd799439011"
        await test_db.occupations.insert_one({
            "_id": esco_id,
            "source": "ESCO",
            "code": "2512",
            "preferred_label": "Software Developer"
        })
        
        # Insert skill
        skill_id = "507f1f77bcf86cd799439022"
        await test_db.skills.insert_one({
            "_id": skill_id,
            "esco_uri": "http://esco/skill/123",
            "preferred_label": "Python programming"
        })
        
        # Insert ESCO skill relation
        await test_db.occupation_skill_relations.insert_one({
            "occupation_id": esco_id,
            "skill_id": skill_id,
            "relation_type": "essential",
            "source": "ESCO"
        })
        
        # Insert matched KeSCO occupation
        kesco_id = "507f1f77bcf86cd799439033"
        await test_db.occupations.insert_one({
            "_id": kesco_id,
            "source": "KeSCO",
            "kesco_code": "2512-01",
            "preferred_label": "Software Developer",
            "mapped_to_esco_id": esco_id,
            "mapping_confidence": 1.0
        })
        
        # Run skill inheritance
        stats = await inherit_skills_for_matched_kesco(test_db)
        
        # Check that skills were inherited
        assert stats['total_matched'] == 1
        assert stats['occupations_with_skills'] == 1
        assert stats['total_skills_inherited'] >= 1
        
        # Verify inherited relation exists
        inherited = await test_db.occupation_skill_relations.find_one({
            "occupation_id": kesco_id,
            "source": "inherited_from_esco"
        })
        
        assert inherited is not None
        assert inherited["skill_id"] == skill_id
        assert inherited["inherited_from_esco_id"] == esco_id
    
    async def test_full_pipeline_simulation(self, test_db):
        """Simulate full import pipeline"""
        # 1. Insert ESCO occupations (simulated)
        esco_ids = []
        for i in range(3):
            result = await test_db.occupations.insert_one({
                "source": "ESCO",
                "code": f"251{i}",
                "preferred_label": f"ESCO Occupation {i}"
            })
            esco_ids.append(str(result.inserted_id))
        
        # 2. Insert skills (simulated)
        skill_ids = []
        for i in range(5):
            result = await test_db.skills.insert_one({
                "esco_uri": f"http://esco/skill/{i}",
                "preferred_label": f"Skill {i}"
            })
            skill_ids.append(str(result.inserted_id))
        
        # 3. Insert ESCO relations (simulated)
        for esco_id in esco_ids:
            for skill_id in skill_ids[:2]:  # 2 skills per occupation
                await test_db.occupation_skill_relations.insert_one({
                    "occupation_id": esco_id,
                    "skill_id": skill_id,
                    "relation_type": "essential",
                    "source": "ESCO"
                })
        
        # 4. Insert KeSCO occupations with contextualization (simulated)
        kesco_ids = []
        for i, esco_id in enumerate(esco_ids):
            result = await test_db.occupations.insert_one({
                "source": "KeSCO",
                "kesco_code": f"251{i}-01",
                "preferred_label": f"KeSCO Occupation {i}",
                "mapped_to_esco_id": esco_id,
                "mapping_confidence": 0.9
            })
            kesco_ids.append(str(result.inserted_id))
        
        # 5. Run skill inheritance
        stats = await inherit_skills_for_matched_kesco(test_db)
        
        # Verify results
        assert stats['total_matched'] == 3
        assert stats['occupations_with_skills'] == 3
        assert stats['total_skills_inherited'] == 6  # 3 occupations × 2 skills
        
        # Verify database state
        total_occupations = await test_db.occupations.count_documents({})
        assert total_occupations == 6  # 3 ESCO + 3 KeSCO
        
        total_skills = await test_db.skills.count_documents({})
        assert total_skills == 5
        
        total_relations = await test_db.occupation_skill_relations.count_documents({})
        assert total_relations == 12  # 6 ESCO + 6 inherited
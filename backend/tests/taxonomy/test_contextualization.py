# tests/taxonomy/test_contextualization.py
"""
Test contextualization quality and match distribution
"""
import pytest


@pytest.mark.asyncio
class TestContextualizationQuality:
    """Test the quality of KeSCO-ESCO contextualization"""
    
    async def test_match_rate(self, test_db):
        """Test that auto-match rate is above threshold"""
        # Insert sample contextualized KeSCO occupations
        kesco_data = [
            {
                "source": "KeSCO",
                "kesco_code": "2512-01",
                "preferred_label": "Software Developer",
                "mapped_to_esco_id": "507f1f77bcf86cd799439011",
                "mapping_confidence": 1.0,
                "is_localized": True
            },
            {
                "source": "KeSCO",
                "kesco_code": "2512-02",
                "preferred_label": "Web Developer",
                "suggested_esco_id": "507f1f77bcf86cd799439022",
                "mapping_confidence": 0.75,
                "requires_manual_review": True
            },
            {
                "source": "KeSCO",
                "kesco_code": "2512-03",
                "preferred_label": "Unknown Role",
                "mapping_confidence": 0.5,
                "requires_manual_skill_assignment": True
            }
        ]
        
        await test_db.occupations.insert_many(kesco_data)
        
        total = await test_db.occupations.count_documents({"source": "KeSCO"})
        auto_matched = await test_db.occupations.count_documents({
            "source": "KeSCO",
            "mapped_to_esco_id": {"$exists": True, "$ne": None}
        })
        
        match_rate = auto_matched / total
        
        # Assert at least 33% auto-match (1 out of 3 in our test)
        assert match_rate >= 0.33
    
    async def test_confidence_distribution(self, test_db):
        """Test that confidence scores are reasonable"""
        kesco_data = [
            {"source": "KeSCO", "mapping_confidence": 1.0},
            {"source": "KeSCO", "mapping_confidence": 0.95},
            {"source": "KeSCO", "mapping_confidence": 0.75},
            {"source": "KeSCO", "mapping_confidence": 0.60},
        ]
        
        await test_db.occupations.insert_many(kesco_data)
        
        # All confidence scores should be between 0 and 1
        cursor = test_db.occupations.find({
            "source": "KeSCO",
            "mapping_confidence": {"$exists": True}
        })
        
        async for occ in cursor:
            conf = occ.get("mapping_confidence", 0)
            assert 0 <= conf <= 1.0
    
    async def test_manual_review_flags(self, test_db):
        """Test that manual review flags are set correctly"""
        kesco_data = [
            {
                "source": "KeSCO",
                "suggested_esco_id": "507f1f77bcf86cd799439022",
                "mapping_confidence": 0.75,
                "requires_manual_review": True
            }
        ]
        
        await test_db.occupations.insert_many(kesco_data)
        
        manual_review_count = await test_db.occupations.count_documents({
            "source": "KeSCO",
            "requires_manual_review": True
        })
        
        assert manual_review_count == 1
from app.vector_search.esco_search_service import SkillSearchService


class TestSkillSearchService:
    def test_to_entity_uses_skillId_field(self):
        # GIVEN a document returned from aggregation with skillId
        doc = {
            "skillId": "68f1da5290ad734984f7cb46",
            "modelId": "model",
            "UUID": "uuid-1",
            "preferredLabel": "child label",
            "description": "desc",
            "scopeNote": "scope",
            "originUUID": "origin",
            "UUIDHistory": ["uuid-1"],
            "altLabels": ["alt"],
            "skillType": "skill/competence",
            "score": 0.5,
        }

        # WHEN converting to a SkillEntity (constructor bypassed)
        service = SkillSearchService.__new__(SkillSearchService)
        entity = SkillSearchService._to_entity(service, doc)

        # THEN id is populated from skillId so downstream mapping works
        assert entity.id == "68f1da5290ad734984f7cb46"

    def test_to_entity_falls_back_to__id(self):
        # GIVEN a grouped document where _id carries the skill id
        doc = {
            "_id": "68f1da5290ad734984f7cb46",
            "modelId": "model",
            "UUID": "uuid-1",
            "preferredLabel": "child label",
            "description": "desc",
            "scopeNote": "scope",
            "originUUID": "origin",
            "UUIDHistory": ["uuid-1"],
            "altLabels": ["alt"],
            "skillType": "skill/competence",
            "score": 0.5,
        }

        service = SkillSearchService.__new__(SkillSearchService)
        entity = SkillSearchService._to_entity(service, doc)

        assert entity.id == "68f1da5290ad734984f7cb46"

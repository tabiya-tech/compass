from app.agent.linking_and_ranking_pipeline.relevant_entities_classifier_llm import RelevantEntitiesClassifierLLM, RelevantEntityClassifierOutput
from app.vector_search.esco_entities import OccupationEntity


class _RelevantOccupationsClassifierLLM(RelevantEntitiesClassifierLLM[OccupationEntity]):
    def __init__(self):
        super().__init__(entity_type='occupation')

    async def execute(
            self,
            *,
            experience_title: str,
            contextual_title: str,
            responsibilities: list[str],
            occupations: list[OccupationEntity],
            top_k: int = 5
    ) -> RelevantEntityClassifierOutput[OccupationEntity]:
        """
        Given
        - an experience_title,
        - a contextual_title,
        - a list of responsibilities,
        - and a list of occupations
        classify the occupations in:
        - top_k most relevant occupations
        - remaining occupations
        """
        return await super().execute(
            experience_title=experience_title,
            contextual_title=contextual_title,
            responsibilities=responsibilities,
            entities_to_classify=occupations,
            top_k=top_k
        )

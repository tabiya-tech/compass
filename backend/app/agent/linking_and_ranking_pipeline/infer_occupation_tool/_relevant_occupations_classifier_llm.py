from app.agent.linking_and_ranking_pipeline.relevant_entities_classifier_llm import RelevantEntitiesClassifierLLM, RelevantEntityClassifierOutput
from app.vector_search.esco_entities import OccupationEntity


class _RelevantOccupationsClassifierLLM(RelevantEntitiesClassifierLLM[OccupationEntity]):
    def __init__(self):
        super().__init__(entity_type='occupation')

    async def execute(
            self,
            *,
            job_titles: list[str],
            responsibilities: list[str],
            occupations: list[OccupationEntity],
            top_k: int = 5
    ) -> RelevantEntityClassifierOutput[OccupationEntity]:
        """
        Given
        - a list of job titles,
        - a list of responsibilities,
        - and a list of occupations
        classify the occupations in:
        - top_k most relevant occupations
        - remaining occupations
        """
        return await super().execute(
            job_titles=job_titles,
            responsibilities=responsibilities,
            entities_to_classify=occupations,
            top_k=top_k
        )

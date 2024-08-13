from app.agent.linking_and_ranking_pipeline.relevant_entities_classifier_llm import RelevantEntitiesClassifierLLM, RelevantEntityClassifierOutput
from app.vector_search.esco_entities import SkillEntity


class _RelevantSkillsClassifierLLM(RelevantEntitiesClassifierLLM[SkillEntity]):
    def __init__(self):
        super().__init__(entity_type='skill')

    async def execute(
            self,
            *,
            job_titles: list[str],
            responsibilities: list[str],
            skills: list[SkillEntity],
            top_k: int = 5
    ) -> RelevantEntityClassifierOutput[SkillEntity]:
        """
        Given
        - a list of job titles,
        - a list of responsibilities,
        - and a list of skills
        classify the skills in:
        - top_k most relevant skills
        - remaining skills
        """
        return await super().execute(
            job_titles=job_titles,
            responsibilities=responsibilities,
            entities_to_classify=skills,
            top_k=top_k
        )

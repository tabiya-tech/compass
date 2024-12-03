import logging

from app.agent.experience.work_type import WorkType
from app.countries import Country
from backend.app.agent.linking_and_ranking_pipeline.infer_occupation_tool.infer_occupation_tool import InferOccupationTool, InferOccupationToolOutput

from ._icatus_classification_llm import _IcatusClassificationLLM
from ..infer_occupation_tool._contextualization_llm import _ContextualizationLLM
from .utils import IcatusTerminalNode
from app.vector_search.esco_search_service import OccupationSkillSearchService




class InferIcatusActivitiesTool:

    def __init__(
            self,
            occupation_skill_search_service: OccupationSkillSearchService,
    ):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._occupation_skill_search_service = occupation_skill_search_service
        self._infer_occupations_tool = InferOccupationTool(self._occupation_skill_search_service)
        self.classification_level = 0

    async def find_occupations(self, nodes: list[IcatusTerminalNode]):
        occupation_data = await [self._occupation_skill_search_service.get_by_esco_code(
                    node.code
                ) for node in nodes]
        return occupation_data
    
    def find_terminal_icatus_nodes(self, classification_response):
        if self.classification_level == 0 and classification_response.value: # Volunteering
            return [node for node in IcatusTerminalNode if node.value.startswith("I5")]
        elif self.classification_level == 0:
            return [node for node in IcatusTerminalNode if not node.value.startswith("I5")]
        else:
            return classification_response.get_terminal_nodes()

    async def execute(self, *,
                      experience_title: str,
                      company: str,
                      work_type: WorkType,
                      responsibilities: list[str],
                      country_of_interest: Country,
                      number_of_titles: int,
                      top_k: int,
                      top_p: int,
                      ) -> InferOccupationToolOutput:

        # 1. Classify the experience as one of the icatus skills
        icatus_classification_llm = _IcatusClassificationLLM(
                self.classification_level, 
                logger=self._logger
                )
        classification_response = await icatus_classification_llm.execute(
            experience_title=experience_title,
            responsibilities=responsibilities,
        )
        # 2. Consider different possibilities based on the output

        terminal_icatus_nodes = self.find_terminal_icatus_nodes(classification_response)
        icatus_occupations = await self.find_occupations(terminal_icatus_nodes)
        contextualization_llm = _ContextualizationLLM(
            country_of_interest=country_of_interest,
            number_of_titles=number_of_titles,
            logger=self._logger)
        icatus_contextualization_response = await contextualization_llm.execute(
            experience_title=experience_title,
            company=company,
            work_type=work_type,
            responsibilities=responsibilities,
            number_of_titles=number_of_titles
        )
        if classification_response.icatus_node.is_volunteering() and len(icatus_occupations)< top_k:
            # 2.1 If the classification is volunteering, proceed with the usual inference
            # and pre-attaches existing volunteering occupations
            esco_occupations =  await self._infer_occupations_tool.execute(
                                                            experience_title=experience_title,
                                                            company=company,
                                                            work_type=work_type,
                                                            responsibilities=responsibilities,
                                                            country_of_interest=country_of_interest,
                                                            number_of_titles=number_of_titles,
                                                            top_k=top_k - len(terminal_icatus_nodes),
                                                            top_p=top_p
                                                            )
            return InferOccupationToolOutput(
                contextual_titles=icatus_contextualization_response.contextual_titles + esco_occupations.contextual_titles,
                esco_occupations=icatus_occupations+esco_occupations,
                responsibilities=responsibilities,
                llm_stats=classification_response.llm_stats +icatus_contextualization_response.llm_stats
                )
            
        # 2.2 If the classification is not volunteering return a pre-fixed list of occupations
        # with their contextualized titles

        return InferOccupationToolOutput(contextual_titles=icatus_contextualization_response.contextual_titles,
                                         esco_occupations=icatus_occupations,
                                         responsibilities=responsibilities,
                                         llm_stats=classification_response.llm_stats + icatus_contextualization_response.llm_stats
                                         )

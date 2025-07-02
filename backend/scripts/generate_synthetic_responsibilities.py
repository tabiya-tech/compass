import json
import logging
from textwrap import dedent
from tqdm import tqdm
from pydantic import BaseModel
import random

from app.agent.llm_caller import LLMCaller
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_search_service import OccupationSkillSearchService
from app.vector_search.settings import VectorSearchSettings
from app.agent.linking_and_ranking_pipeline.infer_icatus_activities.utils import IcatusTerminalNode
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, MODERATE_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG

class ExperienceLLMOutput(BaseModel):
    reasoning: str
    experience_title: str
    responsibility: str

def _get_system_instructions():
    return dedent("""\
                  <System Instructions>
                  You are an expert in identifying examples of experiences and responsibilities associated to them, given some general definition from a database.
                  You are given an experience title and a skill associated with it, from a database focusing on the unseen economy, for types of work that is not paid or done for hire, including work in one's household and volunteering.
                  Your task is to generate both an example of an experience title, along with a specific responsibility that reflects the input components.
                  The experience title should reflect the provided title and the responsibility should reflect the skill associated with it.
                  For example, if the occupation title is 'cleaning or fixing roads or buildings without getting paid' and the skill is 'remove road surface', you could generate an experience title like 'I help clean the beach after a storm' and a responsibility like 'Remove debris and debris-laden surfaces to restore the beach to a clean and safe condition'.
                  #Input Structure
                      The input structure is composed of: 
                      'Occupation Title': The occupation title.
                      'Skill': The skill associated with the occupation.
                      You should use the above information only to infer the context and you shouldn't return it as output.
                  #JSON Output instructions
                      Your response must always be a JSON object with the following schema:
                      {
                          "reasoning": Why you chose to return the specific title and responsibility and how they align with the input,
                          "experience_title": The experience title that you generated,
                          "responsibility": The responsibility that you generated
                      }
                  """)

def generate_prompt(occupation_title: str, skill_title: str):
    return f"Occupation Title: {occupation_title}\nSkill: {skill_title}"

async def setup_search_service_tool():
    db = await CompassDBProvider.get_taxonomy_db()
    settings = VectorSearchSettings()
    embedding_service = GoogleGeckoEmbeddingService()
    search_service = OccupationSkillSearchService(db, embedding_service, settings)
    return search_service

async def setup_llm_tools():
    llm  = GeminiGenerativeLLM(
            system_instructions=_get_system_instructions(),
            config=LLMConfig(generation_config=MODERATE_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG)
        )
    llm_caller : LLMCaller[ExperienceLLMOutput] = LLMCaller[ExperienceLLMOutput](
            model_response_type=ExperienceLLMOutput)
    logger = logging.getLogger(__name__)
    return llm, llm_caller, logger

async def generate_synthetic_responsibilities(output_path: str, skills_per_occupation=5):
    search_service = await setup_search_service_tool()
    llm, llm_caller, logger = await setup_llm_tools()
    with open(output_path, "wt") as fout:
        for code in tqdm([node.code for node in IcatusTerminalNode]):
            occupation = await search_service.get_by_esco_code(code=code)
            skills = random.sample(occupation.associated_skills, skills_per_occupation)
            for index, skill in enumerate(skills):
                prompt = generate_prompt(occupation.occupation.preferredLabel, skill.preferredLabel)
                result, _ = await llm_caller.call_llm(
                    llm=llm,
                    llm_input=prompt,
                    logger=logger
                )
                experience_dict = {
                    "name": f"{code}-{index}",
                    "given_experience_title": result.experience_title,
                    "given_company_name": "Home",
                    "given_responsibilities": [result.responsibility],
                    "given_country_of_interest": "South Africa",
                    "given_work_type": "Unpaid other",
                    "expected_top_skills": [skill.preferredLabel],
                }
                fout.write(json.dumps(experience_dict)+"\n")

if __name__ == "__main__":
    import asyncio
    asyncio.run(generate_synthetic_responsibilities("synthetic_responsibilities.jsonl"))
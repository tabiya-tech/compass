# Connect to the database and generate a JSONL file for the infer_occupation_tool
import argparse
import json
from datetime import datetime
from textwrap import dedent

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from pyarrow import timestamp
from pydantic import BaseModel
from pydantic_settings import BaseSettings

from app.agent.experience import WorkType
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.countries import Country
from common_libs.text_formatters.extract_json import extract_json


class ScriptSettings(BaseSettings):
    taxonomy_db_uri: str
    taxonomy_db_name: str
    taxonomy_model_id: str
    api_key: str
    model: str

    class Config:
        env_prefix = "INFER_OCCUPATION_TOOL_TEST_CASES_"


class PartialSpecification(BaseModel):
    given_code: str
    given_work_type: WorkType
    given_company: str
    given_country_of_interest: Country
    expected_occupations_found_codes: list[str] = []


list_of_given_partial_specs: list[PartialSpecification] = [
    PartialSpecification(
        given_code="7512.1",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_company="Baker's Delight",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["7512.1"]
    ),
    PartialSpecification(
        given_code="I31_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I31_0"]
    ),
    PartialSpecification(
        given_code="I31_0_1",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I31_0"]
    ),
    PartialSpecification(
        given_code="I31_0_2",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I31_0"]
    ),
    PartialSpecification(
        given_code="I31_0_3",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I31_0"]
    ),
    PartialSpecification(
        given_code="I31_0_4",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I31_0"]
    ),
    PartialSpecification(
        given_code="I5131_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I5131_0"]
    ),
    PartialSpecification(
        given_code="I32_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I32_0"]
    ),
    PartialSpecification(
        given_code="I32_0_1",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I32_0"]
    ),
    PartialSpecification(
        given_code="I32_0_2",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I32_0"]
    ),
    PartialSpecification(
        given_code="I32_0_3",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I32_0"]
    ),
    PartialSpecification(
        given_code="I32_0_4",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I32_0"]
    ),
    PartialSpecification(
        given_code="I32_0_5",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I32_0"]
    ),
    PartialSpecification(
        given_code="I5132_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I5132_0"]
    ),
    PartialSpecification(
        given_code="I33_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I33_0"]
    ),
    PartialSpecification(
        given_code="I33_0_1",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I33_0"]
    ),

    PartialSpecification(
        given_code="I33_0_2",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I33_0"]
    ),
    PartialSpecification(
        given_code="I33_0_3",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I33_0"]
    ),
    PartialSpecification(
        given_code="I5133_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I5133_0"]
    ),

    PartialSpecification(
        given_code="I34_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I34_0"]
    ),
    PartialSpecification(
        given_code="I34_0_1",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I34_0"]
    ),
    PartialSpecification(
        given_code="I34_0_2",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I34_0"]
    ),
    PartialSpecification(
        given_code="I34_0_3",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I34_0"]
    ),
    PartialSpecification(
        given_code="I34_0_4",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I34_0"]
    ),
    PartialSpecification(
        given_code="I5134_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="Community",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I5134_0"]
    ),
    PartialSpecification(
        given_code="I41_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I41_0"]
    ),
    PartialSpecification(
        given_code="I41_0_1",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I41_0"]
    ),
    PartialSpecification(
        given_code="I41_0_2",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I41_0"]
    ),
    PartialSpecification(
        given_code="I41_0_3",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I41_0"]
    ),
    PartialSpecification(
        given_code="I41_0_4",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I41_0"]
    ),
    PartialSpecification(
        given_code="I41_0_5",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I41_0"]
    ),
    PartialSpecification(
        given_code="I41_0_6",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I41_0"]
    ),
    PartialSpecification(
        given_code="I41_0_7",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I41_0"]
    ),
    PartialSpecification(
        given_code="I5141_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="Community",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I5141_0"]
    ),
    PartialSpecification(
        given_code="I42_0_1",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I42_0"]  # The I42_0_5 code has been excluded from embeddings, so expect the parent code I42_0 to be returned
    ),
    PartialSpecification(
        given_code="I42_0_2",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I42_0"]  # The I42_0_5 code has been excluded from embeddings, so expect the parent code I42_0 to be returned
    ),
    PartialSpecification(
        given_code="I42_0_3",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I42_0"]  # The I42_0_5 code has been excluded from embeddings, so expect the parent code I42_0 to be returned
    ),
    PartialSpecification(
        given_code="I42_0_4",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I42_0"]  # The I42_0_5 code has been excluded from embeddings, so expect the parent code I42_0 to be returned
    ),
    PartialSpecification(
        given_code="I42_0_5",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I42_0"]  # The I42_0_5 code has been excluded from embeddings, so expect the parent code I42_0 to be returned
    ),
    PartialSpecification(
        given_code="I42_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I42_0"]
    ),
    PartialSpecification(
        given_code="I5142_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="Community",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I5142_0"]
    ),
    PartialSpecification(
        given_code="I43_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I43_0"]
    ),
    PartialSpecification(
        given_code="I43_0_1",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I43_0"]
    ),
    PartialSpecification(
        given_code="I43_0_2",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I43_0"]
    ),
    PartialSpecification(
        given_code="I5143_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="Community",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I5143_0"]
    ),
    PartialSpecification(
        given_code="I44_0",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I44_0"]
    ),
    PartialSpecification(
        given_code="I44_0_2",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="home",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I44_0"]
    ),
    PartialSpecification(
        given_code="I51_5",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="Community",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I51_5"]
    ),
    PartialSpecification(
        given_code="I52_1",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="Community",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I52_1"]
    ),
    PartialSpecification(
        given_code="I52_2",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="Community",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I52_2"]
    ),
    PartialSpecification(
        given_code="I52_3",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="Community",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I52_3"]
    ),
    PartialSpecification(
        given_code="I52_4",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="Community",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I52_4"]
    ),
    PartialSpecification(
        given_code="I52_5",
        given_work_type=WorkType.UNSEEN_UNPAID,
        given_company="Community",
        given_country_of_interest=Country.UNSPECIFIED,
        expected_occupations_found_codes=["I52_5"]
    ),
]

import dotenv

from google import genai
from google.genai import types

_template = """
Given this description of an activity or job:
"'{title}'
 {description}
 {scope_note}"


Please respond as if you’re the one who did the job. Use plain, everyday language—not business or technical terms. 
Keep it simple and real, like you're telling a friend. Speak in the first person.

Your response should be in the following JSONL format

{
  "data": [
    {
      "given_experience_title": "string (a simple title you’d use)",
      "given_responsibilities": [
        "string (one daily task you performed as part of the recurring experience, using plain language)",
        "another string",
        "... (2–5 items total)"
      ],
      "given_company": "string (the company or receiver of the work depending on the work type)",
    },
    {
      "given_experience_title": "another possible title",
      "given_responsibilities": [
        "... (same format)"
      ],
      "given_company": "another company or receiver of the work"
    }
  ]
}

Make sure:

* You give 2 to 3 simple titles.
* Each title has a list of plain-language sentences describing the tasks you did.
* Everything is written in first person as if you're sharing your own experience.
"""


class SyntheticSpecification(BaseModel):
    given_experience_title: str
    given_responsibilities: list[str]
    given_company: str


class SyntheticData(BaseModel):
    data: list[SyntheticSpecification]


def call_gemini(*, api_key: str, model: str, title: str, description: str, scope_note: str) -> list[SyntheticSpecification]:
    client = genai.Client(
        api_key=api_key
    )

    prompt = replace_placeholders_with_indent(_template,
                                              title=title,
                                              description=description,
                                              scope_note=scope_note)
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=prompt),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        response_mime_type="application/json",
    )

    content = client.models.generate_content(
        model=model,
        contents=contents,
        config=generate_content_config,
    )
    synthetic_data = extract_json(content.text, model=SyntheticData)
    return synthetic_data.data


async def generate_jsonl_file(*,
                              taxonomy_db_uri: str,
                              taxonomy_db_name: str,
                              taxonomy_model_id: str,
                              api_key: str,
                              model: str,
                              ) -> None:
    compass_db = (AsyncIOMotorClient(
        taxonomy_db_uri,
        tlsAllowInvalidCertificates=True)
                  .get_database(taxonomy_db_name))
    collection = compass_db.get_collection("occupationmodels")
    # make a backup copy of the file if it exists
    import os
    if os.path.exists("infer_occupation_tool_test_cases.jsonl"):
        import shutil
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        shutil.copy("infer_occupation_tool_test_cases.jsonl", "infer_occupation_tool_test_cases.jsonl.bak_" + timestamp)

    with open("infer_occupation_tool_test_cases.jsonl", "w", encoding="utf-8") as file:
        for partial_spec in list_of_given_partial_specs:
            given_occupation = await collection.find_one({"code": partial_spec.given_code, "modelId": ObjectId(taxonomy_model_id)})
            if not given_occupation:
                raise ValueError(f"Occupation with code {partial_spec.given_code} not found in the database.")
            expected_occupations_found = await collection.find(
                {"code": {"$in": partial_spec.expected_occupations_found_codes}, "modelId": ObjectId(taxonomy_model_id)}).to_list(None)
            if not expected_occupations_found:
                raise ValueError(f"Expected occupations with codes {partial_spec.expected_occupations_found_codes} not found in the database.")
            code = given_occupation["code"]
            preferred_label = given_occupation["preferredLabel"]
            description = given_occupation["description"]
            scope_note = given_occupation["scopeNote"]
            synthetic_specs = call_gemini(api_key=api_key,
                                          model=model,
                                          title=preferred_label,
                                          description=description,
                                          scope_note=scope_note)
            for spec in synthetic_specs:
                entry = {
                    "name": f"{code} {preferred_label}",
                    "given_experience_title": spec.given_experience_title,
                    "given_work_type": partial_spec.given_work_type.value,
                    "given_company": spec.given_company,
                    "given_country_of_interest": partial_spec.given_country_of_interest.value,
                    "given_responsibilities": spec.given_responsibilities,
                    "expected_occupations_found": [
                        {
                            "code": expected_occupation["code"],
                            "preferred_label": expected_occupation["preferredLabel"]
                        } for expected_occupation in expected_occupations_found
                    ]
                }
                file.write(json.dumps(entry, ensure_ascii=False) + "\n")


# main
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=dedent("""
            Generate Test cases for the infer_occupation_tool.
            
            This script creates a JSONL file containing test cases based on occupations from the Tabiya taxonomy
            The test cases are generated using the Gemini API to generate synthetic specifications based on the occupation data.
            
            The generated test cases are written to a file named 'infer_occupation_tool_test_cases.jsonl' in the current directory.
            
            The script connects to the Tabiya MongoDB database to retrieve occupation data.
            
            The script requires the following environment variables to be set:
            - INFER_OCCUPATION_TOOL_TEST_CASES_TAXONOMY_DB_URI: MongoDB URI of the taxonomy database
            - INFER_OCCUPATION_TOOL_TEST_CASES_TAXONOMY_DB_NAME: Name of the taxonomy database
            - INFER_OCCUPATION_TOOL_TEST_CASES_TAXONOMY_MODEL_ID: ID of the taxonomy model
            - INFER_OCCUPATION_TOOL_TEST_CASES_API_KEY: API key for the Gemini API
            - INFER_OCCUPATION_TOOL_TEST_CASES_MODEL: The name of the mode to use to generate the test cases (e.g. "gemini-2.0-flash")
            """),
        formatter_class=argparse.RawTextHelpFormatter)
    options_group = parser.add_argument_group("Options")

    args = parser.parse_args()

    env = dotenv.find_dotenv()
    dotenv.load_dotenv(env)
    # Load the script settings from the environment variables
    settings = ScriptSettings()  # type: ignore

    import asyncio

    asyncio.run(generate_jsonl_file(taxonomy_db_uri=settings.taxonomy_db_uri,
                                    taxonomy_db_name=settings.taxonomy_db_name,
                                    taxonomy_model_id=settings.taxonomy_model_id,
                                    api_key=settings.api_key,
                                    model=settings.model))

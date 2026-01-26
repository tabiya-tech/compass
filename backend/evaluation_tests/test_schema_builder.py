from enum import Enum
from typing import List, Union, Optional

import pytest
from google.cloud.aiplatform_v1beta1.types import Schema
from pydantic import BaseModel, Field

from app.agent.agent_director._llm_router import RouterModelResponse
from app.agent.collect_experiences_agent._dataextraction_llm import _CollectedExperience
from app.agent.collect_experiences_agent.data_extraction_llm._entity_extraction_tool import \
    _LLMOutput as EntityExtractionToolOutput
from app.agent.collect_experiences_agent.data_extraction_llm._intent_analyzer_tool import \
    _LLMOutput as IntentAnalyzerToolOutput
from app.agent.collect_experiences_agent.data_extraction_llm._temporal_classifier_tool import \
    _LLMOutput as TemporalClassifierToolOutput
from app.agent.experience._experience_summarizer import ExperienceSummarizerResponse
from app.agent.linking_and_ranking_pipeline.cluster_responsibilities_tool.cluster_responsibilties_tool import \
    ClusterResponsibilitiesLLMResponse
from app.agent.linking_and_ranking_pipeline.infer_occupation_tool._contextualization_llm import \
    _ContextualizationLLMOutput
from app.agent.linking_and_ranking_pipeline.pick_top_skills_tool import _PickTopSkillsLLMOutput
from app.agent.linking_and_ranking_pipeline.relevant_entities_classifier_llm import _RelevantEntityClassifierLLMOutput
from app.agent.simple_llm_agent.llm_response import ModelResponse
from app.agent.skill_explorer_agent._responsibilities_extraction_llm import ResponsibilitiesExtractionResponse
from app.agent.skill_explorer_agent._sentence_decomposition_llm import _SentenceDecompositionResponse, \
    _SentenceDecompositionFirstPassResponse
from app.agent.welcome_agent import WelcomeAgentLLMResponse
from app.users.cv.utils.llm_extractor import CVExtractionResponse
from common_libs.llm.schema_builder import build_request_schema


def assert_successful_schema(schema: dict):
    # THEN the schema should be able to pass validation
    Schema(schema)


class TestPydanticToVertexSchema:
    def test_basic_field_with_description(self):
        # GIVEN a basic model with a str, int float
        class BasicModel(BaseModel):
            string_value: str = Field(..., description="A string value")
            int_value: int = Field(..., description="An integer value")
            float_value: float = Field(..., description="A float value")

        # WHEN building a successful schema
        schema = build_request_schema(BasicModel)

        # THEN it should be built successfully
        assert_successful_schema(schema)

        # AND the schema should be as expected
        expected_schema = {
            'type_': 'OBJECT',
            'properties': {
                'string_value': {'type_': 'STRING', 'title': 'String Value', 'description': 'A string value'},
                'int_value': {'type_': 'INTEGER', 'title': 'Int Value', 'description': 'An integer value'},
                'float_value': {'type_': 'NUMBER', 'title': 'Float Value', 'description': 'A float value'}
            },
            'title': 'BasicModel',
            'required': ['string_value', 'int_value', 'float_value'],
        }

        assert schema == expected_schema

    def test_inheritance(self):
        # GIVEN a parent and child model
        class ParentModel(BaseModel):
            parent_field: str

        class ChildModel(ParentModel):
            child_field: int

        # WHEN building the schema
        schema = build_request_schema(ChildModel)

        # THEN it should be built successfully
        assert_successful_schema(schema)

        # AND the schema should be as expected
        expected_schema = {
            'type_': 'OBJECT',
            'properties': {
                'parent_field': {'type_': 'STRING', 'title': 'Parent Field'},
                'child_field': {'type_': 'INTEGER', 'title': 'Child Field'}
            },
            'title': 'ChildModel',
            'required': ['parent_field', 'child_field']
        }

        assert schema == expected_schema

    def test_composition(self):
        # GIVEN a model with a nested model
        class NestedModel(BaseModel):
            name: str

        class ComposedModel(BaseModel):
            nested: NestedModel

        # WHEN building the schema
        schema = build_request_schema(ComposedModel)

        # THEN it should be built successfully
        assert_successful_schema(schema)

        # AND the schema should be as expected
        expected_schema = {
            'properties': {
                'nested': {
                    'properties': {
                        'name': {'type_': 'STRING', 'title': 'Name'}
                    },
                    'required': ['name'],
                    'title': 'NestedModel',
                    'type_': 'OBJECT'}
            },
            'title': 'ComposedModel',
            'required': ['nested'],
            'type_': 'OBJECT'
        }

        assert schema == expected_schema

    def test_union(self):
        # GIVEN a model with a Union field
        class UnionModel(BaseModel):
            # TODO: Fix the swapping
            val: Union[str, int]

        # WHEN building the schema
        schema = build_request_schema(UnionModel)

        # THEN it should be built successfully
        assert_successful_schema(schema)

        # AND the schema should be as expected
        expected_schema = {
            'properties': {
                'val': {'type_': 'STRING'}
            },
            'title': 'UnionModel',
            'required': ['val'],
            'type_': 'OBJECT'
        }

        assert schema == expected_schema

    def test_optional(self):
        # GIVEN a model with an Optional field
        class OptionalModel(BaseModel):
            val: Optional[str]

        # WHEN building the schema
        schema = build_request_schema(OptionalModel)

        # THEN it should be built successfully
        assert_successful_schema(schema)

        # AND the schema should be as expected
        expected_schema = {
            'properties': {
                'val': {'type_': 'STRING', 'nullable': True}
            },
            'required': ['val'],
            'title': 'OptionalModel',
            'type_': 'OBJECT'
        }

        assert schema == expected_schema

    def test_enum(self):
        # GIVEN a model with an enum field
        class MyEnum(str, Enum):
            A = "a"
            B = "b"

        class EnumModel(BaseModel):
            choice: MyEnum

        # WHEN building the schema
        schema = build_request_schema(EnumModel)

        # THEN it should be built successfully
        assert_successful_schema(schema)

        # AND the schema should be as expected
        expected_schema = {
            'properties': {
                'choice': {
                    'enum': ['a', 'b'],
                    'type_': 'STRING',
                    'title': 'MyEnum'
                }
            },
            'required': ['choice'],
            'title': 'EnumModel',
            'type_': 'OBJECT'
        }

        assert schema == expected_schema

    def test_no_additional_properties(self):
        # GIVEN a model with no additional properties
        class StrictModel(BaseModel):
            name: str

            class Config:
                extra = "forbid"

        # WHEN building the schema
        schema = build_request_schema(StrictModel)

        # THEN it should be built successfully
        assert_successful_schema(schema)

    def test_list_of_objects(self):
        # GIVEN a model with a list of objects
        class Item(BaseModel):
            name: str

        class ListModel(BaseModel):
            items_list: List[Item]

        # WHEN building the schema
        schema = build_request_schema(ListModel)

        # THEN it should be built successfully
        assert_successful_schema(schema)

        # AND the schema should be as expected
        expected_schema = {
            'properties': {
                'items_list': {
                    'items': {
                        'properties': {
                            'name': {'type_': 'STRING', 'title': 'Name'}
                        },
                        'required': ['name'],
                        'title': 'Item',
                        'type_': 'OBJECT'
                    },
                    'title': 'Items List',
                    'type_': 'ARRAY'
                }
            },
            'required': ['items_list'],
            'title': 'ListModel',
            'type_': 'OBJECT'
        }

        assert schema == expected_schema


llm_inputs = [
    WelcomeAgentLLMResponse,
    RouterModelResponse,
    _CollectedExperience,
    TemporalClassifierToolOutput,
    IntentAnalyzerToolOutput,
    EntityExtractionToolOutput,
    ExperienceSummarizerResponse,
    _PickTopSkillsLLMOutput,
    _RelevantEntityClassifierLLMOutput,
    ClusterResponsibilitiesLLMResponse,
    _ContextualizationLLMOutput,
    ModelResponse,
    ResponsibilitiesExtractionResponse,
    _SentenceDecompositionFirstPassResponse,
    _SentenceDecompositionResponse,
    CVExtractionResponse
]


@pytest.mark.parametrize("llm_input", llm_inputs, ids=[_input.__name__ for _input in llm_inputs])
def test_llm_inputs(llm_input: type[BaseModel]):
    # GIVEN the llm input is parsed
    schema = build_request_schema(llm_input)

    # THEN it should be built successfully
    assert_successful_schema(schema)

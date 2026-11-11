from typing import Optional

import pytest

from app.agent.config import ModelTier, GEMINI_DEFAULT_MODELS
from app.app_config import ApplicationConfig, set_application_config
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, resolve_model_name


def _set_llm_config(config: ApplicationConfig, *,
                    default_model: Optional[str] = None,
                    reasoning_model: Optional[str] = None,
                    deep_reasoning_model: Optional[str] = None) -> None:
    set_application_config(config.model_copy(update={
        "llm_default_model": default_model,
        "llm_reasoning_model": reasoning_model,
        "llm_deep_reasoning_model": deep_reasoning_model,
    }))


class TestResolveModelName:
    @pytest.mark.parametrize("given_tier, expected_model", [
        (ModelTier.DEFAULT, "gemini-3.5-flash-lite"),
        (ModelTier.REASONING, "gemini-3.8-flash"),
        (ModelTier.DEEP_REASONING, "gemini-3.1-pro-preview"),
    ])
    def test_uses_the_gemini_defaults_when_no_model_is_set(self, setup_application_config,
                                                           given_tier: ModelTier, expected_model: str):
        # GIVEN no tier models are configured
        _set_llm_config(setup_application_config)

        # WHEN the model name for the given tier is resolved
        actual_model = resolve_model_name(tier=given_tier)

        # THEN expect the gemini default for the tier
        assert actual_model == expected_model
        # AND the default to be the one declared for the tier
        assert actual_model == GEMINI_DEFAULT_MODELS[given_tier]

    @pytest.mark.parametrize("given_tier, expected_model", [
        (ModelTier.DEFAULT, "given-default"),
        (ModelTier.REASONING, "given-reasoning"),
        (ModelTier.DEEP_REASONING, "given-deep-reasoning"),
    ])
    def test_uses_the_tier_model_when_it_is_set(self, setup_application_config,
                                                given_tier: ModelTier, expected_model: str):
        # GIVEN a model is configured for every tier
        _set_llm_config(setup_application_config,
                        default_model="given-default",
                        reasoning_model="given-reasoning",
                        deep_reasoning_model="given-deep-reasoning")

        # WHEN the model name for the given tier is resolved
        actual_model = resolve_model_name(tier=given_tier)

        # THEN expect the model configured for the tier
        assert actual_model == expected_model

    @pytest.mark.parametrize("given_reasoning_model, given_tier, expected_model", [
        (None, ModelTier.REASONING, "gemini-3.8-flash"),
        (None, ModelTier.DEEP_REASONING, "gemini-3.1-pro-preview"),
        ("given-reasoning", ModelTier.DEEP_REASONING, "gemini-3.1-pro-preview"),
    ])
    def test_does_not_fall_back_to_another_tier(self, setup_application_config,
                                                given_reasoning_model: Optional[str],
                                                given_tier: ModelTier, expected_model: str):
        # GIVEN a default model is configured, and maybe a reasoning model
        _set_llm_config(setup_application_config,
                        default_model="given-default",
                        reasoning_model=given_reasoning_model)

        # WHEN the model name for a tier without a model is resolved
        actual_model = resolve_model_name(tier=given_tier)

        # THEN expect the gemini default for the tier, not another tier's model
        assert actual_model == expected_model

    @pytest.mark.parametrize("given_tier", list(ModelTier))
    def test_uses_the_defaults_when_the_application_config_is_not_set(self, given_tier: ModelTier):
        # GIVEN the application config is not set
        set_application_config(None)

        # WHEN the model name for the given tier is resolved
        actual_model = resolve_model_name(tier=given_tier)

        # THEN expect the gemini default for the tier
        assert actual_model == GEMINI_DEFAULT_MODELS[given_tier]


class TestGeminiGenerativeLLM:
    @pytest.mark.parametrize("given_config, expected_model", [
        (LLMConfig(), "gemini-3.5-flash-lite"),
        (LLMConfig(model_tier=ModelTier.DEEP_REASONING), "given-deep-reasoning"),
        (LLMConfig(model_tier=ModelTier.DEEP_REASONING, language_model_name="given-explicit-model"),
         "given-explicit-model"),
    ])
    def test_model_is_resolved_on_creation(self, setup_application_config,
                                           given_config: LLMConfig, expected_model: str):
        # GIVEN only a deep reasoning model is configured
        _set_llm_config(setup_application_config, deep_reasoning_model="given-deep-reasoning")

        # WHEN a gemini llm is created for the given config
        actual_llm = GeminiGenerativeLLM(config=given_config)

        # THEN expect the llm to use the resolved model name
        # noinspection PyProtectedMember
        assert actual_llm._model_name == expected_model  # pylint: disable=protected-access
        # AND the resource name to refer to the same model
        # noinspection PyProtectedMember
        assert actual_llm._resource_name.endswith(f"/models/{expected_model}")  # pylint: disable=protected-access

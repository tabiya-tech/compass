import logging

from vertexai.generative_models import GenerativeModel, Content, Part, GenerationConfig
from vertexai.language_models import TextGenerationModel

from common_libs.llm.models_utils import LLMConfig, LLMInput, LLMResponse, BasicLLM
from app.i18n.locale_detector import get_locale


class GeminiGenerativeLLM(BasicLLM):
    """
    A wrapper for the Gemini LLM that provides retry logic with exponential backoff and jitter for generating content.
    """

    def __init__(self, *,
                 system_instructions: list[str] | str | None = None,
                 config: LLMConfig = LLMConfig()):
        super().__init__(config=config)

        # Agregar instrucción obligatoria en español
        locale = get_locale()
        mandatory_instruction = f"Super important! Please produce all responses in the locale {locale}. Do not mix languages under any circumstances. Keep the entire conversation strictly in {locale}."
        if system_instructions is None:
            system_instructions = [mandatory_instruction]
        elif isinstance(system_instructions, str):
            system_instructions = [mandatory_instruction, system_instructions]
        elif isinstance(system_instructions, list):
            system_instructions.insert(0,mandatory_instruction)
            system_instructions.append("You always must handle the dates with this pattern  MM/YYYY, for example 03/2022")
            

        self._model = GenerativeModel(
            model_name=config.language_model_name,
            system_instruction=system_instructions,
            generation_config=GenerationConfig.from_dict(config.generation_config),
            safety_settings=list(config.safety_settings)
        )

        # noinspection PyProtectedMember
        self._resource_name = self._model._prediction_resource_name  # pylint: disable=protected-access

    async def internal_generate_content(self, llm_input: LLMInput | str) -> LLMResponse:
        contents = llm_input if isinstance(llm_input, str) else [
            Content(role=turn.role, parts=[Part.from_text(turn.content)]) for turn in llm_input.turns
        ]
        response = await self._model.generate_content_async(contents=contents)
        return LLMResponse(
            text=response.text,
            prompt_token_count=response.usage_metadata.prompt_token_count,
            response_token_count=response.usage_metadata.candidates_token_count
        )


class PalmTextGenerativeLLM(BasicLLM):
    """
    A wrapper for the Palm2 Text generation model that provides retry logic with exponential backoff and jitter for
    generating content.
    """

    def __init__(self, *, system_instructions: list[str] | str | None = None, config: LLMConfig = LLMConfig()):
        super().__init__(config=config)
        self._model = TextGenerationModel.from_pretrained("text-bison@002")
        self._params = config.generation_config

        # Agregar instrucción obligatoria en español
        locale = get_locale()
        mandatory_instruction = f"Super important!! Please, produce the response in this locale {locale}"
        if system_instructions is None:
            self._system_instructions = mandatory_instruction
        elif isinstance(system_instructions, str):
            self._system_instructions = system_instructions + "\n" + mandatory_instruction
        elif isinstance(system_instructions, list):
            self._system_instructions = "\n".join(system_instructions + [mandatory_instruction])
        else:
            self._system_instructions = mandatory_instruction

    async def internal_generate_content(self, llm_input: LLMInput | str) -> LLMResponse:
        contents = llm_input if isinstance(llm_input, str) else "Current conversation:\n" + "\n".join(
            [f"{turn.role}: {turn.content}" for turn in llm_input.turns]
        )
        prompt = contents
        if self._system_instructions:
            prompt = self._system_instructions + "\n" + contents

        response = await self._model.predict_async(prompt=prompt, **self._params)
        return LLMResponse(
            text=response.text,
            prompt_token_count=response.raw_prediction_response.metadata['tokenMetadata']['inputTokenCount']['totalTokens'],
            response_token_count=response.raw_prediction_response.metadata['tokenMetadata']['outputTokenCount']['totalTokens']
        )
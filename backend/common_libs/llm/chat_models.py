import logging

from vertexai.generative_models import GenerativeModel, Content, Part, GenerationConfig
from vertexai.language_models import ChatModel, ChatMessage

from common_libs.llm.models_utils import LLMConfig, LLMInput, LLMResponse, BasicLLM

logger = logging.getLogger(__name__)


class GeminiChatLLM(BasicLLM):
    """
    A wrapper for the Gemini LLM that includes retry logic with exponential backoff and jitter
    for sending messages in a chat session. The Gemini LLM chat session is stateful and maintains an in-memory history.
    Essentially, the chat uses the same underlying model as the generative model.
    It constructs the content by using ´system_instructions´, ´llm_input´ and ´message´ as inputs,
    which are then processed by the ´generate_content()´ function to generate the desired output.
    """

    def __init__(self,
            *,
            system_instructions: list[str] | str,
            llm_input: LLMInput = None,
            config: LLMConfig = LLMConfig()):
        super().__init__(config=config)
        self._model = GenerativeModel(model_name=config.model_name,
                                      system_instruction=system_instructions,
                                      generation_config=GenerationConfig.from_dict(config.generation_config),
                                      safety_settings=list(config.safety_settings)
                                      )
        self._params = config.generation_config
        history = None if llm_input is None else [Content(role=turn.role, parts=[Part.from_text(turn.content)]) for turn
                                                  in llm_input.turns]
        self._chat = self._model.start_chat(history=history)
        # noinspection PyProtectedMember
        self._resource_name = self._model._prediction_resource_name  # pylint: disable=protected-access

    async def internal_generate_content(self, llm_input: LLMInput | str) -> LLMResponse:
        response = await self._chat.send_message_async(llm_input)
        return LLMResponse(text=response.text, prompt_token_count=response.usage_metadata.prompt_token_count,
                           response_token_count=response.usage_metadata.candidates_token_count)


class GeminiStatelessChatLLM(BasicLLM):
    """
    A wrapper for the Gemini LLM that includes retry logic with exponential backoff and jitter
    for sending messages in a stateless chat session which is created and destroyed for each message.

    """

    def __init__(self,
            *,
            system_instructions: list[str] | str,
            config: LLMConfig = LLMConfig()):
        super().__init__(config=config)
        self._model = GenerativeModel(model_name=config.model_name,
                                      system_instruction=system_instructions,
                                      generation_config=GenerationConfig.from_dict(config.generation_config),
                                      safety_settings=list(config.safety_settings)
                                      )
        self._params = config.generation_config
        # noinspection PyProtectedMember
        self._resource_name = self._model._prediction_resource_name  # pylint: disable=protected-access

    async def stateless_generate_content(self, *, history: LLMInput, llm_input: LLMInput | str) -> LLMResponse:
        """
        Stateless Chat using the Gemini LLM.
        It creates a new temporary chat session for each message,
        sends the message and returns the response from the model.
        It also includes retry logic with exponential backoff and jitter.
        :param history: The history of the conversation.
        :param llm_input: The message to send as a "user".
        :return: The generated response as a "model".
        """
        message_history = [Content(role=turn.role, parts=[Part.from_text(turn.content)]) for turn in history.turns]
        self._chat = self._model.start_chat(history=message_history)

        return await super().generate_content(llm_input)

    async def internal_generate_content(self, llm_input: LLMInput | str) -> LLMResponse:
        response = await self._chat.send_message_async(llm_input)
        return LLMResponse(text=response.text, prompt_token_count=response.usage_metadata.prompt_token_count,
                           response_token_count=response.usage_metadata.candidates_token_count)


class PalmChatLLM(BasicLLM):
    """
   A wrapper for the Palm2 LLM that includes retry logic with exponential backoff and jitter
   for sending messages in a chat session. The Palm2 LLM chat session is stateful and maintains an in-memory history.
   It constructs the content by using ´system_instructions´, ´llm_input´ and ´message´ as inputs,
   which are then processed by the ´send_message()´ function to generate the desired output.
   """

    def __init__(self,
            *,
            system_instructions: list[str] | str,
            llm_input: LLMInput = None,
            config: LLMConfig = LLMConfig()):
        super().__init__(config=config)
        self._model = ChatModel.from_pretrained("chat-bison@002")
        history = None if llm_input is None else [ChatMessage(author=turn.role, content=turn.content) for turn in
                                                  llm_input.turns]
        self._params = config.generation_config
        # TODO: add here examples as well?  examples: list[InputOutputTextPair] = None,
        self._chat = self._model.start_chat(context=system_instructions, message_history=history,
                                            temperature=self._params['temperature'])
        # noinspection PyProtectedMember
        self._resource_name = self._model._endpoint_name  # pylint: disable=protected-access

    async def internal_generate_content(self, llm_input: LLMInput | str) -> LLMResponse:
        contents = llm_input if type(llm_input) == str else "Current conversation:\n" + "\n".join(
                [f"{turn.role}: {turn.content}" for turn in llm_input.turns])

        response = await self._chat.send_message_async(contents, **self._params)
        return LLMResponse(text=response.text, prompt_token_count=
        response.raw_prediction_response.metadata['tokenMetadata']['inputTokenCount']['totalTokens'],
                           response_token_count=
                           response.raw_prediction_response.metadata['tokenMetadata']['outputTokenCount'][
                               'totalTokens'])


class PalmStatelessChatLLM(BasicLLM):
    """
    A wrapper for the Palm LLM that includes retry logic with exponential backoff and jitter
    for sending messages in a stateless chat session which is created and destroyed for each message.

    """

    def __init__(self,
            *,
            system_instructions: list[str] | str,
            config: LLMConfig = LLMConfig()):
        super().__init__(config=config)
        self._model = ChatModel.from_pretrained("chat-bison@002")
        self._system_instructions = system_instructions
        self._params = config.generation_config

        # noinspection PyProtectedMember
        self._resource_name = self._model._endpoint_name  # pylint: disable=protected-access

    async def stateless_generate_content(self, *, history: LLMInput, llm_input: LLMInput | str) -> LLMResponse:
        """
        Stateless Chat using the Palm LLM.
        It creates a new temporary chat session for each message,
        sends the message and returns the response from the model.
        It also includes retry logic with exponential backoff and jitter.
        :param history: The history of the conversation.
        :param llm_input: The message to send as a "user".
        :return: The generated response as a "model".
        """
        message_history = None if history is None else [ChatMessage(author=turn.role, content=turn.content) for turn in
                                                        history.turns]
        self._chat = self._model.start_chat(context=self._system_instructions, message_history=message_history,
                                            temperature=self._params['temperature'])

        return await super().generate_content(llm_input)

    async def internal_generate_content(self, llm_input: LLMInput | str) -> LLMResponse:
        contents = llm_input if type(llm_input) == str else "Current conversation:\n" + "\n".join(
                [f"{turn.role}: {turn.content}" for turn in llm_input.turns])

        response = await self._chat.send_message_async(contents, **self._params)
        return LLMResponse(text=response.text, prompt_token_count=
        response.raw_prediction_response.metadata['tokenMetadata']['inputTokenCount']['totalTokens'],
                           response_token_count=
                           response.raw_prediction_response.metadata['tokenMetadata']['outputTokenCount'][
                               'totalTokens'])

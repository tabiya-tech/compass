from base_evaluator import BaseEvaluator
from evaluation_result import TestEvaluationRecord, EvaluationResult
from evaluation_type import EvaluationType
from prompt_generator import PromptGenerator
from langchain_google_vertexai import ChatVertexAI




class CriteriaEvaluator(BaseEvaluator):

    def __init__(self, criteria: EvaluationType, data: TestEvaluationRecord):
        super().__init__(criteria, data)

        self.prompt = PromptGenerator.generate_prompt(conversation=data.generate_conversation(),
                                                       context=data.simulated_user_prompt,
                                                       criteria=criteria)

        self.llm = ChatVertexAI(model_name="gemini-pro")

    async def evaluate(self) -> EvaluationResult:
        conversation = await self.llm.ainvoke(self.prompt)
        print(conversation)

        return EvaluationResult
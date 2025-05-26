// mute the console
import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import IncorrectSkillsQuestion, {
  DATA_TEST_ID,

} from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/incorrectSkills/IncorrectSkillsQuestion";
import { FeedbackProvider } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext"
import { DATA_TEST_ID as QUESTION_RENDERER_DATA_TEST_ID } from "src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer";
import { mockQuestionsConfig } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.test.utils";
import { INCORRECT_SKILLS_QUESTION_ID } from "./constants";

jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer", () => {
  const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.QUESTION_RENDERER}></div>),
  };
})

describe("IncorrectSkillsQuestion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockOnChange = jest.fn();

  // Spy on the useFeedback hook to return our mockQuestionsConfig
  jest.spyOn(require("src/feedback/overallFeedback/feedbackContext/FeedbackContext"), "useFeedback").mockReturnValue({
    questionsConfig: mockQuestionsConfig,
    setQuestionsConfig: jest.fn(),
    isLoading: false,
    error: null,
    answers: [],
    handleAnswerChange: jest.fn(),
    clearAnswers: jest.fn(),
  });

  test("should render correctly with empty feedbackItems", () => {
    // GIVEN a questions config and no feedback items
    function Wrapper({ children }: React.PropsWithChildren<{}>) {
      return <FeedbackProvider>{children}</FeedbackProvider>;
    }
    // WHEN the component is rendered
    const { container } = render(
      <IncorrectSkillsQuestion feedbackItems={[]} onChange={mockOnChange} />, { wrapper: Wrapper }
    );
    // THEN the question should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.INCORRECT_SKILLS)).toBeInTheDocument();

    // AND it should call the QuestionRenderer with the correct props
    expect(screen.getByTestId(QUESTION_RENDERER_DATA_TEST_ID.QUESTION_RENDERER)).toBeInTheDocument();
    // AND it should match the snapshot
    expect(container).toMatchSnapshot();
  });

  test("should render correctly with existing feedbackItems", () => {
    // GIVEN a questions config and a feedback item
    const feedbackItems = [
      {
        question_id: INCORRECT_SKILLS_QUESTION_ID,
        simplified_answer: {
          rating_boolean: true,
          comment: "There are some incorrect skills.",
        },
      },
    ];
    function Wrapper({ children }: React.PropsWithChildren<{}>) {
      return <FeedbackProvider>{children}</FeedbackProvider>;
    }
    // WHEN the component is rendered
    const { container } = render(
      <IncorrectSkillsQuestion feedbackItems={feedbackItems} onChange={mockOnChange} />, { wrapper: Wrapper }
    );
    // THEN the question should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.INCORRECT_SKILLS)).toBeInTheDocument();
    // AND it should match the snapshot
    expect(container).toMatchSnapshot();
  });
}); 
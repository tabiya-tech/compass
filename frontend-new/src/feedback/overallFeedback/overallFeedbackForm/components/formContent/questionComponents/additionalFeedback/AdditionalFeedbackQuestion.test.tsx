// mute the console
import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import AdditionalFeedbackQuestion, {
  DATA_TEST_ID,
} from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionComponents/additionalFeedback/AdditionalFeedbackQuestion";
import { FeedbackProvider } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import { DATA_TEST_ID as QUESTION_RENDERER_DATA_TEST_ID } from "src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer";
import { mockQuestionsConfig } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.test.utils";
import { ADDITIONAL_FEEDBACK_QUESTION_ID } from "./constants";

jest.mock("src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer", () => {
    const actual = jest.requireActual("src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer");
    return {
      ...actual,
      __esModule: true,
      default: jest.fn().mockImplementation(() => <div data-testid={actual.DATA_TEST_ID.QUESTION_RENDERER}></div>),
    };
});

describe("AdditionalFeedbackQuestion", () => {
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
      <AdditionalFeedbackQuestion feedbackItems={[]} onChange={mockOnChange} />, { wrapper: Wrapper }
    );
    // THEN the question should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.ADDITIONAL_FEEDBACK)).toBeInTheDocument();
    // AND the question renderer should be in the document
    expect(screen.getByTestId(QUESTION_RENDERER_DATA_TEST_ID.QUESTION_RENDERER)).toBeInTheDocument();
    // AND it should match the snapshot
    expect(container).toMatchSnapshot();
  });

  test("should render correctly with existing feedbackItems", () => {
    // GIVEN a questions config and a feedback item
    const feedbackItems = [
      {
        question_id: ADDITIONAL_FEEDBACK_QUESTION_ID,
        simplified_answer: {
          rating_numeric: 4,
          comment: "The system was very helpful overall",
        },
      },
    ];
    function Wrapper({ children }: React.PropsWithChildren<{}>) {
      return <FeedbackProvider>{children}</FeedbackProvider>;
    }
    // WHEN the component is rendered
    const { container } = render(
      <AdditionalFeedbackQuestion feedbackItems={feedbackItems} onChange={mockOnChange} />, { wrapper: Wrapper }
    );
    // THEN the question should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.ADDITIONAL_FEEDBACK)).toBeInTheDocument();
    // AND it should match the snapshot
    expect(container).toMatchSnapshot();
  });

  test("should return null when questionsConfig is not available", () => {
    // GIVEN the useFeedback hook returns null for questionsConfig
    jest.spyOn(require("src/feedback/overallFeedback/feedbackContext/FeedbackContext"), "useFeedback").mockReturnValue({
      questionsConfig: null,
      setQuestionsConfig: jest.fn(),
      isLoading: false,
      error: null,
      answers: [],
      handleAnswerChange: jest.fn(),
      clearAnswers: jest.fn(),
    });

    function Wrapper({ children }: React.PropsWithChildren<{}>) {
      return <FeedbackProvider>{children}</FeedbackProvider>;
    }

    // WHEN the component is rendered
    const { container } = render(
      <AdditionalFeedbackQuestion feedbackItems={[]} onChange={mockOnChange} />, { wrapper: Wrapper }
    );

    // THEN expect the container to be empty
    expect(container).toBeEmptyDOMElement();
    // AND expect an error to be logged
    expect(console.error).toHaveBeenCalledWith(expect.any(Error));
  });

  test("should return null when question ID is not in questionsConfig", () => {
    // GIVEN the useFeedback hook returns a config without the required question ID
    const configWithoutQuestion = { ...mockQuestionsConfig };
    delete configWithoutQuestion[ADDITIONAL_FEEDBACK_QUESTION_ID];

    jest.spyOn(require("src/feedback/overallFeedback/feedbackContext/FeedbackContext"), "useFeedback").mockReturnValue({
      questionsConfig: configWithoutQuestion,
      setQuestionsConfig: jest.fn(),
      isLoading: false,
      error: null,
      answers: [],
      handleAnswerChange: jest.fn(),
      clearAnswers: jest.fn(),
    });

    function Wrapper({ children }: React.PropsWithChildren<{}>) {
      return <FeedbackProvider>{children}</FeedbackProvider>;
    }

    // WHEN the component is rendered
    const { container } = render(
      <AdditionalFeedbackQuestion feedbackItems={[]} onChange={mockOnChange} />, { wrapper: Wrapper }
    );

    // THEN expect the container to be empty
    expect(container).toBeEmptyDOMElement();
    // AND expect an error to be logged
    expect(console.error).toHaveBeenCalledWith(expect.any(Error));
  });
}); 
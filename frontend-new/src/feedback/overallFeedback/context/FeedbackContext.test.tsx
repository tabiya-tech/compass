//silence chatty console logs
import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import { FeedbackProvider, useFeedback } from "src/feedback/overallFeedback/context/FeedbackContext";
import { QuestionsConfig, QuestionType, YesNoEnum } from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";

const getTestQuestionsConfig = (): QuestionsConfig => ({
  perceived_bias: {
    questionId: "perceived_bias",
    question_text: "foo",
    description: "bar",
    comment_placeholder: "baz",
    type: QuestionType.YesNo,
    show_comments_on: YesNoEnum.No,
  },
  work_experience_accuracy: {
    questionId: "work_experience_accuracy",
    question_text: "foo",
    description: "bar",
    options: { foo: "bar" },
    comment_placeholder: "baz",
    type: QuestionType.Checkbox,
    low_rating_label: "Inaccurate",
    high_rating_label: "Very accurate",
  },
  clarity_of_skills: {
    questionId: "clarity_of_skills",
    question_text: "foo",
    description: "bar",
    comment_placeholder: "baz",
    type: QuestionType.YesNo,
    show_comments_on: YesNoEnum.No,
  },
  incorrect_skills: {
    questionId: "incorrect_skills",
    question_text: "foo",
    description: "bar",
    comment_placeholder: "baz",
    type: QuestionType.YesNo,
    show_comments_on: YesNoEnum.Yes,
  },
  missing_skills: {
    questionId: "missing_skills",
    question_text: "foo",
    description: "bar",
    comment_placeholder: "baz",
    type: QuestionType.YesNo,
    show_comments_on: YesNoEnum.Yes,
  },
  interaction_ease: {
    questionId: "interaction_ease",
    question_text: "foo",
    description: "bar",
    comment_placeholder: "baz",
    type: QuestionType.Rating,
    low_rating_label: "Very difficult",
    high_rating_label: "Very easy",
    max_rating: 5,
    display_rating: true,
  },
  recommendation: {
    questionId: "recommendation",
    question_text: "foo",
    description: "bar",
    comment_placeholder: null,
    type: QuestionType.Rating,
    low_rating_label: "Unlikely",
    high_rating_label: "Likely",
    max_rating: 5,
    display_rating: true,
  },
  additional_feedback: {
    questionId: "additional_feedback",
    question_text: "foo",
    description: "bar",
    comment_placeholder: "baz",
    type: QuestionType.Rating,
    display_rating: false,
  },
});

// Test component that uses the feedback context
const TestComponent: React.FC = () => {
  const { questionsConfig, setQuestionsConfig } = useFeedback();
  return (
    <div>
      <div data-testid="config-status">
        {questionsConfig ? "Config loaded" : "No config"}
      </div>
      <button
        data-testid="set-config-button"
        onClick={() => setQuestionsConfig(getTestQuestionsConfig())}
      >
        Set Config
      </button>
    </div>
  );
};

describe("FeedbackContext", () => {
  test("should provide initial null questionsConfig", () => {
    // WHEN rendering a component that uses the feedback context
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    );

    // THEN expect the initial config status to be "No config"
    expect(screen.getByTestId("config-status")).toHaveTextContent("No config");
  });

  test("should update questionsConfig when setQuestionsConfig is called", async () => {
    // WHEN rendering a component that uses the feedback context
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    );

    // AND clicking the set config button
    screen.getByTestId("set-config-button").click();

    // THEN expect the config status to be "Config loaded"
    await waitFor(() => {
      expect(screen.getByTestId("config-status")).toHaveTextContent("Config loaded");
    });
  });

  test("should throw error when useFeedback is used outside of FeedbackProvider", () => {
    // GIVEN a component that uses the feedback context without a provider
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    // WHEN rendering the component
    expect(() => {
      render(<TestComponent />);
    }).toThrow("useFeedback must be used within a FeedbackProvider");

    // THEN expect the error to be logged
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
}); 
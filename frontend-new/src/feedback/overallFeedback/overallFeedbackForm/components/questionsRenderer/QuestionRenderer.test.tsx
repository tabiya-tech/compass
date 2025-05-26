// mute the console
import "src/_test_utilities/consoleMock";

import { fireEvent } from "@testing-library/react";
import { render, screen } from "src/_test_utilities/test-utils";
import QuestionRenderer, {
  DATA_TEST_ID,
} from "src/feedback/overallFeedback/overallFeedbackForm/components/questionsRenderer/QuestionRenderer";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { Question, QuestionType, RatingQuestion, CheckboxQuestionType, YesNoQuestion, YesNoEnum } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.types";
import {
  DATA_TEST_ID as CUSTOM_RATING_DATA_TEST_ID,
} from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionTypes/customRating/CustomRating";
import {
  DATA_TEST_ID as YES_NO_QUESTION_DATA_TEST_ID,
} from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionTypes/yesNoQuestion/YesNoQuestion";
import {
  DATA_TEST_ID as CHECKBOX_QUESTION_DATA_TEST_ID,
} from "src/feedback/overallFeedback/overallFeedbackForm/components/formContent/questionTypes/checkboxQuestion/CheckboxQuestion";

describe("QuestionRenderer", () => {
  const getMockQuestion = <T extends QuestionType>(questionType: T): Question => {
    const baseQuestion = {
      question_id: "q1",
      type: questionType,
      question_text: "Select options",
      description: "Test description",
      comment_placeholder: "Please provide comments",
    };

    switch (questionType) {
      case QuestionType.Rating:
        return {
          ...baseQuestion,
          type: QuestionType.Rating,
          max_rating: 5,
          low_rating_label: "Low",
          high_rating_label: "High",
        } as RatingQuestion;
      case QuestionType.Checkbox:
        return {
          ...baseQuestion,
          type: QuestionType.Checkbox,
          options: {
            option1: "option1",
            option2: "option2"
          }
        } as CheckboxQuestionType;
      case QuestionType.YesNo:
        return {
          ...baseQuestion,
          type: QuestionType.YesNo,
          show_comments_on: YesNoEnum.Yes,
        } as YesNoQuestion;
      default:
        throw new Error(`Unsupported question type: ${questionType}`);
    }
  };

  const mockAnswers: FeedbackItem[] = [
    { question_id: "q1", simplified_answer: { selected_options_keys: ["option1"] } },
    { question_id: "q2", simplified_answer: { rating_numeric: 3 } },
    { question_id: "q3", simplified_answer: { rating_boolean: true, comment: "Yes comment" }},
  ];

  const mockOnChange = jest.fn();

  test.each([
    [QuestionType.Checkbox],
    [QuestionType.Rating],
    [QuestionType.YesNo],
  ])("should render %s component successfully", (givenQuestionType) => {
    // Given the component
    const givenStepsComponent = (
      <QuestionRenderer question={getMockQuestion(givenQuestionType)} feedbackItems={mockAnswers} onChange={mockOnChange} />
    );

    // When the component is rendered
    render(givenStepsComponent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND expect the component to be in the document
    const stepsComponent = screen.getByTestId(DATA_TEST_ID.QUESTION_RENDERER);
    expect(stepsComponent).toBeInTheDocument();
    // AND the rating question to be in the document
    const testIdMap = {
      [QuestionType.YesNo]: YES_NO_QUESTION_DATA_TEST_ID.FORM_CONTROL,
      [QuestionType.Checkbox]: CHECKBOX_QUESTION_DATA_TEST_ID.FORM_CONTROL,
      [QuestionType.Rating]: CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_CONTAINER,
    };
    expect(screen.getByTestId(testIdMap[givenQuestionType])).toBeInTheDocument();
    expect(stepsComponent).toMatchSnapshot();
  });

  test("should call onChange when checkbox question is answered", () => {
    // Given the component is rendered
    render(<QuestionRenderer question={getMockQuestion(QuestionType.Checkbox)} feedbackItems={mockAnswers} onChange={mockOnChange} />);

    // When the checkbox question is answered
    const checkbox = screen.getAllByTestId(CHECKBOX_QUESTION_DATA_TEST_ID.CHECKBOX_OPTION)[0];
    fireEvent.click(checkbox);

    // Then expect onChange to be called
    expect(mockOnChange).toHaveBeenCalled();
  });

  test("should call onChange when rating question is answered", () => {
    // Given the component is rendered
    render(<QuestionRenderer question={getMockQuestion(QuestionType.Rating)} feedbackItems={mockAnswers} onChange={mockOnChange} />);

    // When the rating question is answered
    const starsIcon = screen.getAllByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_ICON)[4];
    fireEvent.click(starsIcon);

    // Then expect onChange to be called
    expect(mockOnChange).toHaveBeenCalled();
  });

  test("should call onChange when yes/no question is answered", () => {
    // Given the component is rendered
    render(<QuestionRenderer question={getMockQuestion(QuestionType.YesNo)} feedbackItems={mockAnswers} onChange={mockOnChange} />);

    // When the yes/no question is answered
    const radioNo = screen.getByTestId(YES_NO_QUESTION_DATA_TEST_ID.RADIO_NO);
    fireEvent.click(radioNo);

    // Then expect onChange to be called
    expect(mockOnChange).toHaveBeenCalled();
  });
});

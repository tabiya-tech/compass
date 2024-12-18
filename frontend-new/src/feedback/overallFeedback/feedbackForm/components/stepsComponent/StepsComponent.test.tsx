// mute the console
import "src/_test_utilities/consoleMock";

import { fireEvent } from "@testing-library/react";
import { render, screen } from "src/_test_utilities/test-utils";
import StepsComponent, {
  DATA_TEST_ID,
} from "src/feedback/overallFeedback/feedbackForm/components/stepsComponent/StepsComponent";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import {
  DetailedQuestion,
  QuestionType,
  YesNoEnum,
} from "src/feedback/overallFeedback/feedbackForm/feedbackForm.types";
import { DATA_TEST_ID as CUSTOM_RATING_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/customRating/CustomRating";
import { DATA_TEST_ID as YES_NO_QUESTION_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/yesNoQuestion/YesNoQuestion";
import { DATA_TEST_ID as CHECKBOX_QUESTION_DATA_TEST_ID } from "src/feedback/overallFeedback/feedbackForm/components/checkboxQuestion/CheckboxQuestion";

describe("StepsComponent", () => {
  const mockQuestions: DetailedQuestion[] = [
    {
      questionId: "q1",
      type: QuestionType.Checkbox,
      questionText: "Select options",
      options: [
        { key: "option1", value: "option1" },
        { key: "option2", value: "option2" },
      ],
    },
    {
      questionId: "q2",
      type: QuestionType.Rating,
      questionText: "Rate this",
      displayRating: true,
      lowRatingLabel: "Low",
      highRatingLabel: "High",
      maxRating: 5,
    },
    {
      questionId: "q3",
      type: QuestionType.YesNo,
      questionText: "Yes or No?",
      showCommentsOn: YesNoEnum.Yes,
    },
  ];

  const mockAnswers: FeedbackItem[] = [
    { question_id: "q1", answer: { selected_options: ["option1"] }, is_answered: true },
    { question_id: "q2", answer: { rating_numeric: 3 }, is_answered: true },
    { question_id: "q3", answer: { rating_boolean: true, comment: "Yes comment" }, is_answered: true },
  ];

  const mockOnChange = jest.fn();

  test("should render component successfully", () => {
    // Given the component
    const givenStepsComponent = (
      <StepsComponent questions={mockQuestions} feedbackItems={mockAnswers} onChange={mockOnChange} />
    );

    // When the component is rendered
    render(givenStepsComponent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND expect the component to be in the document
    const stepsComponent = screen.getByTestId(DATA_TEST_ID.STEPS_COMPONENT);
    expect(stepsComponent).toBeInTheDocument();
    // AND the rating question to be in the document
    expect(screen.getByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_CONTAINER)).toBeInTheDocument();
    // AND the yes/no question to be in the document
    expect(screen.getByTestId(YES_NO_QUESTION_DATA_TEST_ID.FORM_CONTROL)).toBeInTheDocument();
    // AND the checkbox question to be in the document
    expect(screen.getByTestId(CHECKBOX_QUESTION_DATA_TEST_ID.FORM_CONTROL)).toBeInTheDocument();
    // AND to match the snapshot
    expect(stepsComponent).toMatchSnapshot();
  });

  test("should call onChange when checkbox question is answered", () => {
    // Given the component is rendered
    render(<StepsComponent questions={mockQuestions} feedbackItems={mockAnswers} onChange={mockOnChange} />);

    // When the checkbox question is answered
    const checkbox = screen.getAllByTestId(CHECKBOX_QUESTION_DATA_TEST_ID.CHECKBOX_OPTION)[0];
    fireEvent.click(checkbox);

    // Then expect onChange to be called
    expect(mockOnChange).toHaveBeenCalled();
  });

  test("should call onChange when rating question is answered", () => {
    // Given the component is rendered
    render(<StepsComponent questions={mockQuestions} feedbackItems={mockAnswers} onChange={mockOnChange} />);

    // When the rating question is answered
    const starsIcon = screen.getAllByTestId(CUSTOM_RATING_DATA_TEST_ID.CUSTOM_RATING_ICON)[4];
    fireEvent.click(starsIcon);

    // Then expect onChange to be called
    expect(mockOnChange).toHaveBeenCalled();
  });

  test("should call onChange when yes/no question is answered", () => {
    // Given the component is rendered
    render(<StepsComponent questions={mockQuestions} feedbackItems={mockAnswers} onChange={mockOnChange} />);

    // When the yes/no question is answered
    const radioNo = screen.getByTestId(YES_NO_QUESTION_DATA_TEST_ID.RADIO_NO);
    fireEvent.click(radioNo);

    // Then expect onChange to be called
    expect(mockOnChange).toHaveBeenCalled();
  });
});

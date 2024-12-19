// mute the console
import "src/_test_utilities/consoleMock";

import { fireEvent } from "@testing-library/react";
import { render, screen } from "src/_test_utilities/test-utils";
import { FeedbackItem } from "src/feedback/feedbackForm/feedbackFormService/feedbackFormService.types";
import FeedbackFormFooter, {
  DATA_TEST_ID,
} from "src/feedback/feedbackForm/components/feedbackFormButton/FeedbackFormFooter";

// mock the PersistentStorageService
jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => {
  const mockUserFeedback: FeedbackItem = {
    question_id: "recommendation",
    answer: {
      rating_numeric: 7,
    },
    is_answered: true,
  };
  return {
    __esModule: true,
    PersistentStorageService: {
      getItem: jest.fn().mockReturnValue(JSON.stringify([mockUserFeedback])),
    },
  };
});

describe("FeedbackFormFooter", () => {
  test("should render component successfully", () => {
    // GIVEN a FeedbackFormFooter component
    const givenComponent = <FeedbackFormFooter notifyOpenFeedbackForm={jest.fn()} />;

    // WHEN the component is rendered
    render(givenComponent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the feedback form button container to be displayed
    const feedbackFormFooterContainer = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_FOOTER_BUTTON);
    expect(feedbackFormFooterContainer).toBeInTheDocument();
    // AND the feedback form button to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_FOOTER_BUTTON)).toBeInTheDocument();
    // AND the component to match the snapshot
    expect(feedbackFormFooterContainer).toMatchSnapshot();
  });

  test("should display 'Continue with feedback' when feedback has been saved", () => {
    // GIVEN a FeedbackFormFooter component
    const givenComponent = <FeedbackFormFooter notifyOpenFeedbackForm={jest.fn()} />;

    // WHEN the component is rendered
    render(givenComponent);
    // AND the feedback has been saved

    // THEN expect the feedback button to display 'Continue with feedback'
    const feedbackButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_FOOTER_BUTTON);
    expect(feedbackButton).toHaveTextContent("Continue with feedback");
  });

  test("should call notifyOpenFeedbackForm when feedback button is clicked", () => {
    // GIVEN a FeedbackFormFooter component
    const notifyOpenFeedbackForm = jest.fn();
    const givenComponent = <FeedbackFormFooter notifyOpenFeedbackForm={notifyOpenFeedbackForm} />;

    // WHEN the component is rendered
    render(givenComponent);

    // WHEN the feedback button is clicked
    const feedbackButton = screen.getByTestId(DATA_TEST_ID.FEEDBACK_FORM_FOOTER_BUTTON);
    fireEvent.click(feedbackButton);

    // THEN expect notifyOpenFeedbackForm to have been called
    expect(notifyOpenFeedbackForm).toHaveBeenCalled();
  });
});

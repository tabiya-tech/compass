//silence chatty console logs
import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, fireEvent } from "src/_test_utilities/test-utils";
import { FeedbackProvider, useFeedback } from "src/feedback/overallFeedback/feedbackContext/FeedbackContext";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { mockQuestionsConfig } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.test.utils";

// Mock the persistent storage service
jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => ({
  PersistentStorageService: {
    getOverallFeedback: jest.fn(),
    setOverallFeedback: jest.fn(),
    clearOverallFeedback: jest.fn(),
  },
}));

// Test component that uses the feedback context
const TestComponent: React.FC = () => {
  const { questionsConfig, setQuestionsConfig, answers, handleAnswerChange, clearAnswers } = useFeedback();
  return (
    <div>
      <div data-testid="config-status">
        {questionsConfig ? "Config loaded" : "No config"}
      </div>
      <button
        data-testid="set-config-button"
        onClick={() => setQuestionsConfig(mockQuestionsConfig)}
      >
        Set Config
      </button>
      <div data-testid="answers-count">
        {answers.length} answers
      </div>
      <button
        data-testid="add-answer-button"
        onClick={() => handleAnswerChange({ 
          question_id: "test", 
          simplified_answer: { 
            rating_numeric: 5,
            comment: "test comment"
          } 
        })}
      >
        Add Answer
      </button>
      <button
        data-testid="clear-answers-button"
        onClick={clearAnswers}
      >
        Clear Answers
      </button>
    </div>
  );
};

describe("FeedbackContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PersistentStorageService.getOverallFeedback as jest.Mock).mockReturnValue([]);
  });

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

  test("should initialize answers from persistent storage", () => {
    // GIVEN some existing feedback in persistent storage
    const mockFeedback: FeedbackItem[] = [
      { 
        question_id: "test1", 
        simplified_answer: { 
          rating_numeric: 5,
          comment: "test comment 1"
        } 
      },
      { 
        question_id: "test2", 
        simplified_answer: { 
          rating_numeric: 4,
          comment: "test comment 2"
        } 
      }
    ];
    (PersistentStorageService.getOverallFeedback as jest.Mock).mockReturnValue(mockFeedback);

    // WHEN rendering a component that uses the feedback context
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    );

    // THEN expect the answers count to be 2
    expect(screen.getByTestId("answers-count")).toHaveTextContent("2 answers");
  });

  test("should handle adding a new answer", () => {
    // WHEN rendering a component that uses the feedback context
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    );

    // AND clicking the add answer button
    fireEvent.click(screen.getByTestId("add-answer-button"));

    // THEN expect the answers count to be 1
    expect(screen.getByTestId("answers-count")).toHaveTextContent("1 answers");
    // AND expect the persistent storage to be updated
    expect(PersistentStorageService.setOverallFeedback).toHaveBeenCalledWith([
      { 
        question_id: "test", 
        simplified_answer: { 
          rating_numeric: 5,
          comment: "test comment"
        } 
      }
    ]);
  });

  test("should handle updating an existing answer", () => {
    // GIVEN an existing answer in the context
    const mockFeedback: FeedbackItem[] = [
      { 
        question_id: "test", 
        simplified_answer: { 
          rating_numeric: 3,
          comment: "old comment"
        } 
      }
    ];
    (PersistentStorageService.getOverallFeedback as jest.Mock).mockReturnValue(mockFeedback);

    // WHEN rendering a component that uses the feedback context
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    );

    // AND clicking the add answer button to update the existing answer
    fireEvent.click(screen.getByTestId("add-answer-button"));

    // THEN expect the answers count to still be 1
    expect(screen.getByTestId("answers-count")).toHaveTextContent("1 answers");
    // AND expect the persistent storage to be updated with the new answer
    expect(PersistentStorageService.setOverallFeedback).toHaveBeenCalledWith([
      { 
        question_id: "test", 
        simplified_answer: { 
          rating_numeric: 5,
          comment: "test comment"
        } 
      }
    ]);
  });

  test("should handle clearing answers", () => {
    // GIVEN some existing answers in the context
    const mockFeedback: FeedbackItem[] = [
      { 
        question_id: "test1", 
        simplified_answer: { 
          rating_numeric: 5,
          comment: "test comment 1"
        } 
      },
      { 
        question_id: "test2", 
        simplified_answer: { 
          rating_numeric: 4,
          comment: "test comment 2"
        } 
      }
    ];
    (PersistentStorageService.getOverallFeedback as jest.Mock).mockReturnValue(mockFeedback);

    // WHEN rendering a component that uses the feedback context
    render(
      <FeedbackProvider>
        <TestComponent />
      </FeedbackProvider>
    );

    // AND clicking the clear answers button
    fireEvent.click(screen.getByTestId("clear-answers-button"));

    // THEN expect the answers count to be 0
    expect(screen.getByTestId("answers-count")).toHaveTextContent("0 answers");
    // AND expect the persistent storage to be cleared
    expect(PersistentStorageService.clearOverallFeedback).toHaveBeenCalled();
  });
}); 
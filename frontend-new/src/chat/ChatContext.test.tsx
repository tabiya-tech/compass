// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, renderHook } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { ChatProvider, useChatContext } from "./ChatContext";
import { FeedbackStatus } from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";

describe("ChatContext", () => {
  const mockHandleOpenExperiencesDrawer = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ChatProvider", () => {
    test("should render children and provide context values", () => {
      // GIVEN a child component that uses the context
      const TestChild = () => {
        const { feedbackStatus, handleOpenExperiencesDrawer } = useChatContext();
        return (
          <div data-testid="test-child">
            <span data-testid="feedback-status">{feedbackStatus}</span>
            <button data-testid="drawer-button" onClick={handleOpenExperiencesDrawer}>
              Open Drawer
            </button>
          </div>
        );
      };

      // WHEN the provider is rendered with the child
      render(
        <ChatProvider handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}>
          <TestChild />
        </ChatProvider>
      );

      // THEN expect the child to be rendered
      const child = screen.getByTestId("test-child");
      expect(child).toBeInTheDocument();

      // AND expect the initial feedback status to be NOT_STARTED
      const feedbackStatus = screen.getByTestId("feedback-status");
      expect(feedbackStatus.textContent).toBe(FeedbackStatus.NOT_STARTED);
    });
  });

  describe("useChatContext", () => {
    test("should throw error when used outside provider", () => {
      // GIVEN a component that uses the context
      const TestComponent = () => {
        useChatContext();
        return null;
      };

      // WHEN the component is rendered without the provider
      // THEN expect it to throw an error
      expect(() => render(<TestComponent />)).toThrow(
        "useChatContext must be used within a ChatProvider"
      );
    });

    test("should update feedback status", () => {
      // GIVEN the hook is rendered within the provider
      const { result } = renderHook(() => useChatContext(), {
        wrapper: ({ children }) => (
          <ChatProvider handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}>
            {children}
          </ChatProvider>
        ),
      });

      // WHEN the feedback status is updated
      act(() => {
        result.current.setFeedbackStatus(FeedbackStatus.SUBMITTED);
      });

      // THEN expect the feedback status to be updated
      expect(result.current.feedbackStatus).toBe(FeedbackStatus.SUBMITTED);
    });

    test("should call handleOpenExperiencesDrawer", () => {
      // GIVEN the hook is rendered within the provider
      const { result } = renderHook(() => useChatContext(), {
        wrapper: ({ children }) => (
          <ChatProvider handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}>
            {children}
          </ChatProvider>
        ),
      });

      // WHEN handleOpenExperiencesDrawer is called
      act(() => {
        result.current.handleOpenExperiencesDrawer();
      });

      // THEN expect the mock function to be called
      expect(mockHandleOpenExperiencesDrawer).toHaveBeenCalled();
    });
  });
}); 
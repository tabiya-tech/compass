// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatProvider, useChatContext } from "./ChatContext";
import { FeedbackStatus } from "src/feedback/overallFeedback/feedbackForm/FeedbackForm";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { IChatMessage } from "src/chat/Chat.types";
import { ChatMessageType } from "src/chat/Chat.types";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

// Mock PersistentStorageService
jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => ({
  PersistentStorageService: {
    getAccountConverted: jest.fn(),
    setAccountConverted: jest.fn(),
  },
}));

describe("ChatContext", () => {
  const mockHandleOpenExperiencesDrawer = jest.fn();
  const mockRemoveMessage = jest.fn();
  const mockAddMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (PersistentStorageService.getAccountConverted as jest.Mock).mockReturnValue(false);
  });

  const TestComponent = () => {
    const {
      handleOpenExperiencesDrawer,
      removeMessage,
      addMessage,
      feedbackStatus,
      setFeedbackStatus,
      isAccountConverted,
      setIsAccountConverted,
    } = useChatContext();

    return (
      <div>
        <button onClick={() => handleOpenExperiencesDrawer()}>Open Drawer</button>
        <button onClick={() => removeMessage("test-message")}>Remove Message</button>
        <button onClick={() => addMessage({
          message_id: "test-message",
          message: "Test message",
          sender: ConversationMessageSender.COMPASS,
          sent_at: new Date().toISOString(),
          type: ChatMessageType.BASIC_CHAT,
          reaction: null
        })}>Add Message</button>
        <button onClick={() => setFeedbackStatus(FeedbackStatus.SUBMITTED)}>Set Feedback</button>
        <button onClick={() => setIsAccountConverted(true)}>Convert Account</button>
        <div data-testid="feedback-status">{feedbackStatus}</div>
        <div data-testid="account-converted">{isAccountConverted.toString()}</div>
      </div>
    );
  };

  it("should provide context values to children", () => {
    render(
      <ChatProvider
        handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}
        removeMessage={mockRemoveMessage}
        addMessage={mockAddMessage}
      >
        <TestComponent />
      </ChatProvider>
    );

    expect(screen.getByTestId("feedback-status")).toHaveTextContent(FeedbackStatus.NOT_STARTED);
    expect(screen.getByTestId("account-converted")).toHaveTextContent("false");
  });

  it("should call handleOpenExperiencesDrawer when button is clicked", async () => {
    render(
      <ChatProvider
        handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}
        removeMessage={mockRemoveMessage}
        addMessage={mockAddMessage}
      >
        <TestComponent />
      </ChatProvider>
    );

    fireEvent.click(screen.getByText("Open Drawer"));
    expect(mockHandleOpenExperiencesDrawer).toHaveBeenCalled();
  });

  it("should call removeMessage when button is clicked", () => {
    render(
      <ChatProvider
        handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}
        removeMessage={mockRemoveMessage}
        addMessage={mockAddMessage}
      >
        <TestComponent />
      </ChatProvider>
    );

    fireEvent.click(screen.getByText("Remove Message"));
    expect(mockRemoveMessage).toHaveBeenCalledWith("test-message");
  });

  it("should call addMessage when button is clicked", () => {
    const testMessage: IChatMessage = {
      message_id: "test-message",
      message: "Test message",
      sender: ConversationMessageSender.COMPASS,
      sent_at: new Date().toISOString(),
      type: ChatMessageType.BASIC_CHAT,
      reaction: null
    };

    render(
      <ChatProvider
        handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}
        removeMessage={mockRemoveMessage}
        addMessage={mockAddMessage}
      >
        <TestComponent />
      </ChatProvider>
    );

    fireEvent.click(screen.getByText("Add Message"));
    expect(mockAddMessage).toHaveBeenCalledWith(testMessage);
  });

  it("should update feedback status when setFeedbackStatus is called", () => {
    render(
      <ChatProvider
        handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}
        removeMessage={mockRemoveMessage}
        addMessage={mockAddMessage}
      >
        <TestComponent />
      </ChatProvider>
    );

    fireEvent.click(screen.getByText("Set Feedback"));
    expect(screen.getByTestId("feedback-status")).toHaveTextContent(FeedbackStatus.SUBMITTED);
  });

  it("should update account converted status and persist it", () => {
    render(
      <ChatProvider
        handleOpenExperiencesDrawer={mockHandleOpenExperiencesDrawer}
        removeMessage={mockRemoveMessage}
        addMessage={mockAddMessage}
      >
        <TestComponent />
      </ChatProvider>
    );

    fireEvent.click(screen.getByText("Convert Account"));
    expect(screen.getByTestId("account-converted")).toHaveTextContent("true");
    expect(PersistentStorageService.setAccountConverted).toHaveBeenCalledWith(true);
  });

  it("should throw error when useChatContext is used outside provider", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow("useChatContext must be used within a ChatProvider");
    consoleError.mockRestore();
  });
}); 
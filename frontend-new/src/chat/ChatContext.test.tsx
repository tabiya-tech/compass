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
import CompassChatMessage from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";

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
  const FIXED_TIMESTAMP = "2025-05-09T15:17:09.080Z";

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

    const messageData = {
      message_id: "test-message",
      message: "Test message",
      sender: ConversationMessageSender.COMPASS,
      sent_at: FIXED_TIMESTAMP,
      type: ChatMessageType.BASIC_CHAT,
      reaction: null
    };

    return (
      <div>
        <button onClick={() => handleOpenExperiencesDrawer()}>Open Drawer</button>
        <button onClick={() => removeMessage("test-message")}>Remove Message</button>
        <button onClick={() => addMessage({
          ...messageData,
          component: <CompassChatMessage chatMessage={messageData} />
        })}>Add Message</button>
        <button onClick={() => setFeedbackStatus(FeedbackStatus.SUBMITTED)}>Set Feedback</button>
        <button onClick={() => setIsAccountConverted(true)}>Convert Account</button>
        <div data-testid="feedback-status">{feedbackStatus}</div>
        <div data-testid="account-converted">{isAccountConverted.toString()}</div>
      </div>
    );
  };

  test("should provide context values to children", () => {
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

  test("should call handleOpenExperiencesDrawer when button is clicked", async () => {
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

  test("should call removeMessage when button is clicked", () => {
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

  test("should call addMessage when button is clicked", () => {
    const messageData = {
      message_id: "test-message",
      sender: ConversationMessageSender.COMPASS,
      message: "Test message",
      sent_at: FIXED_TIMESTAMP,
      type: ChatMessageType.BASIC_CHAT,
      reaction: null
    };
    const givenMessage: IChatMessage = {
      ...messageData,
      component: <CompassChatMessage chatMessage={messageData} />
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
    expect(mockAddMessage).toHaveBeenCalledWith(givenMessage);
  });

  test("should update feedback status when setFeedbackStatus is called", () => {
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

  test("should update account converted status and persist it", () => {
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

  test("should throw error when useChatContext is used outside provider", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow("useChatContext must be used within a ChatProvider");
    consoleError.mockRestore();
  });
}); 
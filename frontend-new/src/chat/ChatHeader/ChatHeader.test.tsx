import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";
import "src/_test_utilities/sentryMock";

import ChatHeader, { DATA_TEST_ID } from "./ChatHeader";
import { fireEvent, render, screen, waitFor } from "src/_test_utilities/test-utils";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import { ChatProvider } from "src/chat/ChatContext";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import * as Sentry from "@sentry/react";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import React from "react";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { FEEDBACK_NOTIFICATION_DELAY } from "src/chat/Chat";
import { SessionError } from "src/error/commonErrors";

jest.mock("src/app/PersistentStorageService/PersistentStorageService");

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return { ...actual, __esModule: true, useNavigate: jest.fn().mockReturnValue(jest.fn()) };
});

jest.mock("src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ logout: jest.fn() })),
}));

jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({ enqueueSnackbar: jest.fn(), closeSnackbar: jest.fn() }),
  };
});

const defaultProps = {
  experiencesExplored: 0,
  exploredExperiencesNotification: false,
  setExploredExperiencesNotification: jest.fn(),
  conversationCompleted: false,
  progressPercentage: 0,
  timeUntilNotification: null as number | null,
};

const renderWithChatProvider = (ui: React.ReactNode) => {
  return render(
    <ChatProvider
      handleOpenExperiencesDrawer={jest.fn()}
      removeMessageFromChat={jest.fn()}
      addMessageToChat={jest.fn()}
    >
      {ui}
    </ChatProvider>
  );
};

const mockUser = (user: { id: string; name: string; email: string } | null) => {
  jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(user);
};

describe("ChatHeader", () => {
  beforeEach(() => {
    (Sentry.isInitialized as jest.Mock).mockReturnValue(false);
    resetAllMethodMocks(UserPreferencesStateService.getInstance());
    jest.clearAllMocks();
  });

  test("should render the header container", () => {
    // GIVEN a logged-in user
    mockUser({ id: "123", name: "Foo Bar", email: "foo@bar.baz" });

    // WHEN the component is rendered
    renderWithChatProvider(<ChatHeader {...defaultProps} />);

    // THEN the header container is present
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_CONTAINER)).toBeInTheDocument();
  });

  describe("feedback reminder (30-min snackbar)", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(PersistentStorageService, "hasSeenFeedbackNotification").mockReturnValue(false);
      jest.spyOn(PersistentStorageService, "setSeenFeedbackNotification").mockImplementation();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test("should not show notification when user is not logged in", () => {
      // GIVEN the user is not logged in
      mockUser(null);

      // WHEN the component is rendered with a notification delay
      renderWithChatProvider(
        <ChatHeader
          {...defaultProps}
          conversationCompleted={false}
          progressPercentage={50}
          timeUntilNotification={FEEDBACK_NOTIFICATION_DELAY}
        />
      );
      jest.advanceTimersByTime(FEEDBACK_NOTIFICATION_DELAY);

      // THEN no snackbar is shown and we log a session error
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(new SessionError("User is not available"));
    });

    test("should show notification after delay when progress <= 66%", () => {
      // GIVEN a logged-in user with progress <= 66%
      mockUser({ id: "123", name: "Foo Bar", email: "foo@bar.baz" });

      // WHEN the component is rendered
      renderWithChatProvider(
        <ChatHeader
          {...defaultProps}
          conversationCompleted={false}
          progressPercentage={50}
          timeUntilNotification={FEEDBACK_NOTIFICATION_DELAY}
        />
      );
      jest.advanceTimersByTime(FEEDBACK_NOTIFICATION_DELAY);

      // THEN a persistent info snackbar is shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledTimes(1);
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          variant: "info",
          persist: true,
          autoHideDuration: null,
          preventDuplicate: true,
        })
      );
    });

    test("should not show notification when progress > 66%", () => {
      // GIVEN a logged-in user with progress > 66%
      mockUser({ id: "123", name: "", email: "" });

      // WHEN the component is rendered
      renderWithChatProvider(
        <ChatHeader
          {...defaultProps}
          conversationCompleted={false}
          progressPercentage={70}
          timeUntilNotification={FEEDBACK_NOTIFICATION_DELAY}
        />
      );
      jest.advanceTimersByTime(FEEDBACK_NOTIFICATION_DELAY);

      // THEN no snackbar is shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
    });

    test("should not show notification when already seen for user", () => {
      // GIVEN a logged-in user who has already seen the notification
      mockUser({ id: "123", name: "", email: "" });
      jest.spyOn(PersistentStorageService, "hasSeenFeedbackNotification").mockReturnValue(true);

      // WHEN the component is rendered (immediate notification)
      renderWithChatProvider(
        <ChatHeader {...defaultProps} conversationCompleted={false} progressPercentage={50} timeUntilNotification={0} />
      );

      // THEN no snackbar is shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
    });

    test("should mark notification as seen when the feedback link is clicked", async () => {
      // GIVEN a logged-in user and Sentry is initialized
      const user = { id: "123", name: "Foo Bar", email: "foo@bar.baz" };
      mockUser(user);
      (Sentry.isInitialized as jest.Mock).mockReturnValue(true);
      const setSeenSpy = jest.spyOn(PersistentStorageService, "setSeenFeedbackNotification").mockImplementation();

      // WHEN the component is rendered and the snackbar link is clicked
      renderWithChatProvider(
        <ChatHeader {...defaultProps} conversationCompleted={false} progressPercentage={50} timeUntilNotification={0} />
      );
      jest.advanceTimersByTime(0);

      const [snackbarContent] = (useSnackbar().enqueueSnackbar as jest.Mock).mock.calls[0];
      render(snackbarContent);
      fireEvent.click(screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_FEEDBACK_LINK));

      // THEN the notification is marked as seen for the user
      await waitFor(() => expect(setSeenSpy).toHaveBeenCalledWith(user.id));
    });
  });
});

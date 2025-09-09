// mute the console
import "src/_test_utilities/consoleMock";
// standard sentry mock
import "src/_test_utilities/sentryMock";

import ChatHeader, { DATA_TEST_ID, FEEDBACK_FORM_TEXT, MENU_ITEM_ID } from "./ChatHeader";
import { act, fireEvent, render, screen, userEvent, waitFor, within } from "src/_test_utilities/test-utils";
import { routerPaths } from "src/app/routerPaths";
import { testNavigateToPath } from "src/_test_utilities/routeNavigation";
import ContextMenu, { DATA_TEST_ID as CONTEXT_MENU_DATA_TEST_ID } from "src/theme/ContextMenu/ContextMenu";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { DATA_TEST_ID as ANIMATED_BADGE_DATA_TEST_ID } from "src/theme/AnimatedBadge/AnimatedBadge";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import AnonymousAccountConversionDialog, {
  DATA_TEST_ID as ANONYMOUS_ACCOUNT_CONVERSION_DIALOG_DATA_TEST_ID,
} from "src/auth/components/anonymousAccountConversionDialog/AnonymousAccountConversionDialog";
import { DATA_TEST_ID as CONFIRM_MODAL_DATA_TEST_ID } from "src/theme/confirmModalDialog/ConfirmModalDialog";
import { DATA_TEST_ID as TEXT_CONFIRM_MODAL_DIALOG_DATA_TEST_ID } from "src/theme/textConfirmModalDialog/TextConfirmModalDialog";
import { DATA_TEST_ID as INFO_DRAWER_DATA_TEST_ID } from "src/info/Info";
import { ChatProvider } from "src/chat/ChatContext";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import * as Sentry from "@sentry/react";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import React from "react";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { FEEDBACK_NOTIFICATION_DELAY } from "src/chat/Chat";
import { SessionError } from "src/error/commonErrors";
import { ConversationPhase } from "src/chat/chatProgressbar/types";
import MetricsService from "src/metrics/metricsService";
import { EventType } from "src/metrics/types";

// Mock PersistentStorageService
jest.mock("src/app/PersistentStorageService/PersistentStorageService");

// mock the ContextMenu
jest.mock("src/theme/ContextMenu/ContextMenu", () => {
  const actual = jest.requireActual("src/theme/ContextMenu/ContextMenu");
  return {
    __esModule: true,
    default: jest.fn(({ items }: { items: MenuItemConfig[] }) => (
      <div data-testid={actual.DATA_TEST_ID.MENU}>
        {items.map((item) => (
          <div key={item.id} data-testid={item.id} onClick={item.action}>
            {item.text}
          </div>
        ))}
        ;
      </div>
    )),
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

// mock the router
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    __esModule: true,
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
  };
});

// mock the SocialAuthServices
jest.mock("src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        logout: jest.fn(),
      };
    }),
  };
});

// mock the AnonymousAccountConversionDialog
jest.mock("src/auth/components/anonymousAccountConversionDialog/AnonymousAccountConversionDialog", () => {
  const actual = jest.requireActual(
    "src/auth/components/anonymousAccountConversionDialog/AnonymousAccountConversionDialog"
  );
  return {
    __esModule: true,
    ...actual,
    default: jest.fn(() => <div data-testid={actual.DATA_TEST_ID.DIALOG} />),
  };
});

// mock the snackbar
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

const renderWithChatProvider = (child: React.ReactNode) => {
  render(
    <ChatProvider handleOpenExperiencesDrawer={jest.fn} removeMessageFromChat={jest.fn} addMessageToChat={jest.fn}>
      {child}
    </ChatProvider>
  );
};

describe("ChatHeader", () => {
  beforeEach(() => {
    // set sentry as uninitialized by default
    (Sentry.isInitialized as jest.Mock).mockReturnValue(false);
    (ContextMenu as jest.Mock).mockClear();
    resetAllMethodMocks(UserPreferencesStateService.getInstance());
    jest.clearAllMocks();
  });

  test.each([
    ["exploredExperiencesNotification shown", true],
    ["exploredExperiencesNotification not shown", false],
  ])("should render the Chat Header with %s", (desc, givenExploredExperiencesNotification) => {
    // GIVEN a ChatHeader component
    const givenNotifyOnLogout = jest.fn();
    const givenStartNewConversation = jest.fn();
    const givenNumberOfExploredExperiences = 1;
    const givenChatHeader = (
      <ChatHeader
        notifyOnLogout={givenNotifyOnLogout}
        startNewConversation={givenStartNewConversation}
        experiencesExplored={givenNumberOfExploredExperiences}
        exploredExperiencesNotification={givenExploredExperiencesNotification}
        setExploredExperiencesNotification={jest.fn()}
        conversationCompleted={false}
        progressPercentage={0}
        timeUntilNotification={null}
        conversationPhase={ConversationPhase.INTRO}
        collectedExperiences={1}
      />
    );
    // AND a user is logged in
    const mockUser = { id: "123", name: "Foo Bar", email: "foo@bar.baz" };
    jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(mockUser);

    // WHEN the chat header is rendered
    renderWithChatProvider(givenChatHeader);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the chat header to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_CONTAINER)).toBeInTheDocument();
    // AND the chat header logo to be visible
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_LOGO)).toBeInTheDocument();
    // AND the Compass text to be visible
    expect(screen.getByText("Compass")).toBeInTheDocument();
    // AND the user button to be shown with the user icon
    const chatHeaderButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
    expect(chatHeaderButton).toBeInTheDocument();
    const chatHeaderUserIcon = within(chatHeaderButton).getByTestId(DATA_TEST_ID.CHAT_HEADER_ICON_USER);
    expect(chatHeaderUserIcon).toBeInTheDocument();
    // AND the experiences button to be shown with the experiences icon
    const chatHeaderExperiencesButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_EXPERIENCES);
    expect(chatHeaderExperiencesButton).toBeInTheDocument();
    const chatHeaderExperiencesIcon = within(chatHeaderExperiencesButton).getByTestId(
      DATA_TEST_ID.CHAT_HEADER_ICON_EXPERIENCES
    );
    expect(chatHeaderExperiencesIcon).toBeInTheDocument();
    // AND to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_CONTAINER)).toMatchSnapshot();
  });

  test("should show feedback button when sentry is initialized", () => {
    // GIVEN sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

    // WHEN the chat header is rendered
    const givenChatHeader = (
      <ChatHeader
        notifyOnLogout={jest.fn()}
        startNewConversation={jest.fn()}
        experiencesExplored={0}
        exploredExperiencesNotification={false}
        setExploredExperiencesNotification={jest.fn()}
        conversationCompleted={false}
        progressPercentage={0}
        timeUntilNotification={null}
        conversationPhase={ConversationPhase.INTRO}
        collectedExperiences={1}
      />
    );
    renderWithChatProvider(givenChatHeader);
    // THEN the feedback button to be shown with the feedback icon
    const chatHeaderFeedbackButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_FEEDBACK);
    expect(chatHeaderFeedbackButton).toBeInTheDocument();
    const chatHeaderFeedbackIcon = within(chatHeaderFeedbackButton).getByTestId(DATA_TEST_ID.CHAT_HEADER_ICON_FEEDBACK);
    expect(chatHeaderFeedbackIcon).toBeInTheDocument();
    // AND to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_CONTAINER)).toMatchSnapshot();
  });

  describe("chatHeader action tests", () => {
    const givenNotifyOnLogout = jest.fn();
    const givenStartNewConversation = jest.fn();
    const givenRemoveMessage = jest.fn();
    const givenAddMessage = jest.fn();
    const givenChatHeader = (
      <ChatProvider
        handleOpenExperiencesDrawer={jest.fn}
        removeMessageFromChat={givenRemoveMessage}
        addMessageToChat={givenAddMessage}
      >
        <ChatHeader
          notifyOnLogout={givenNotifyOnLogout}
          startNewConversation={givenStartNewConversation}
          experiencesExplored={0}
          exploredExperiencesNotification={true}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      </ChatProvider>
    );
    testNavigateToPath(givenChatHeader, "Compass logo", DATA_TEST_ID.CHAT_HEADER_LOGO_LINK, routerPaths.ROOT);

    test("should open the context menu when the user icon is clicked", async () => {
      // GIVEN a ChatHeader component
      const givenNotifyOnLogout = jest.fn();
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={givenNotifyOnLogout}
          startNewConversation={givenStartNewConversation}
          experiencesExplored={0}
          exploredExperiencesNotification={true}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      // AND the chat header is rendered
      renderWithChatProvider(givenChatHeader);

      // WHEN the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);

      // THEN expect the context menu to be visible
      expect(screen.getByTestId(CONTEXT_MENU_DATA_TEST_ID.MENU)).toBeInTheDocument();
      // AND the context menu to be open and anchored to the user button
      await waitFor(() => {
        expect(ContextMenu).toHaveBeenCalledWith(
          expect.objectContaining({
            anchorEl: userButton,
            open: true,
          }),
          {}
        );
      });
    });

    test("should open info drawer when the settings menu item is clicked", async () => {
      // GIVEN a ChatHeader component
      const givenNotifyOnLogout = jest.fn();
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={givenNotifyOnLogout}
          startNewConversation={givenStartNewConversation}
          experiencesExplored={0}
          exploredExperiencesNotification={true}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      // AND the chat header is rendered
      renderWithChatProvider(givenChatHeader);
      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);
      // AND the context menu is opened
      await waitFor(() => {
        expect(ContextMenu).toHaveBeenCalledWith(
          expect.objectContaining({
            anchorEl: userButton,
            open: true,
          }),
          {}
        );
      });

      // WHEN the settings menu item is clicked
      const settingsMenuItem = screen.getByTestId(MENU_ITEM_ID.SETTINGS_SELECTOR);
      await userEvent.click(settingsMenuItem);
      // AND the context menu is closed
      await waitFor(() => {
        expect(ContextMenu).toHaveBeenCalledWith(
          expect.objectContaining({
            anchorEl: null,
            open: false,
          }),
          {}
        );
      });

      // THEN expect info drawer to be opened
      const infoDrawer = screen.getByTestId(INFO_DRAWER_DATA_TEST_ID.INFO_DRAWER_CONTAINER);
      expect(infoDrawer).toBeInTheDocument();
    });

    test("should call start new conversation when the start new conversation menu item is clicked", async () => {
      // GIVEN a ChatHeader component
      const givenNotifyOnLogout = jest.fn();
      const givenStartNewConversation = jest.fn();
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={givenNotifyOnLogout}
          startNewConversation={givenStartNewConversation}
          experiencesExplored={0}
          exploredExperiencesNotification={true}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );

      // AND the chat header is rendered
      renderWithChatProvider(givenChatHeader);

      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      fireEvent.click(userButton);

      // AND the context menu is opened
      await waitFor(() => {
        expect(ContextMenu).toHaveBeenCalledWith(
          expect.objectContaining({
            anchorEl: userButton,
            open: true,
          }),
          {}
        );
      });

      // WHEN the start new conversation menu item is clicked
      const startNewConversationMenuItem = screen.getByTestId(MENU_ITEM_ID.START_NEW_CONVERSATION);
      fireEvent.click(startNewConversationMenuItem);

      // THEN expect the start new conversation function to be called
      expect(givenStartNewConversation).toHaveBeenCalled();
    });

    test("should close the context menu when notifyOnClose is called", async () => {
      // GIVEN a ChatHeader component
      const givenNotifyOnLogout = jest.fn();
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={givenNotifyOnLogout}
          startNewConversation={givenStartNewConversation}
          experiencesExplored={0}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      // AND the chat header is rendered
      renderWithChatProvider(givenChatHeader);
      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      fireEvent.click(userButton);

      // WHEN the notifyOnClose is called
      act(() => {
        const mock = (ContextMenu as jest.Mock).mock;
        mock.lastCall[0].notifyOnClose();
      });

      // THEN expect the auth menu to be closed
      /**
       - the component renders for the first time
       - then the menu is opened. 2nd render
       - then the menu is closed. 3rd render
       **/
      expect(ContextMenu).toHaveBeenNthCalledWith(3, expect.objectContaining({ anchorEl: null, open: false }), {});
    });

    test("should call notifyOnExperiencesDrawerOpen when the experiences button is clicked", async () => {
      // GIVEN a ChatHeader component
      const givenNotifyOnExperiencesDrawerOpen = jest.fn();
      const givenRemoveMessage = jest.fn();
      const givenAddMessage = jest.fn();
      // AND a logged-in user for metrics
      const mockUser = { id: "foo123", name: "Foo", email: "foo@bar" };
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(mockUser);
      const metricsSpy = jest.spyOn(MetricsService.getInstance(), "sendMetricsEvent").mockReturnValue();
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={0}
          exploredExperiencesNotification={true}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      // AND the chat header is rendered
      render(
        <ChatProvider
          handleOpenExperiencesDrawer={givenNotifyOnExperiencesDrawerOpen}
          removeMessageFromChat={givenRemoveMessage}
          addMessageToChat={givenAddMessage}
        >
          {givenChatHeader}
        </ChatProvider>
      );

      // WHEN the experiences button is clicked
      const experiencesButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_EXPERIENCES);
      fireEvent.click(experiencesButton);

      // THEN expect notifyOnExperiencesDrawerOpen to be called
      expect(givenNotifyOnExperiencesDrawerOpen).toHaveBeenCalled();
      // AND the metrics event to be sent
      expect(metricsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: EventType.UI_INTERACTION,
          user_id: mockUser.id,
          actions: ["view_experiences_and_skills"],
          element_id: DATA_TEST_ID.CHAT_HEADER_BUTTON_EXPERIENCES,
          timestamp: expect.any(String),
          relevant_experiments: {},
          details: {
            conversation_phase: ConversationPhase.INTRO,
            experiences_explored: 0,
            collected_experiences: 1,
          },
        })
      );
    });

    test("should show notification badge when new experience is explored", async () => {
      // GIVEN experience explored
      const givenExploredExperiences = 1;
      // AND the notification badge
      const givenExploredExperiencesNotification = true;

      // WHEN the component is rendered
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={givenExploredExperiences}
          exploredExperiencesNotification={givenExploredExperiencesNotification}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      renderWithChatProvider(givenChatHeader);

      // THEN expect the notification badge to be shown
      const badge = screen.getByTestId(ANIMATED_BADGE_DATA_TEST_ID.ANIMATED_BADGE);
      expect(badge).toBeInTheDocument();
      // AND the badge icon to be displayed
      const badgeIcon = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_ICON_EXPERIENCES);
      expect(badgeIcon).toBeInTheDocument();
      // AND the badge content to be displayed
      expect(screen.getByText(givenExploredExperiences)).toBeInTheDocument();
    });

    test("should close the notification badge when the experiences button is clicked", async () => {
      // GIVEN experience explored
      const givenExploredExperiences = 1;
      // AND the notification badge
      const givenExploredExperiencesNotification = false;
      // AND the notifyOnExperiencesDrawerOpen function
      const givenNotifyOnExperiencesDrawerOpen = jest.fn();
      const givenRemoveMessage = jest.fn();
      const givenAddMessage = jest.fn();
      // AND the component is rendered
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={givenExploredExperiences}
          exploredExperiencesNotification={givenExploredExperiencesNotification}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      // renderWithChatProvider(givenChatHeader);
      render(
        <ChatProvider
          handleOpenExperiencesDrawer={givenNotifyOnExperiencesDrawerOpen}
          removeMessageFromChat={givenRemoveMessage}
          addMessageToChat={givenAddMessage}
        >
          {givenChatHeader}
        </ChatProvider>
      );

      // WHEN the experiences button is clicked
      const experiencesButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_EXPERIENCES);
      userEvent.click(experiencesButton);

      // THEN expect notifyOnExperiencesDrawerOpen to be called
      await waitFor(() => {
        expect(givenNotifyOnExperiencesDrawerOpen).toHaveBeenCalled();
      });
      // AND expect the notification badge content to be hidden
      await waitFor(() => {
        expect(screen.queryByText(givenExploredExperiences)).not.toBeInTheDocument();
      });
    });

    test("should open sentry bug report form when report a bug button is clicked", async () => {
      // GIVEN the browser is online
      mockBrowserIsOnLine(true);
      // AND sentry is initialized
      (Sentry.isInitialized as jest.Mock).mockReturnValue(true);
      // AND a mock for Sentry.getFeedback
      const mockForm = {
        appendToDom: jest.fn(),
        open: jest.fn(),
      };
      const mockCreateForm = jest.fn().mockResolvedValue(mockForm);
      (Sentry.getFeedback as jest.Mock).mockReturnValue({ createForm: mockCreateForm });

      // WHEN the chat header is rendered
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={0}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      renderWithChatProvider(givenChatHeader);
      // AND the report a bug button is clicked
      const reportABugButton = screen.getByTestId(MENU_ITEM_ID.REPORT_BUG_BUTTON);
      await userEvent.click(reportABugButton);

      // THEN expect the mock create form to be called
      expect(mockCreateForm).toHaveBeenCalled();
      // AND the form should be appended to DOM and opened
      expect(mockForm.appendToDom).toHaveBeenCalled();
      expect(mockForm.open).toHaveBeenCalled();
    });

    test("should open sentry feedback form when feedback button is clicked", async () => {
      // GIVEN the browser is online
      mockBrowserIsOnLine(true);
      // AND sentry is initialized
      (Sentry.isInitialized as jest.Mock).mockReturnValue(true);
      // AND a mock for Sentry.getFeedback
      const mockForm = {
        appendToDom: jest.fn(),
        open: jest.fn(),
      };
      const mockCreateForm = jest.fn().mockResolvedValue(mockForm);
      (Sentry.getFeedback as jest.Mock).mockReturnValue({ createForm: mockCreateForm });

      // WHEN the chat header is rendered
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={0}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      renderWithChatProvider(givenChatHeader);
      // AND the sentry feedback button is clicked
      const feedbackButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_FEEDBACK);
      await userEvent.click(feedbackButton);

      // THEN expect the create form to be called with the correct parameters
      expect(mockCreateForm).toHaveBeenCalledWith({
        formTitle: FEEDBACK_FORM_TEXT.TITLE,
        messagePlaceholder: FEEDBACK_FORM_TEXT.MESSAGE_PLACEHOLDER,
        submitButtonLabel: FEEDBACK_FORM_TEXT.SUBMIT_BUTTON_LABEL,
        successMessageText: FEEDBACK_FORM_TEXT.SUCCESS_MESSAGE,
        enableScreenshot: false,
      });
      // AND the form should be appended to DOM and opened
      expect(mockForm.appendToDom).toHaveBeenCalled();
      expect(mockForm.open).toHaveBeenCalled();
    });
  });

  describe("context menu item tests", () => {
    test.each([
      ["online", true],
      ["offline", false],
    ])(
      "should render the context menu with the correct menu items when browser is %s",
      async (_description, browserIsOnline) => {
        mockBrowserIsOnLine(browserIsOnline);
        // GIVEN a ChatHeader component
        const givenNotifyOnLogout = jest.fn();
        const givenStartNewConversation = jest.fn();
        const givenChatHeader = (
          <ChatHeader
            notifyOnLogout={givenNotifyOnLogout}
            startNewConversation={givenStartNewConversation}
            experiencesExplored={0}
            exploredExperiencesNotification={false}
            setExploredExperiencesNotification={jest.fn()}
            conversationCompleted={false}
            progressPercentage={0}
            timeUntilNotification={null}
            conversationPhase={ConversationPhase.INTRO}
            collectedExperiences={1}
          />
        );
        // AND the chat header is rendered
        renderWithChatProvider(givenChatHeader);
        // AND the user button is clicked
        const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
        fireEvent.click(userButton);

        // THEN expect the context menu to be visible
        await waitFor(() => {
          expect(ContextMenu).toHaveBeenCalledWith(
            expect.objectContaining({
              anchorEl: userButton,
              open: true,
              items: expect.arrayContaining([
                expect.objectContaining({
                  id: MENU_ITEM_ID.START_NEW_CONVERSATION,
                  text: "start new conversation",
                  disabled: !browserIsOnline,
                }),
                expect.objectContaining({
                  id: MENU_ITEM_ID.SETTINGS_SELECTOR,
                  text: "settings",
                  disabled: !browserIsOnline,
                }),
                expect.objectContaining({
                  id: MENU_ITEM_ID.LOGOUT_BUTTON,
                  text: "logout",
                  disabled: false,
                }),
              ]),
            }),
            {}
          );
        });
        // AND the context menu to contain the correct menu items
        const contextMenu = screen.getByTestId(CONTEXT_MENU_DATA_TEST_ID.MENU);
        expect(contextMenu).toBeInTheDocument();
        expect(screen.getByTestId(MENU_ITEM_ID.START_NEW_CONVERSATION)).toBeInTheDocument();
        expect(screen.getByTestId(MENU_ITEM_ID.SETTINGS_SELECTOR)).toBeInTheDocument();
        expect(screen.getByTestId(MENU_ITEM_ID.LOGOUT_BUTTON)).toBeInTheDocument();
      }
    );
  });

  describe("register button tests", () => {
    const mockRegisteredUser = {
      id: "test-id",
      name: "Test User",
      email: "test@example.com",
    };

    // Anonymous users have no name or email
    const mockAnonymousUser = {
      id: "anonymous-id",
      name: "",
      email: "",
    };

    beforeEach(() => {
      (ContextMenu as jest.Mock).mockClear();
      resetAllMethodMocks(AuthenticationStateService.getInstance());
    });

    test("should show register button in menu for anonymous user", async () => {
      // GIVEN an anonymous user
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValueOnce(mockAnonymousUser);

      // AND a ChatHeader component
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={0}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );

      // WHEN the chat header is rendered
      renderWithChatProvider(givenChatHeader);

      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);

      // THEN expect the register button to be visible in the menu
      await waitFor(() => {
        expect(ContextMenu).toHaveBeenCalledWith(
          expect.objectContaining({
            anchorEl: userButton,
            open: true,
            items: expect.arrayContaining([
              expect.objectContaining({
                id: MENU_ITEM_ID.REGISTER,
                text: "register",
                disabled: expect.any(Boolean),
              }),
              expect.anything(),
            ]),
          }),
          {}
        );
      });
    });

    test("should not show register button in menu for registered user", async () => {
      // GIVEN a registered user ( user with a name and email )
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValueOnce(mockRegisteredUser);

      // AND a ChatHeader component
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={0}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );

      // WHEN the chat header is rendered
      renderWithChatProvider(givenChatHeader);

      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);

      // THEN expect the register button to not be visible in the menu
      await waitFor(() => {
        expect(ContextMenu).toHaveBeenCalledWith(
          expect.objectContaining({
            anchorEl: userButton,
            open: true,
            items: expect.arrayContaining([
              expect.not.objectContaining({
                id: MENU_ITEM_ID.REGISTER,
                text: "register",
                disabled: expect.any(Boolean),
              }),
            ]),
          }),
          {}
        );
      });
    });

    test("should open conversion dialog when register button is clicked", async () => {
      // GIVEN an anonymous user
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValueOnce(mockAnonymousUser);

      // AND a ChatHeader component
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={0}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={0}
          timeUntilNotification={null}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );

      // WHEN the chat header is rendered
      renderWithChatProvider(givenChatHeader);

      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);

      // AND the register button is clicked
      const registerMenuItem = screen.getByTestId(MENU_ITEM_ID.REGISTER);
      await userEvent.click(registerMenuItem);

      // THEN expect the conversion dialog to be opened
      expect(screen.getByTestId(ANONYMOUS_ACCOUNT_CONVERSION_DIALOG_DATA_TEST_ID.DIALOG)).toBeInTheDocument();
    });

    test("should show success message and set account converted state when conversion is successful", async () => {
      // GIVEN an anonymous user
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValueOnce(mockAnonymousUser);

      // AND a ChatHeader component
      const givenChatHeader = (
        <ChatProvider
          handleOpenExperiencesDrawer={jest.fn()}
          removeMessageFromChat={jest.fn()}
          addMessageToChat={jest.fn()}
        >
          <ChatHeader
            notifyOnLogout={jest.fn()}
            startNewConversation={jest.fn()}
            experiencesExplored={0}
            exploredExperiencesNotification={false}
            setExploredExperiencesNotification={jest.fn()}
            conversationCompleted={false}
            progressPercentage={0}
            timeUntilNotification={null}
            conversationPhase={ConversationPhase.INTRO}
            collectedExperiences={1}
          />
        </ChatProvider>
      );

      // WHEN the chat header is rendered
      renderWithChatProvider(givenChatHeader);

      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);

      // AND the register button is clicked
      const registerMenuItem = screen.getByTestId(MENU_ITEM_ID.REGISTER);
      await userEvent.click(registerMenuItem);

      // AND the conversion is successful
      (AnonymousAccountConversionDialog as jest.Mock).mock.calls[0][0].onSuccess();

      // THEN expect the account conversion flag to be set
      expect(PersistentStorageService.setAccountConverted).toHaveBeenCalledWith(true);
    });

    test("should close conversion dialog when onClose function is called", async () => {
      // GIVEN an anonymous user
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValueOnce(mockAnonymousUser);
      // AND a ChatHeader component
      const givenChatHeader = (
        <ChatProvider
          handleOpenExperiencesDrawer={jest.fn()}
          removeMessageFromChat={jest.fn()}
          addMessageToChat={jest.fn()}
        >
          <ChatHeader
            notifyOnLogout={jest.fn()}
            startNewConversation={jest.fn()}
            experiencesExplored={0}
            exploredExperiencesNotification={false}
            setExploredExperiencesNotification={jest.fn()}
            conversationCompleted={false}
            progressPercentage={0}
            timeUntilNotification={null}
            conversationPhase={ConversationPhase.INTRO}
            collectedExperiences={1}
          />
        </ChatProvider>
      );

      // WHEN the chat header is rendered
      renderWithChatProvider(givenChatHeader);
      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);
      // AND the register button is clicked
      const registerMenuItem = screen.getByTestId(MENU_ITEM_ID.REGISTER);
      await userEvent.click(registerMenuItem);

      // THEN expect the conversion dialog to be opened
      const conversionDialog = screen.getByTestId(ANONYMOUS_ACCOUNT_CONVERSION_DIALOG_DATA_TEST_ID.DIALOG);
      expect(conversionDialog).toBeInTheDocument();

      // WHEN the onClose function is called
      const onClose = (AnonymousAccountConversionDialog as jest.Mock).mock.calls[0][0].onClose;
      act(() => {
        onClose();
      });

      // THEN expect the dialog to be hidden
      expect(AnonymousAccountConversionDialog).toHaveBeenCalledWith(
        expect.objectContaining({ isOpen: false }),
        expect.anything()
      );
    });
  });

  describe("Feedback notification", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockBrowserIsOnLine(true);
      // Reset mocks
      jest.clearAllMocks();
      // Mock PersistentStorageService
      jest.spyOn(PersistentStorageService, "hasSeenFeedbackNotification").mockReturnValue(false);
      jest.spyOn(PersistentStorageService, "setSeenFeedbackNotification").mockImplementation();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test("should log an error and exit if no current user exists", () => {
      // GIVEN no active user
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(null);
      // AND experiences explored
      const givenExploredExperiences = 4;
      // AND the time until notification
      const givenTimeUntilNotification = FEEDBACK_NOTIFICATION_DELAY;
      // WHEN the component is rendered
      renderWithChatProvider(
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={givenExploredExperiences}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={50}
          timeUntilNotification={givenTimeUntilNotification}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      // AND the time is advanced by the given time until notification
      jest.advanceTimersByTime(givenTimeUntilNotification);
      // THEN expect no feedback notification to be shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      // AND expect an error to be logged
      expect(console.error).toHaveBeenCalledWith(new SessionError("User is not available"));
    });

    test("should show feedback notification after 30 minutes when conversation progress is <= 66%", async () => {
      // GIVEN mock user
      const mockUser = { id: "123", name: "Foo Bar", email: "foo@bar.baz" };
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(mockUser);
      // AND experiences explored
      const givenExploredExperiences = 4;
      // AND the time until notification
      const givenTimeUntilNotification = FEEDBACK_NOTIFICATION_DELAY;

      // WHEN the component is rendered
      renderWithChatProvider(
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={givenExploredExperiences}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={50}
          timeUntilNotification={givenTimeUntilNotification}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      // AND the time is advanced by the given time until notification
      jest.advanceTimersByTime(givenTimeUntilNotification);

      // THEN expect the feedback notification to be shown once
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledTimes(1);
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        expect.any(Object), // since the message is a react element
        expect.objectContaining({
          variant: "info",
          persist: true,
          autoHideDuration: null,
          preventDuplicate: true,
        })
      );
      // AND expect the feedback notification to be marked as seen
      jest.spyOn(PersistentStorageService, "hasSeenFeedbackNotification").mockReturnValue(true);
      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should not show feedback notification if conversation progress is > 66%", () => {
      // GIVEN mock user
      const mockUser = { id: "123", name: "", email: "" };
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(mockUser);
      // AND experiences explored
      const givenExploredExperiences = 4;
      // AND the time until notification
      const givenTimeUntilNotification = FEEDBACK_NOTIFICATION_DELAY;

      // WHEN the component is rendered
      renderWithChatProvider(
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={givenExploredExperiences}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={70}
          timeUntilNotification={givenTimeUntilNotification}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );
      // AND the time is advanced by the given time until notification
      jest.advanceTimersByTime(givenTimeUntilNotification);

      // THEN expect no notification to be shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should not show feedback notification if it is already shown for current user", () => {
      // GIVEN mock user
      const mockUser = { id: "123", name: "", email: "" };
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(mockUser);
      // AND mock feedback notification to return true (already shown)
      jest.spyOn(PersistentStorageService, "hasSeenFeedbackNotification").mockReturnValue(true);
      // AND experiences explored
      const givenExploredExperiences = 4;

      // WHEN the component is rendered
      renderWithChatProvider(
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          experiencesExplored={givenExploredExperiences}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
          conversationCompleted={false}
          progressPercentage={50}
          timeUntilNotification={0}
          conversationPhase={ConversationPhase.INTRO}
          collectedExperiences={1}
        />
      );

      // THEN expect no notification to be shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      // AND no errors or warnings to be shown
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("Logout button tests", () => {
    // Common setup
    const mockAnonymousUser = { id: "anonymous-id", name: "", email: "" };
    const mockRegisteredUser = { id: "123", name: "Foo Bar", email: "foo@bar.baz" };

    const renderChatHeader = (props = {}) => {
      const defaultProps = {
        notifyOnLogout: jest.fn(),
        startNewConversation: jest.fn(),
        experiencesExplored: 0,
        exploredExperiencesNotification: false,
        setExploredExperiencesNotification: jest.fn(),
        conversationCompleted: false,
        progressPercentage: 0,
        timeUntilNotification: null,
        conversationPhase: ConversationPhase.INTRO,
        collectedExperiences: 1,
        ...props,
      };

      return renderWithChatProvider(<ChatHeader {...defaultProps} />);
    };

    test("should show confirmation dialog for anonymous users when logging out", async () => {
      // GIVEN an anonymous user
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(mockAnonymousUser);

      // WHEN the chat header is rendered
      renderChatHeader();
      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);
      // AND the logout button is clicked
      const logoutMenuItem = screen.getByTestId(MENU_ITEM_ID.LOGOUT_BUTTON);
      await userEvent.click(logoutMenuItem);

      // THEN expect the confirmation dialog to be shown
      expect(screen.getByTestId(TEXT_CONFIRM_MODAL_DIALOG_DATA_TEST_ID.TEXT_CONFIRM_MODAL_CONTENT)).toBeInTheDocument();
    });

    test("should directly logout registered users without confirmation", async () => {
      // GIVEN a registered user
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(mockRegisteredUser);
      const notifyOnLogout = jest.fn();

      // WHEN the chat header is rendered
      renderChatHeader({ notifyOnLogout });
      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);
      // AND the logout button is clicked
      const logoutMenuItem = screen.getByTestId(MENU_ITEM_ID.LOGOUT_BUTTON);
      await userEvent.click(logoutMenuItem);

      // THEN expect logout to be called
      expect(notifyOnLogout).toHaveBeenCalled();
      // AND the dialog to not be shown
      expect(
        screen.queryByTestId(TEXT_CONFIRM_MODAL_DIALOG_DATA_TEST_ID.TEXT_CONFIRM_MODAL_CONTENT)
      ).not.toBeInTheDocument();
    });

    test("should proceed with logout when user confirms from dialog", async () => {
      // GIVEN an anonymous user
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(mockAnonymousUser);
      const notifyOnLogout = jest.fn();

      // WHEN the chat header is rendered
      renderChatHeader({ notifyOnLogout });
      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);
      // AND the logout button is clicked
      const logoutMenuItem = screen.getByTestId(MENU_ITEM_ID.LOGOUT_BUTTON);
      await userEvent.click(logoutMenuItem);
      // AND the user confirms logout
      const logoutButton = screen.getByTestId(CONFIRM_MODAL_DATA_TEST_ID.CONFIRM_MODAL_CANCEL);
      await userEvent.click(logoutButton);

      // THEN expect logout to be called
      expect(notifyOnLogout).toHaveBeenCalled();
    });

    test("should show registration dialog when user chooses to register from logout confirmation", async () => {
      // GIVEN an anonymous user
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(mockAnonymousUser);

      // WHEN the chat header is rendered
      renderChatHeader();
      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);
      // AND the logout button is clicked
      const logoutMenuItem = screen.getByTestId(MENU_ITEM_ID.LOGOUT_BUTTON);
      await userEvent.click(logoutMenuItem);
      // AND the user chooses to register
      const registerButton = screen.getByTestId(CONFIRM_MODAL_DATA_TEST_ID.CONFIRM_MODAL_CONFIRM);
      await userEvent.click(registerButton);

      // THEN expect the registration dialog to be shown
      expect(screen.getByTestId(ANONYMOUS_ACCOUNT_CONVERSION_DIALOG_DATA_TEST_ID.DIALOG)).toBeInTheDocument();
    });

    test("should close logout confirmation dialog when close icon is clicked", async () => {
      // GIVEN an anonymous user
      jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(mockAnonymousUser);

      // WHEN the chat header is rendered
      renderChatHeader();
      // AND the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      await userEvent.click(userButton);
      // AND the logout button is clicked
      const logoutMenuItem = screen.getByTestId(MENU_ITEM_ID.LOGOUT_BUTTON);
      await userEvent.click(logoutMenuItem);

      // THEN expect the logout confirmation dialog to be opened
      const logoutConfirmationDialog = screen.getByTestId(CONFIRM_MODAL_DATA_TEST_ID.CONFIRM_MODAL);
      expect(logoutConfirmationDialog).toBeInTheDocument();

      // WHEN the close icon is clicked
      const closeIcon = screen.getByTestId(CONFIRM_MODAL_DATA_TEST_ID.CONFIRM_MODAL_CLOSE);
      await userEvent.click(closeIcon);

      // THEN expect the dialog to be closed
      await waitFor(() => {
        expect(logoutConfirmationDialog).not.toBeInTheDocument();
      });
    });
  });
});

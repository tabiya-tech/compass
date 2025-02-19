// mute the console
import "src/_test_utilities/consoleMock";

import ChatHeader, { DATA_TEST_ID, MENU_ITEM_ID } from "./ChatHeader";
import { render, screen } from "src/_test_utilities/test-utils";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { testNavigateToPath } from "src/_test_utilities/routeNavigation";
import ContextMenu, { DATA_TEST_ID as CONTEXT_MENU_DATA_TEST_ID } from "src/theme/ContextMenu/ContextMenu";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { DATA_TEST_ID as ANIMATED_BADGE_DATA_TEST_ID } from "src/theme/AnimatedBadge/AnimatedBadge";
import userEvent from "@testing-library/user-event";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import AnonymousAccountConversionDialog, { DATA_TEST_ID as ANONYMOUS_ACCOUNT_CONVERSION_DIALOG_DATA_TEST_ID } from "src/auth/components/anonymousAccountConversionDialog/AnonymousAccountConversionDialog";
import { ChatProvider } from "src/chat/ChatContext";
import { PersistentStorageService } from "../../app/PersistentStorageService/PersistentStorageService";

// Mock PersistentStorageService
jest.mock("src/app/PersistentStorageService/PersistentStorageService", () => ({
  PersistentStorageService: {
    getAccountConverted: jest.fn(),
    setAccountConverted: jest.fn(),
    clearAccountConverted: jest.fn()
  },
}));

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
  const actual = jest.requireActual("src/auth/components/anonymousAccountConversionDialog/AnonymousAccountConversionDialog");
  return {
    __esModule: true,
    ...actual,
    default: jest.fn(() => <div data-testid={actual.DATA_TEST_ID.DIALOG}/>),
  };
});

const renderWithChatProvider = (child: React.ReactNode) => {
  render(
    <ChatProvider handleOpenExperiencesDrawer={jest.fn}>
      {child}
    </ChatProvider>
  )
}

describe("ChatHeader", () => {
  beforeEach(() => {
    (ContextMenu as jest.Mock).mockClear();
  });

  test.each([
    ["exploredExperiencesNotification shown", true],
    ["exploredExperiencesNotification not shown", false],
  ])("should render the Chat Header with %s", (desc, givenExploredExperiencesNotification) => {
    // GIVEN a ChatHeader component
    const givenNotifyOnLogout = jest.fn();
    const givenStartNewConversation = jest.fn();
    const givenNotifyOnExperiencesDrawerOpen = jest.fn();
    const givenNumberOfExploredExperiences = 1;
    const givenChatHeader = (
      <ChatHeader
        notifyOnLogout={givenNotifyOnLogout}
        startNewConversation={givenStartNewConversation}
        notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
        experiencesExplored={givenNumberOfExploredExperiences}
        exploredExperiencesNotification={givenExploredExperiencesNotification}
        setExploredExperiencesNotification={jest.fn()}
      />
    );

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

  describe("chatHeader action tests", () => {
    const givenNotifyOnLogout = jest.fn();
    const givenStartNewConversation = jest.fn();
    const givenNotifyOnExperiencesDrawerOpen = jest.fn();
    const givenChatHeader = (
      <ChatProvider handleOpenExperiencesDrawer={jest.fn}>
        <ChatHeader
          notifyOnLogout={givenNotifyOnLogout}
          startNewConversation={givenStartNewConversation}
          notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          experiencesExplored={0}
          exploredExperiencesNotification={true}
          setExploredExperiencesNotification={jest.fn()}
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
          notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          experiencesExplored={0}
          exploredExperiencesNotification={true}
          setExploredExperiencesNotification={jest.fn()}
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

    test("should navigate to settings when the settings menu item is clicked", async () => {
      // GIVEN a ChatHeader component
      const givenNotifyOnLogout = jest.fn();
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={givenNotifyOnLogout}
          startNewConversation={givenStartNewConversation}
          notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          experiencesExplored={0}
          exploredExperiencesNotification={true}
          setExploredExperiencesNotification={jest.fn()}
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

      // WHEN the settings menu item is clicked
      const settingsMenuItem = screen.getByTestId(MENU_ITEM_ID.SETTINGS_SELECTOR);
      fireEvent.click(settingsMenuItem);
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

      // THEN expect the user to navigate to the settings page
      const navigate = useNavigate();
      expect(navigate).toHaveBeenCalledWith(routerPaths.SETTINGS);
    });

    test("should call start new conversation when the start new conversation menu item is clicked", async () => {
      // GIVEN a ChatHeader component
      const givenNotifyOnLogout = jest.fn();
      const givenStartNewConversation = jest.fn();
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={givenNotifyOnLogout}
          startNewConversation={givenStartNewConversation}
          notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          experiencesExplored={0}
          exploredExperiencesNotification={true}
          setExploredExperiencesNotification={jest.fn()}
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
          notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          experiencesExplored={0}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
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
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          experiencesExplored={0}
          exploredExperiencesNotification={true}
          setExploredExperiencesNotification={jest.fn()}
        />
      );
      // AND the chat header is rendered
      renderWithChatProvider(givenChatHeader);

      // WHEN the experiences button is clicked
      const experiencesButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_EXPERIENCES);
      fireEvent.click(experiencesButton);

      // THEN expect notifyOnExperiencesDrawerOpen to be called
      expect(givenNotifyOnExperiencesDrawerOpen).toHaveBeenCalled();
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
          notifyOnExperiencesDrawerOpen={jest.fn()}
          experiencesExplored={givenExploredExperiences}
          exploredExperiencesNotification={givenExploredExperiencesNotification}
          setExploredExperiencesNotification={jest.fn()}
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
      // AND the component is rendered
      const givenChatHeader = (
        <ChatHeader
          notifyOnLogout={jest.fn()}
          startNewConversation={jest.fn()}
          notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          experiencesExplored={givenExploredExperiences}
          exploredExperiencesNotification={givenExploredExperiencesNotification}
          setExploredExperiencesNotification={jest.fn()}
        />
      );
      renderWithChatProvider(givenChatHeader);

      // WHEN the experiences button is clicked
      const experiencesButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_EXPERIENCES);
      fireEvent.click(experiencesButton);

      // THEN expect notifyOnExperiencesDrawerOpen to be called
      expect(givenNotifyOnExperiencesDrawerOpen).toHaveBeenCalled();
      // AND expect the notification badge content to be hidden
      expect(screen.queryByText(givenExploredExperiences)).not.toBeInTheDocument();
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
        const givenNotifyOnExperiencesDrawerOpen = jest.fn();
        const givenChatHeader = (
          <ChatHeader
            notifyOnLogout={givenNotifyOnLogout}
            startNewConversation={givenStartNewConversation}
            notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
            experiencesExplored={0}
            exploredExperiencesNotification={false}
            setExploredExperiencesNotification={jest.fn()}
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
          notifyOnExperiencesDrawerOpen={jest.fn()}
          experiencesExplored={0}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
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
              expect.anything()
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
          notifyOnExperiencesDrawerOpen={jest.fn()}
          experiencesExplored={0}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
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
          notifyOnExperiencesDrawerOpen={jest.fn()}
          experiencesExplored={0}
          exploredExperiencesNotification={false}
          setExploredExperiencesNotification={jest.fn()}
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
        <ChatProvider handleOpenExperiencesDrawer={jest.fn()}>
          <ChatHeader
            notifyOnLogout={jest.fn()}
            startNewConversation={jest.fn()}
            notifyOnExperiencesDrawerOpen={jest.fn()}
            experiencesExplored={0}
            exploredExperiencesNotification={false}
            setExploredExperiencesNotification={jest.fn()}
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
  });
});

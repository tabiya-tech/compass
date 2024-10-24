// mute the console
import "src/_test_utilities/consoleMock";

import ChatHeader, { DATA_TEST_ID, MENU_ITEM_ID } from "./ChatHeader";
import { render, screen } from "src/_test_utilities/test-utils";
import { act, fireEvent, waitFor, within } from "@testing-library/react";
import { HashRouter, useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { testNavigateToPath } from "src/_test_utilities/routeNavigation";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

// mock the ContextMenu
jest.mock("src/theme/ContextMenu/ContextMenu", () => {
  return {
    __esModule: true,
    default: jest.fn(({ items }: { items: MenuItemConfig[] }) => (
      <div data-testid="mock-context-menu">
        {items.map((item) => (
          <div key={item.id} data-testid={item.id} onClick={item.action}>
            {item.text}
          </div>
        ))}
        ;
      </div>
    )),
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
jest.mock("src/auth/services/socialAuth/SocialAuth.service", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        logout: jest.fn(),
      };
    }),
  };
});

describe("ChatHeader", () => {
  beforeEach(() => {
    (ContextMenu as jest.Mock).mockClear();
  });

  test("should render the Chat Header", () => {
    // GIVEN a ChatHeader component
    const givenNotifyOnLogout = jest.fn();
    const givenStartNewConversation = jest.fn();
    const givenNotifyOnExperiencesDrawerOpen = jest.fn();
    const givenChatHeader = (
      <HashRouter>
        <ChatHeader
          notifyOnLogout={givenNotifyOnLogout}
          startNewConversation={givenStartNewConversation}
          notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
        />
      </HashRouter>
    );

    // WHEN the chat header is rendered
    render(givenChatHeader);

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
    const chatHeaderExperiencesIcon = within(chatHeaderExperiencesButton).getByTestId(DATA_TEST_ID.CHAT_HEADER_ICON_EXPERIENCES);
    expect(chatHeaderExperiencesIcon).toBeInTheDocument();
    // AND to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_CONTAINER)).toMatchSnapshot();
  });
  describe("chatHeader action tests", () => {
    const givenNotifyOnLogout = jest.fn();
    const givenStartNewConversation = jest.fn();
    const givenNotifyOnExperiencesDrawerOpen = jest.fn();
    const givenChatHeader = (
      <ChatHeader
        notifyOnLogout={givenNotifyOnLogout}
        startNewConversation={givenStartNewConversation}
        notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
      />
    );
    testNavigateToPath(givenChatHeader, "Compass logo", DATA_TEST_ID.CHAT_HEADER_LOGO_LINK, routerPaths.ROOT);

    test("should open the context menu when the user icon is clicked", async () => {
      // GIVEN a ChatHeader component
      const givenNotifyOnLogout = jest.fn();
      const givenChatHeader = (
        <HashRouter>
          <ChatHeader
            notifyOnLogout={givenNotifyOnLogout}
            startNewConversation={givenStartNewConversation}
            notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          />
        </HashRouter>
      );
      // AND the chat header is rendered
      render(givenChatHeader);

      // WHEN the user button is clicked
      const userButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
      fireEvent.click(userButton);

      // THEN expect the context menu to be visible
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
        <HashRouter>
          <ChatHeader
            notifyOnLogout={givenNotifyOnLogout}
            startNewConversation={givenStartNewConversation}
            notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          />
        </HashRouter>
      );
      // AND the chat header is rendered
      render(givenChatHeader);
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
        <HashRouter>
          <ChatHeader
            notifyOnLogout={givenNotifyOnLogout}
            startNewConversation={givenStartNewConversation}
            notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          />
        </HashRouter>
      );

      // AND the chat header is rendered
      render(givenChatHeader);

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
        <HashRouter>
          <ChatHeader
            notifyOnLogout={givenNotifyOnLogout}
            startNewConversation={givenStartNewConversation}
            notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          />
        </HashRouter>
      );
      // AND the chat header is rendered
      render(givenChatHeader);
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
        <HashRouter>
          <ChatHeader
            notifyOnLogout={jest.fn()}
            startNewConversation={jest.fn()}
            notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
          />
        </HashRouter>
      );
      // AND the chat header is rendered
      render(givenChatHeader);

      // WHEN the experiences button is clicked
      const experiencesButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_EXPERIENCES);
      fireEvent.click(experiencesButton);

      // THEN expect notifyOnExperiencesDrawerOpen to be called
      expect(givenNotifyOnExperiencesDrawerOpen).toHaveBeenCalled();
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
          <HashRouter>
            <ChatHeader
              notifyOnLogout={givenNotifyOnLogout}
              startNewConversation={givenStartNewConversation}
              notifyOnExperiencesDrawerOpen={givenNotifyOnExperiencesDrawerOpen}
            />
          </HashRouter>
        );
        // AND the chat header is rendered
        render(givenChatHeader);
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
                  disabled: !browserIsOnline,
                }),
              ]),
            }),
            {}
          );
        });
        // AND the context menu to contain the correct menu items
        const contextMenu = screen.getByTestId("mock-context-menu");
        expect(contextMenu).toBeInTheDocument();
        expect(screen.getByTestId(MENU_ITEM_ID.START_NEW_CONVERSATION)).toBeInTheDocument();
        expect(screen.getByTestId(MENU_ITEM_ID.SETTINGS_SELECTOR)).toBeInTheDocument();
        expect(screen.getByTestId(MENU_ITEM_ID.LOGOUT_BUTTON)).toBeInTheDocument();
      }
    );
  });
});

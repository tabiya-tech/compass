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

describe("ChatHeader", () => {
  beforeEach(() => {
    (ContextMenu as jest.Mock).mockClear();
  });

  test("should render the Chat Header", () => {
    // GIVEN a ChatHeader component
    const givenNotifyOnLogout = jest.fn();
    const givenChatHeader = (
      <HashRouter>
        <ChatHeader notifyOnLogout={givenNotifyOnLogout} />
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
    // AND the compass text to be visible
    expect(screen.getByText("compass")).toBeInTheDocument();
    // AND the user button to be shown with the user icon
    const chatHeaderButton = screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_BUTTON_USER);
    expect(chatHeaderButton).toBeInTheDocument();
    const chatHeaderUserIcon = within(chatHeaderButton).getByTestId(DATA_TEST_ID.CHAT_HEADER_ICON_USER);
    expect(chatHeaderUserIcon).toBeInTheDocument();
    // AND to match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CHAT_HEADER_CONTAINER)).toMatchSnapshot();
  });
  describe("chatHeader action tests", () => {
    const givenNotifyOnLogout = jest.fn();
    const givenChatHeader = <ChatHeader notifyOnLogout={givenNotifyOnLogout} />;
    testNavigateToPath(givenChatHeader, "compass logo", DATA_TEST_ID.CHAT_HEADER_LOGO_LINK, routerPaths.ROOT);

    test("should open the context menu when the user icon is clicked", async () => {
      // GIVEN a ChatHeader component
      const givenNotifyOnLogout = jest.fn();
      const givenChatHeader = (
        <HashRouter>
          <ChatHeader notifyOnLogout={givenNotifyOnLogout} />
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
          <ChatHeader notifyOnLogout={givenNotifyOnLogout} />
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

    test("should close the context menu when notifyOnClose is called", async () => {
      // GIVEN a ChatHeader component
      const givenNotifyOnLogout = jest.fn();
      const givenChatHeader = (
        <HashRouter>
          <ChatHeader notifyOnLogout={givenNotifyOnLogout} />
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
  });
});

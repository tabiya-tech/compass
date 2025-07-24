// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import { ContextMenuProps } from "src/theme/ContextMenu/ContextMenu";
import SkillsContextMenu, { DATA_TEST_ID } from "./SkillsContextMenu";
import { within } from "@testing-library/react";

describe("SkillsContextMenu", () => {
  const stdGivenProps: ContextMenuProps = {
    anchorEl: document.createElement("div"), // Mock an HTMLElement
    open: true,
    notifyOnClose: jest.fn(),
    items: [],
  };

  test("should render correctly the skills menu open", () => {
    // GIVEN the following menu items
    const givenItems = [
      {
        id: "1",
        text: "foo",
        description: "Description for foo",
        action: jest.fn(),
        disabled: false,
      },
      {
        id: "2",
        text: "bar",
        description: "Description for bar",
        action: jest.fn(),
        disabled: false,
      },
    ];

    // WHEN the component is rendered with the given items
    render(<SkillsContextMenu {...stdGivenProps} items={givenItems} />);

    // THEN expect the SkillsContextMenu to be visible
    const actualMenu = screen.getByTestId(DATA_TEST_ID.SKILL_MENU);
    expect(actualMenu).toBeInTheDocument();
    // AND the skill menu header message to be visible
    const headerMessage = screen.getByTestId(DATA_TEST_ID.SKILL_MENU_HEADER_MESSAGE);
    expect(headerMessage).toBeInTheDocument();
    // AND the menu items to be visible
    const actualMenuItems = screen.getAllByTestId(DATA_TEST_ID.SKILL_MENU_ITEM);
    expect(actualMenuItems).toHaveLength(givenItems.length);
    // AND every menu item to have the correct text and description
    givenItems.forEach((item, index) => {
      const menuItem = within(actualMenuItems[index]);
      expect(menuItem.getByTestId(DATA_TEST_ID.SKILL_MENU_ITEM_TEXT)).toHaveTextContent(item.text);
      expect(menuItem.getByTestId(DATA_TEST_ID.SKILL_MENU_ITEM_DESCRIPTION)).toHaveTextContent(item.description);
    });
    // AND to match the snapshot
    expect(actualMenu).toMatchSnapshot();
    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should render correctly the skills menu closed", () => {
    // GIVEN the skill menu is closed
    const givenProps = { ...stdGivenProps, open: false };

    // WHEN the component is rendered with the given items but closed
    render(<SkillsContextMenu {...givenProps} />);

    // THEN expect the SkillsContextMenu to not be visible
    const actualMenu = screen.queryByTestId(DATA_TEST_ID.SKILL_MENU);
    expect(actualMenu).not.toBeInTheDocument();
  });

  test("should call the action of a menu item when clicked and the notifyOnClose function", () => {
    // GIVEN the following menu items
    const givenItems = [
      {
        id: "1",
        text: "foo",
        description: "Description for foo",
        action: jest.fn(),
        disabled: false,
      },
    ];

    // WHEN the component is rendered with the given items
    render(<SkillsContextMenu {...stdGivenProps} items={givenItems} />);

    // AND the first menu item is clicked
    const actualMenuItem = screen.getByTestId(DATA_TEST_ID.SKILL_MENU_ITEM);
    actualMenuItem.click();

    // THEN expect the action of the first menu item to be called
    expect(givenItems[0].action).toHaveBeenCalled();
    // AND expect notifyOnClose to be called
    expect(stdGivenProps.notifyOnClose).toHaveBeenCalled();
  });
});

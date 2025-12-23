// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen, userEvent } from "src/_test_utilities/test-utils";
import DislikeReasonPopover, {
  DATA_TEST_ID,
} from "src/chat/reaction/components/dislikeReasonPopover/DislikeReasonPopover";
import { DislikeReason, DislikeReasonMessages } from "src/chat/reaction/reaction.types";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

describe("ReactionReasonPopover", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserIsOnLine(true);
  });

  describe("render tests", () => {
    test("should render the reaction reason popover correctly", () => {
      // GIVEN an anchor element
      const anchorEl = document.createElement("div");

      // WHEN the component is rendered
      render(<DislikeReasonPopover anchorEl={anchorEl} open={true} onClose={jest.fn()} />);

      // THEN expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.CONTAINER);
      expect(container).toBeInTheDocument();
      // AND the title to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.TITLE)).toBeInTheDocument();
      // AND the close icon Button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CLOSE_ICON_BUTTON)).toBeInTheDocument();
      // AND the close icon to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CLOSE_ICON)).toBeInTheDocument();
      // AND expect all reason buttons to be rendered
      const reasonButtons = screen.getAllByTestId(DATA_TEST_ID.BUTTON);
      expect(reasonButtons).toHaveLength(Object.keys(DislikeReasonMessages).length);
      // AND the buttons to have the correct text content
      const reasons = Object.values(DislikeReasonMessages);
      reasons.forEach((reason, index) => {
        expect(reasonButtons[index]).toHaveTextContent(reason);
        expect(reasonButtons[index]).toBeEnabled();
      });
      // AND expect the popover to be anchored to the correct element.
      expect(screen.getByTestId(DATA_TEST_ID.POPOVER)).toBeInTheDocument();
      // AND expect the component to match snapshot
      expect(container).toMatchSnapshot();
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should render the popover with disabled buttons when the browser is offline", () => {
      // GIVEN an anchor element
      const anchorEl = document.createElement("div");

      // AND the browser is offline
      mockBrowserIsOnLine(false);

      // WHEN the component is rendered
      render(<DislikeReasonPopover anchorEl={anchorEl} open={true} onClose={jest.fn()} />);

      // THEN expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.CONTAINER);
      expect(container).toBeInTheDocument();
      // AND the title to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.TITLE)).toBeInTheDocument();
      // AND the close icon Button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CLOSE_ICON_BUTTON)).toBeInTheDocument();
      // AND the close icon to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.CLOSE_ICON)).toBeInTheDocument();
      // AND expect all reason buttons to be rendered
      const reasonButtons = screen.getAllByTestId(DATA_TEST_ID.BUTTON);
      expect(reasonButtons).toHaveLength(Object.keys(DislikeReasonMessages).length);
      // AND the buttons to have the correct text content
      const reasons = Object.values(DislikeReasonMessages);
      reasons.forEach((reason, index) => {
        expect(reasonButtons[index]).toHaveTextContent(reason);
        expect(reasonButtons[index]).toBeDisabled();
      });
      // AND expect the popover to be anchored to the correct element.
      expect(screen.getByTestId(DATA_TEST_ID.POPOVER)).toBeInTheDocument();
      // AND expect the component to match snapshot
      expect(container).toMatchSnapshot();
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("action tests", () => {
    test("should call onClose with a reason when a reason is selected", async () => {
      // GIVEN the popover is rendered and open
      const givenOnClose = jest.fn();
      const givenComponent = (
        <DislikeReasonPopover anchorEl={document.createElement("div")} open={true} onClose={givenOnClose} />
      );
      render(givenComponent);

      // WHEN a reason button is clicked
      const reasonButton = screen.getAllByTestId(DATA_TEST_ID.BUTTON)[0];
      await userEvent.click(reasonButton);

      // THEN expect the onClose callback to be called with the correct reason
      expect(givenOnClose).toHaveBeenCalledWith([DislikeReason.INAPPROPRIATE_TONE]);
      // AND expect onClose to be called
      expect(givenOnClose).toHaveBeenCalled();
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should call onClose with an empty array when clicking the close icon", async () => {
      // GIVEN the popover is rendered and open
      const givenOnClose = jest.fn();
      render(<DislikeReasonPopover anchorEl={document.createElement("div")} open={true} onClose={givenOnClose} />);

      // WHEN the close icon button is clicked
      const closeIconButton = screen.getByTestId(DATA_TEST_ID.CLOSE_ICON_BUTTON);
      await userEvent.click(closeIconButton);

      // THEN expect onClose to be called
      expect(givenOnClose).toHaveBeenCalledWith([]);
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should call onClose with an empty array when clicking outside the popover", async () => {
      // GIVEN the popover is rendered and open
      const givenOnClose = jest.fn();
      render(<DislikeReasonPopover anchorEl={document.createElement("div")} open={true} onClose={givenOnClose} />);

      // WHEN clicking outside the popover
      // eslint-disable-next-line testing-library/no-node-access
      const backdrop = document.querySelector(".MuiBackdrop-root");
      if (backdrop) {
        await userEvent.click(backdrop);
      }

      // THEN expect onClose to be called
      expect(givenOnClose).toHaveBeenCalledWith([]);
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should call onClose with an empty array when pressing escape", async () => {
      // GIVEN the popover is rendered and open
      const givenOnClose = jest.fn();
      render(<DislikeReasonPopover anchorEl={document.createElement("div")} open={true} onClose={givenOnClose} />);

      // WHEN the escape key is pressed
      await userEvent.keyboard("{Escape}");

      // THEN expect onClose to be called
      expect(givenOnClose).toHaveBeenCalledWith([]);
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});

// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import ReactionReasonPopover, {
  DATA_TEST_ID,
} from "src/feedback/reaction/components/reactionReasonPopover/ReactionReasonPopover";
import { ReactionReason, ReactReasonMessages } from "src/feedback/reaction/reaction.types";

describe("ReactionReasonPopover", () => {
  describe("render tests", () => {
    test("should render the reaction reason popover correctly", () => {
      // GIVEN an anchor element
      const anchorEl = document.createElement("div");

      // WHEN the component is rendered
      render(<ReactionReasonPopover anchorEl={anchorEl} open={true} onClose={jest.fn()} onReasonSelect={jest.fn()} />);

      // THEN expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND the container to be in the document
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
      expect(reasonButtons).toHaveLength(Object.keys(ReactionReason).length);
      // AND the buttons to have the correct text content
      const reasons = Object.values(ReactReasonMessages);
      reasons.forEach((reason, index) => {
        expect(reasonButtons[index]).toHaveTextContent(reason);
      });
      // AND expect the popover to be anchored to the correct element.
      expect(screen.getByTestId(DATA_TEST_ID.POPOVER)).toBeInTheDocument();
      // AND expect the component to match snapshot
      expect(container).toMatchSnapshot();
    });
  });

  describe("action tests", () => {
    test("should call onReasonSelect when a reason is selected", async () => {
      // GIVEN the popover is rendered and open
      const onReasonSelectMock = jest.fn();
      const onCloseMock = jest.fn();
      const givenComponent = (
        <ReactionReasonPopover
          anchorEl={document.createElement("div")}
          open={true}
          onClose={onCloseMock}
          onReasonSelect={onReasonSelectMock}
        />
      );
      render(givenComponent);

      // WHEN a reason button is clicked
      const reasonButton = screen.getAllByTestId(DATA_TEST_ID.BUTTON)[1];
      await userEvent.click(reasonButton);

      // THEN expect onReasonSelect to be called with correct reason
      expect(onReasonSelectMock).toHaveBeenCalledWith(ReactionReason.BIASED);
      // AND expect onClose to be called
      expect(onCloseMock).toHaveBeenCalled();
    });

    test("should call onClose when clicking the close icon", async () => {
      // GIVEN the popover is rendered and open
      const onCloseMock = jest.fn();
      render(
        <ReactionReasonPopover
          anchorEl={document.createElement("div")}
          open={true}
          onClose={onCloseMock}
          onReasonSelect={jest.fn()}
        />
      );

      // WHEN the close icon button is clicked
      const closeIconButton = screen.getByTestId(DATA_TEST_ID.CLOSE_ICON_BUTTON);
      await userEvent.click(closeIconButton);

      // THEN expect onClose to be called
      expect(onCloseMock).toHaveBeenCalled();
    });

    test("should call onClose when clicking outside the popover", async () => {
      // GIVEN the popover is rendered and open
      const onCloseMock = jest.fn();
      render(
        <ReactionReasonPopover
          anchorEl={document.createElement("div")}
          open={true}
          onClose={onCloseMock}
          onReasonSelect={jest.fn()}
        />
      );

      // WHEN clicking outside the popover
      // eslint-disable-next-line testing-library/no-node-access
      const backdrop = document.querySelector(".MuiBackdrop-root");
      if (backdrop) {
        await userEvent.click(backdrop);
      }

      // THEN expect onClose to be called
      expect(onCloseMock).toHaveBeenCalled();
    });

    test("should call onClose when pressing escape", async () => {
      // GIVEN the popover is rendered and open
      const onCloseMock = jest.fn();
      render(
        <ReactionReasonPopover
          anchorEl={document.createElement("div")}
          open={true}
          onClose={onCloseMock}
          onReasonSelect={jest.fn()}
        />
      );

      // WHEN the escape key is pressed
      await userEvent.keyboard("{Escape}");

      // THEN expect onClose to be called
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});

// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import ReactionReasonPopover, {
  DATA_TEST_ID,
} from "src/feedback/reaction/components/reactionReasonPopover/ReactionReasonPopover";
import { ReactionReason } from "src/feedback/reaction/reaction.types";

describe("ReactionReasonPopover", () => {
  describe("render tests", () => {
    test("should render the reaction reason popover correctly", () => {
      // GIVEN a message id and anchor element
      const messageId = "1234";
      const anchorEl = document.createElement("div");

      // WHEN the component is rendered
      render(
        <ReactionReasonPopover
          messageId={messageId}
          anchorEl={anchorEl}
          open={true}
          onClose={jest.fn()}
          onReasonSelect={jest.fn()}
          dataTestId={"reaction-reason-popover"}
        />
      );

      // THEN expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.REACTION_REASON_CONTAINER);
      expect(container).toBeInTheDocument();
      // AND the title to be in the document
      expect(screen.getByText("Please tell us what the issue is?")).toBeInTheDocument();
      // AND the close icon to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.REACTION_REASON_CLOSE_ICON)).toBeInTheDocument();
      // AND expect all reason buttons to be rendered
      const reasonButtons = screen.getAllByTestId(DATA_TEST_ID.REACTION_REASON_BUTTON);
      expect(reasonButtons).toHaveLength(5);
      // AND expect the component to match snapshot
      expect(container).toMatchSnapshot();
    });
  });

  describe("action tests", () => {
    test("should call onReasonSelect when a reason is selected", async () => {
      // GIVEN the popover is rendered and open
      const onCloseMock = jest.fn();
      const onReasonSelectMock = jest.fn();
      const givenComponent = (
        <ReactionReasonPopover
          messageId={"1234"}
          anchorEl={document.createElement("div")}
          open={true}
          onClose={onCloseMock}
          onReasonSelect={onReasonSelectMock}
          dataTestId={"reaction-reason-popover"}
        />
      );
      render(givenComponent);

      // WHEN a reason button is clicked
      const reasonButton = screen.getAllByTestId(DATA_TEST_ID.REACTION_REASON_BUTTON)[2];
      await userEvent.click(reasonButton);

      // THEN expect onReasonSelect to be called with correct messageId and reason
      expect(onReasonSelectMock).toHaveBeenCalledWith("1234", ReactionReason.INCORRECT);
      // AND expect onClose to be called
      expect(onCloseMock).toHaveBeenCalled();
    });

    test("should call onClose when clicking outside the popover", async () => {
      // GIVEN the popover is rendered and open
      const onCloseMock = jest.fn();
      render(
        <ReactionReasonPopover
          messageId={"1234"}
          anchorEl={document.createElement("div")}
          open={true}
          onClose={onCloseMock}
          onReasonSelect={jest.fn()}
          dataTestId={"reaction-reason-popover"}
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
          messageId={"1234"}
          anchorEl={document.createElement("div")}
          open={true}
          onClose={onCloseMock}
          onReasonSelect={jest.fn()}
          dataTestId={"reaction-reason-popover"}
        />
      );

      // WHEN the escape key is pressed
      await userEvent.keyboard("{Escape}");

      // THEN expect onClose to be called
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});

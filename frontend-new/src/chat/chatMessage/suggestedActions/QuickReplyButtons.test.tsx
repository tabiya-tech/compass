// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import QuickReplyButtons, { DATA_TEST_ID } from "./QuickReplyButtons";
import { QuickReplyOption } from "src/chat/ChatService/ChatService.types";

describe("QuickReplyButtons", () => {
  describe("render tests", () => {
    test("should render a chip for each quick reply option", () => {
      // GIVEN a list of quick reply options
      const givenOptions: QuickReplyOption[] = [{ label: "Yes" }, { label: "No" }, { label: "Maybe" }];
      // AND a callback function
      const givenOnSelect = jest.fn();

      // WHEN the QuickReplyButtons component is rendered
      render(<QuickReplyButtons options={givenOptions} onSelect={givenOnSelect} />);

      // THEN expect the container to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.QUICK_REPLY_CONTAINER)).toBeInTheDocument();
      // AND expect one chip button per option to be rendered
      const actualButtons = screen.getAllByTestId(DATA_TEST_ID.QUICK_REPLY_BUTTON);
      expect(actualButtons).toHaveLength(givenOptions.length);
      // AND expect each chip to display its label
      givenOptions.forEach((option) => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });

      // AND expect the component to match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.QUICK_REPLY_CONTAINER)).toMatchSnapshot();
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should render nothing when options array is empty", () => {
      // GIVEN an empty list of quick reply options
      const givenOptions: QuickReplyOption[] = [];
      // AND a callback function
      const givenOnSelect = jest.fn();

      // WHEN the QuickReplyButtons component is rendered with empty options
      const { container } = render(<QuickReplyButtons options={givenOptions} onSelect={givenOnSelect} />);

      // THEN expect the container element to not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.QUICK_REPLY_CONTAINER)).not.toBeInTheDocument();
      // AND expect no chip buttons to be rendered
      expect(screen.queryAllByTestId(DATA_TEST_ID.QUICK_REPLY_BUTTON)).toHaveLength(0);
      // AND expect the component to render nothing
      expect(container.innerHTML).toBe("");

      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("interaction tests", () => {
    test("should call onSelect with the label when a chip is clicked", () => {
      // GIVEN a list of quick reply options
      const givenOptions: QuickReplyOption[] = [{ label: "Yes" }, { label: "No" }, { label: "Maybe" }];
      // AND a callback function
      const givenOnSelect = jest.fn();

      // WHEN the QuickReplyButtons component is rendered
      render(<QuickReplyButtons options={givenOptions} onSelect={givenOnSelect} />);

      // AND the user clicks on the second chip
      const actualButtons = screen.getAllByTestId(DATA_TEST_ID.QUICK_REPLY_BUTTON);
      fireEvent.click(actualButtons[1]);

      // THEN expect onSelect to have been called once with the label of the clicked option
      expect(givenOnSelect).toHaveBeenCalledTimes(1);
      expect(givenOnSelect).toHaveBeenCalledWith("No");

      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should call onSelect only once even when the user clicks multiple chips", () => {
      // GIVEN a list of quick reply options
      const givenOptions: QuickReplyOption[] = [{ label: "Option A" }, { label: "Option B" }];
      // AND a callback function
      const givenOnSelect = jest.fn();

      // WHEN the QuickReplyButtons component is rendered
      render(<QuickReplyButtons options={givenOptions} onSelect={givenOnSelect} />);

      // AND the user clicks on the first chip then tries to click the second
      const actualButtons = screen.getAllByTestId(DATA_TEST_ID.QUICK_REPLY_BUTTON);
      fireEvent.click(actualButtons[0]);
      fireEvent.click(actualButtons[1]);

      // THEN expect onSelect to have been called exactly once with the first label
      // (subsequent clicks are disabled to prevent accidental double-submission)
      expect(givenOnSelect).toHaveBeenCalledTimes(1);
      expect(givenOnSelect).toHaveBeenCalledWith("Option A");

      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});

// silence chatty errors
import "src/_test_utilities/consoleMock";
import LoginWithInviteCodeForm, { DATA_TEST_ID } from "./LoginWithInviteCodeForm";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import React from "react";

describe("Testing LoginWithInviteCodeForm component", () => {
  const defaultProps = {
    inviteCode: "invite-code",
    notifyOnInviteCodeChanged: jest.fn(),
    isDisabled: false,
  };

  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  test("it should show login form", async () => {
    // WHEN the component is rendered
    render(<LoginWithInviteCodeForm {...defaultProps} />);

    // THEN the code input should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.CODE_INPUT)).toBeInTheDocument();

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.CODE_INPUT).parentElement).toMatchSnapshot();

    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("action tests", () => {
    test("should call notifyOnInviteCodeChanged when the code field changes", async () => {
      // GIVEN a code
      const givenCode = "foo-bar-baz";

      // WHEN the component is rendered
      render(<LoginWithInviteCodeForm {...defaultProps} />);

      // AND code input is changed
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.CODE_INPUT), {
        target: { value: givenCode },
      });

      // THEN expect the notifyOnInviteCodeChanged function to have been called
      expect(defaultProps.notifyOnInviteCodeChanged).toHaveBeenCalledWith(givenCode);

      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should disable inputs when isDisabled is true", () => {
      // WHEN the component is rendered with isDisabled=true
      render(<LoginWithInviteCodeForm {...defaultProps} isDisabled={true} />);

      // THEN expect all inputs to be disabled
      expect(screen.getByTestId(DATA_TEST_ID.CODE_INPUT)).toBeDisabled();

      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});

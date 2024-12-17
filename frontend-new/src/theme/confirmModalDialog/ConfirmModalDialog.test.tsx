// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import ConfirmModalDialog, { DATA_TEST_ID } from "src/theme/confirmModalDialog/ConfirmModalDialog";

describe("ConfirmModalDialog", () => {
  test("should render component correctly", () => {
    // GIVEN the ConfirmModalDialog
    const givenNewConversationDialog = (
      <ConfirmModalDialog
        title="Sample Title?"
        content={
          <>
            This is a sample body text for the ConfirmModalDialog component.
            <br />
            <br />
            Please confirm your action.
          </>
        }
        isOpen={true}
        onCancel={() => {}}
        onConfirm={() => {}}
        cancelButtonText="Cancel"
        confirmButtonText="Confirm"
      />
    );

    // WHEN the ConfirmModalDialog is rendered
    render(givenNewConversationDialog);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND dialog container to be in the document
    const dialogContainer = screen.getByTestId(DATA_TEST_ID.CONFIRM_MODAL);
    expect(dialogContainer).toBeInTheDocument();
    // AND dialog title to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM_MODAL_TITLE)).toBeInTheDocument();
    // AND dialog content to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM_MODAL_CONTENT)).toBeInTheDocument();
    // AND dialog cancel button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM_MODAL_CANCEL)).toBeInTheDocument();
    // AND dialog confirm button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CONFIRM_MODAL_CONFIRM)).toBeInTheDocument();
    // AND dialog to match the snapshot
    expect(dialogContainer).toMatchSnapshot();
  });
});

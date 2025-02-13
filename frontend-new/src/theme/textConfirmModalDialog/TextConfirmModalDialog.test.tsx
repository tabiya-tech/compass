// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import React from "react";
import TextConfirmModalDialog, { DATA_TEST_ID } from "src/theme/textConfirmModalDialog/TextConfirmModalDialog";
import { DATA_TEST_ID as APPROVAL_MODAL_TEST_ID } from "src/theme/confirmModalDialog/ConfirmModalDialog";

describe("TextConfirmModalDialog", () => {
  test("should render component correctly with expected content and handle interactions", () => {
    // GIVEN the TextConfirmModalDialog
    const givenTitle = "Sample Title?";
    const givenIsOpen = true;
    const givenOnCancel = jest.fn();
    const givenOnApprove = jest.fn();
    const givenCancelButtonText = "Cancel";
    const givenApproveButtonText = "Yes, continue";
    const givenTextParagraphs = [
      { id: "001", text: <>This is a sample body text for the TextConfirmModalDialog component.</>},
      { id: "002", text: <>Are you sure you want to proceed?</> },
    ];

    const givenNewConversationDialog = (
      <TextConfirmModalDialog
        title={givenTitle}
        textParagraphs={givenTextParagraphs}
        isOpen={givenIsOpen}
        onCancel={givenOnCancel}
        onConfirm={givenOnApprove}
        cancelButtonText={givenCancelButtonText}
        confirmButtonText={givenApproveButtonText}
      />
    );

    // WHEN the TextConfirmModalDialog is rendered
    render(givenNewConversationDialog);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND dialog title should have the correct text
    const titleElement = screen.getByTestId(APPROVAL_MODAL_TEST_ID.CONFIRM_MODAL_TITLE);
    expect(titleElement).toHaveTextContent(givenTitle);

    // AND paragraphs should have the correct text
    const contentParagraphs = screen.getAllByTestId(DATA_TEST_ID.TEXT_CONFIRM_MODAL_PARAGRAPH);
    expect(contentParagraphs).toHaveLength(2);
    // TODO: fix this
    // contentParagraphs.forEach((paragraph, index) => {
    //   expect(paragraph).toHaveTextContent(givenTextParagraphs[index].text);
    // });

    // AND buttons should have the correct text
    const cancelButton = screen.getByTestId(APPROVAL_MODAL_TEST_ID.CONFIRM_MODAL_CANCEL);
    const confirmButton = screen.getByTestId(APPROVAL_MODAL_TEST_ID.CONFIRM_MODAL_CONFIRM);
    expect(cancelButton).toHaveTextContent(givenCancelButtonText);
    expect(confirmButton).toHaveTextContent(givenApproveButtonText);

    // WHEN clicking the cancel button
    cancelButton.click();
    // THEN the cancel handler should be called
    expect(givenOnCancel).toHaveBeenCalledTimes(1);

    // WHEN clicking the approve button
    confirmButton.click();
    // THEN the approve handler should be called
    expect(givenOnApprove).toHaveBeenCalledTimes(1);

    // AND dialog should match the snapshot
    const dialogContainer = screen.getByTestId(APPROVAL_MODAL_TEST_ID.CONFIRM_MODAL);
    expect(dialogContainer).toMatchSnapshot();
  });
});

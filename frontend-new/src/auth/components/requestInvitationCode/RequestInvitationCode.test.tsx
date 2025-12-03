// mute chatty console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import * as Sentry from "@sentry/react";
import "src/_test_utilities/sentryMock"

import RequestInvitationCode, { DATA_TEST_ID as REQUEST_INVITATION_CODE_DATA_TEST_ID, UI_TEXT} from "./RequestInvitationCode";
import { InvitationType } from "src/auth/services/invitationsService/invitations.types";
import RequestInvitationCodeFormModal, { DATA_TEST_ID as REQUEST_INVITATION_CODE_FORM_MODAL_DATA_TEST_ID } from "src/auth/components/requestInvitationCode/requestInvitationCodeFormModal/RequestInvitationCodeFormModal";
jest.mock("src/auth/components/requestInvitationCode/requestInvitationCodeFormModal/RequestInvitationCodeFormModal", () => {
  const actual = jest.requireActual("src/auth/components/requestInvitationCode/requestInvitationCodeFormModal/RequestInvitationCodeFormModal");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() =>
        <div data-testid={actual.DATA_TEST_ID.CONTAINER} />
    )
  };
});

describe("RequestInvitationCode", () => {
    test("renders null when Sentry is not initialized", () => {
      // GIVEN sentry is not initialized
      jest.spyOn(Sentry, "isInitialized").mockReturnValue(false);

      // WHEN the component is rendered
      render(<RequestInvitationCode invitationCodeType={InvitationType.LOGIN} />);

      // THEN the link should not render
      expect(screen.queryByTestId(REQUEST_INVITATION_CODE_DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK)).not.toBeInTheDocument();
      // AND the modal should not render
      expect(screen.queryByTestId(REQUEST_INVITATION_CODE_FORM_MODAL_DATA_TEST_ID.CONTAINER)).not.toBeInTheDocument();
  });

  test("renders the correct text and link when Sentry is initialized", () => {
    // GIVEN sentry is initialized
    jest.spyOn(Sentry, "isInitialized").mockReturnValue(true);

    // WHEN the component is rendered
    render(<RequestInvitationCode invitationCodeType={InvitationType.LOGIN} />);

    // THEN the component should render the correct text and link
    expect(screen.getByTestId(`${REQUEST_INVITATION_CODE_DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK}`)).toBeInTheDocument();
  });

  test("opens the modal when the link is clicked", async () => {
    // GIVEN sentry is initialized
    jest.spyOn(Sentry, "isInitialized").mockReturnValue(true);

    // WHEN the component is rendered
    render(<RequestInvitationCode invitationCodeType={InvitationType.LOGIN} />);

    // THEN the modal should be opened when the link is clicked
    await userEvent.click(screen.getByTestId(`${REQUEST_INVITATION_CODE_DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK}`));
    expect(screen.getByTestId(REQUEST_INVITATION_CODE_FORM_MODAL_DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(RequestInvitationCodeFormModal).toHaveBeenCalled();
  });

  test("calls notifyOnModalOpened when the modal is opened", async () => {
    // GIVEN sentry is initialized
    jest.spyOn(Sentry, "isInitialized").mockReturnValue(true);
    // AND a mock callback is provided
    const mockNotifyOnModalOpened = jest.fn();

    // WHEN the component is rendered
    render(
      <RequestInvitationCode 
        invitationCodeType={InvitationType.LOGIN}
        notifyOnModalOpened={mockNotifyOnModalOpened}
      />
    );

    // AND the link is clicked
    await userEvent.click(screen.getByTestId(`${REQUEST_INVITATION_CODE_DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK}`));

    // THEN the callback should be called
    expect(mockNotifyOnModalOpened).toHaveBeenCalledTimes(1);
  });

  test.each([
    [InvitationType.REGISTER, UI_TEXT.REQUEST_REGISTRATION_CODE],
    [InvitationType.LOGIN, UI_TEXT.REQUEST_LOGIN_CODE],
  ])("renders the correct text for %s code type", (givenInvitationType: InvitationType, expectedText: string) => {
    // GIVEN sentry is initialized
    jest.spyOn(Sentry, "isInitialized").mockReturnValue(true);

    // WHEN the component is rendered
    render(<RequestInvitationCode invitationCodeType={givenInvitationType} />);

    // THEN the component should render the expected text
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });
}); 
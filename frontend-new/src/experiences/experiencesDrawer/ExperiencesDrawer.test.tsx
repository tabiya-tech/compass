// mute the console
import "src/_test_utilities/consoleMock";

import ExperiencesDrawer, { DATA_TEST_ID } from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import { fireEvent } from "@testing-library/react";
import { render, screen } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/experiences/experiencesDrawer/experienceService/_test_utilities/mockExperiencesResponses";
import { DATA_TEST_ID as EXPERIENCES_DRAWER_HEADER_TEST_ID } from "src/experiences/experiencesDrawer/components/experiencesDrawerHeader/ExperiencesDrawerHeader";
import { DATA_TEST_ID as EXPERIENCES_DRAWER_CONTENT_TEST_ID } from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";

// mock custom text field
jest.mock("src/theme/CustomTextField/CustomTextField", () => {
  return jest.fn(({ label, ...props }) => {
    return <input aria-label={label} {...props} data-testid={"mock-CustomTextField"} />;
  });
});

// mock DownloadReportDropdown
jest.mock("src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown", () => {
  return jest.fn(() => {
    return <div data-testid={"mock-DownloadReportDropdown"} />;
  });
});

describe("ExperiencesDrawer", () => {
  test("should render ExperiencesDrawer correctly", () => {
    // GIVEN the ExperiencesDrawer component
    const givenExperiencesDrawer = (
      <ExperiencesDrawer
        isOpen={true}
        isLoading={false}
        experiences={mockExperiences}
        notifyOnClose={jest.fn()}
        conversationConductedAt="2021-06-01T00:00:00Z"
      />
    );

    // WHEN the component is rendered
    render(givenExperiencesDrawer);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the experiences drawer container to be in the document
    const experiencesDrawerContainer = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTAINER);
    expect(experiencesDrawerContainer).toBeInTheDocument();
    // AND the experiences drawer header to be in the document
    const experiencesDrawerHeaderContainer = screen.getByTestId(
      EXPERIENCES_DRAWER_HEADER_TEST_ID.EXPERIENCES_DRAWER_HEADER_CONTAINER
    );
    expect(experiencesDrawerHeaderContainer).toBeInTheDocument();
    // AND the divider to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DIVIDER)).toBeInTheDocument();
    // AND the experiences drawer content to be in the document
    const experiencesDrawerContentContainer = screen.getAllByTestId(
      EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_CONTENT_CONTAINER
    );
    expect(experiencesDrawerContentContainer).toHaveLength(mockExperiences.length);
    // AND to match the snapshot
    expect(experiencesDrawerContainer).toMatchSnapshot();
  });

  test("should call notifyOnClose when close button is clicked", () => {
    // GIVEN the ExperiencesDrawer component
    const notifyOnClose = jest.fn();
    const givenExperiencesDrawer = (
      <ExperiencesDrawer
        isOpen={true}
        isLoading={false}
        experiences={mockExperiences}
        notifyOnClose={notifyOnClose}
        conversationConductedAt="2021-06-01T00:00:00Z"
      />
    );
    // AND the component is rendered
    render(givenExperiencesDrawer);

    // WHEN the close button is clicked
    const closeButton = screen.getByTestId(EXPERIENCES_DRAWER_HEADER_TEST_ID.EXPERIENCES_DRAWER_HEADER_BUTTON);
    fireEvent.click(closeButton);

    // THEN expect notifyOnClose to have been called
    expect(notifyOnClose).toHaveBeenCalledWith({ name: "DISMISS" });
  });

  test("it should show the right text when there are no experiences", () => {
    // GIVEN the ExperiencesDrawer component
    const givenExperiencesDrawer = (
      <ExperiencesDrawer
        isOpen={true}
        isLoading={false}
        experiences={[]}
        notifyOnClose={jest.fn()}
        conversationConductedAt="2021-06-01T00:00:00Z"
      />
    );
    // AND the component is rendered
    render(givenExperiencesDrawer);

    // THEN expect the text to be in the document
    const noExperiencesText = screen.getByText(
      "We haven’t yet discovered any experiences so far, Let's continue chatting."
    );
    expect(noExperiencesText).toBeInTheDocument();
  });

  test("it should show loading state when isLoading is true", () => {
    // GIVEN the ExperiencesDrawer component
    const givenExperiencesDrawer = (
      <ExperiencesDrawer
        isOpen={true}
        isLoading={true}
        experiences={[]}
        notifyOnClose={jest.fn()}
        conversationConductedAt="2021-06-01T00:00:00Z"
      />
    );
    // AND the component is rendered
    render(givenExperiencesDrawer);

    // THEN expect the loading state to be in the document
    const loadingContainer = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_LOADER);
    expect(loadingContainer).toBeInTheDocument();
  });

  test("should handle onChange correctly when the text field changes", () => {
    // GIVEN the ExperiencesDrawer component
    const givenExperiencesDrawer = (
      <ExperiencesDrawer
        isOpen={true}
        isLoading={false}
        experiences={mockExperiences}
        notifyOnClose={jest.fn()}
        conversationConductedAt="2021-06-01T00:00:00Z"
      />
    );
    // AND the component is rendered
    render(givenExperiencesDrawer);

    // WHEN the name field is changed
    const nameField = screen.getByLabelText("Name:");
    fireEvent.change(nameField, { target: { value: "John Doe" } });
    // THEN expect the name field to have the correct value
    expect(nameField).toHaveValue("John Doe");

    // WHEN the email field is changed
    const emailField = screen.getByLabelText("Email:");
    fireEvent.change(emailField, { target: { value: "john.doe@example.com" } });
    // THEN expect the email field to have the correct value
    expect(emailField).toHaveValue("john.doe@example.com");

    // WHEN the phone field is changed
    const phoneField = screen.getByLabelText("Phone:");
    // THEN expect the phone field to have the correct value
    fireEvent.change(phoneField, { target: { value: "1234567890" } });
    expect(phoneField).toHaveValue("1234567890");

    // WHEN the address field is changed
    const addressField = screen.getByLabelText("Address:");
    fireEvent.change(addressField, { target: { value: "123 Main St" } });
    // THEN expect the address field to have the correct value
    expect(addressField).toHaveValue("123 Main St");
  });
});

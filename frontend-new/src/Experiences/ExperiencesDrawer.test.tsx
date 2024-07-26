// mute the console
import "src/_test_utilities/consoleMock";

import ExperiencesDrawer, { DATA_TEST_ID } from "./ExperiencesDrawer";
import { fireEvent } from "@testing-library/react";
import { render, screen } from "src/_test_utilities/test-utils";
import { mockExperiences } from "./ExperienceService/_test_utilities/mockExperiencesResponses";
import { DATA_TEST_ID as EXPERIENCES_DRAWER_HEADER_TEST_ID } from "src/Experiences/components/ExperiencesDrawerHeader/ExperiencesDrawerHeader";
import { DATA_TEST_ID as EXPERIENCES_DRAWER_CONTENT_TEST_ID } from "src/Experiences/components/ExperiencesDrawerContent/ExperiencesDrawerContent";

describe("ExperiencesDrawer", () => {
  test("should render ExperiencesDrawer correctly", () => {
    // GIVEN the ExperiencesDrawer component
    const givenExperiencesDrawer = (
      <ExperiencesDrawer isOpen={true} isLoading={false} experiences={mockExperiences} notifyOnClose={jest.fn()} />
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
      <ExperiencesDrawer isOpen={true} isLoading={false} experiences={mockExperiences} notifyOnClose={notifyOnClose} />
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
    const givenExperiencesDrawer = <ExperiencesDrawer isOpen={true} isLoading={false} experiences={[]} notifyOnClose={jest.fn()} />;
    // AND the component is rendered
    render(givenExperiencesDrawer);

    // THEN expect the text to be in the document
    const noExperiencesText = screen.getByText("We haven’t yet discovered any experiences so far, Let's continue chatting.");
    expect(noExperiencesText).toBeInTheDocument();
  })
});

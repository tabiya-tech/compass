// mute the console
import "src/_test_utilities/consoleMock";

import ExperiencesDrawerContent, {
  DATA_TEST_ID,
  LoadingExperienceDrawerContent,
} from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { render, screen } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/experiences/experiencesDrawer/experienceService/_test_utilities/mockExperiencesResponses";
import { fireEvent, waitFor } from "@testing-library/react";

describe("ReportDrawerContent", () => {
  test("should render ExperiencesDrawerContent correctly", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} />;

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the report drawer content container to be in the document
    const reportDrawerContentContainer = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_CONTAINER);
    expect(reportDrawerContentContainer).toBeInTheDocument();
    // AND the report drawer content date to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_DATE)).toBeInTheDocument();
    // AND the report drawer content occupation to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_OCCUPATION)).toBeInTheDocument();
    // AND the report drawer content skills to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_SKILLS)).toBeInTheDocument();
    // AND the report drawer skills container to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_SKILLS_CONTAINER)).toBeInTheDocument();
    // AND the report drawer chips to be in the document
    const chips = screen.getAllByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CHIP);
    chips.forEach((chip) => expect(chip).toBeInTheDocument());
    // AND to match the snapshot
    expect(reportDrawerContentContainer).toMatchSnapshot();
  });

  test("should render ExperiencesDrawerContent skeleton correctly", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = <LoadingExperienceDrawerContent />;

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect no errors or warning to have occurred
    const loadingContainer = screen.getByTestId(DATA_TEST_ID.LOADING_EXPERIENCES_DRAWER_CONTENT_CONTAINER);
    expect(loadingContainer).toBeInTheDocument();

    // AND expect skeleton elements to be in the document
    const skeletonElement = screen.getAllByTestId("skeleton-text");
    expect(skeletonElement).toHaveLength(3);

    // AND to match the snapshot
    expect(loadingContainer).toMatchSnapshot();
  });

  test("it should show No skills yet when there are no skills", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={{ ...mockExperiences[0], top_skills: [] }} />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect No skills yet to be in the document
    expect(screen.getByText("No skills discovered yet")).toBeInTheDocument();
  });

  test("should show skill description when chip is clicked", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} />;
    // AND the component is rendered
    render(givenReportDrawerContent);

    // WHEN the chip is clicked
    const chip = screen.getAllByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CHIP)[0];
    fireEvent.click(chip);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the popover to be in the document
    const popoverEl = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_POPOVER);
    expect(popoverEl).toBeInTheDocument();
    // AND the skill description to be in the document
    expect(screen.getByText(mockExperiences[0].top_skills[0].description)).toBeInTheDocument();
  });

  test("should close popover when clicked outside", async () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} />;
    // AND the component is rendered
    render(givenReportDrawerContent);
    // AND the chip is clicked
    const chip = screen.getAllByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CHIP)[0];
    fireEvent.click(chip);
    // AND the popover is open
    const popoverEl = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_POPOVER);
    expect(popoverEl).toBeVisible();

    // WHEN the user clicks outside the popover
    fireEvent.keyDown(popoverEl, { key: "Escape" });

    // THEN expect the popover to be invisible
    await waitFor(() => {
      expect(popoverEl).not.toBeInTheDocument();
    });
    // AND expect the skill description to not be in the document
    expect(screen.queryByText(mockExperiences[0].top_skills[0].description)).not.toBeInTheDocument();
  });
});

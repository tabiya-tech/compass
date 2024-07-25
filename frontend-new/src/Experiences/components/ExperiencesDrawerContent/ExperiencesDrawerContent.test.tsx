// mute the console
import "src/_test_utilities/consoleMock";

import ExperiencesDrawerContent, {
  DATA_TEST_ID,
} from "src/Experiences/components/ExperiencesDrawerContent/ExperiencesDrawerContent";
import { render, screen } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/Experiences/ExperienceService/_test_utilities/mockExperiencesResponses";

describe("ReportDrawerContent", () => {
  test("should render ExperiencesDrawerContent correctly", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} isLoading={false} />
    );

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
    // AND to match the snapshot
    expect(reportDrawerContentContainer).toMatchSnapshot();
  });

  test("should render ExperiencesDrawerContent skeleton correctly", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} isLoading={true} />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect skeleton elements to be in the document
    const skeletonElement = screen.getAllByTestId("skeleton-text");
    expect(skeletonElement).toHaveLength(3);
  });
});

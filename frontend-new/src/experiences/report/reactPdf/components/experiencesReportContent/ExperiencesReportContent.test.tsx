// mute the console
import "src/_test_utilities/consoleMock";

import ExperiencesReportContent, {
  DATA_TEST_ID,
} from "src/experiences/report/reactPdf/components/experiencesReportContent/ExperiencesReportContent";
import { mockExperiences } from "src/experiences/experiencesDrawer/experienceService/_test_utilities/mockExperiencesResponses";
import { render, screen } from "src/_test_utilities/test-utils";

describe("ExperiencesReportContent", () => {
  test("should render ExperiencesReportContent correctly", () => {
    // GIVEN the ExperiencesReportContent component
    const givenExperiencesContentReport = <ExperiencesReportContent experience={{ ...mockExperiences[0] }} />;

    // WHEN the component is rendered
    render(givenExperiencesContentReport);

    // THEN expect the report content container to be in the document
    const reportContentContainer = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_CONTAINER);
    expect(reportContentContainer).toBeInTheDocument();
    // AND the report content date to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_DATE)).toBeInTheDocument();
    // AND the report content experience title to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_TITLE)).toBeInTheDocument();
    // AND the report content skills to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_SKILLS)).toBeInTheDocument();
    // AND the experience info to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_INFO)).toBeInTheDocument();
    // AND the company to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_COMPANY)).toBeInTheDocument();
    // AND the location to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_LOCATION)).toBeInTheDocument();
    // AND to match the snapshot
    expect(reportContentContainer).toMatchSnapshot();
  });
});

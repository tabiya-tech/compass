// mute the console
import "src/_test_utilities/consoleMock";

import ExperiencesReportContent, {
  DATA_TEST_ID,
} from "src/experiences/report/reportPdf/components/experiencesReportContent/ExperiencesReportContent";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { render, screen } from "src/_test_utilities/test-utils";
import { defaultSkillsReportOutputConfig } from "src/experiences/report/config/default";
import { ReportConfig } from "src/experiences/report/config/types";

describe("ExperiencesReportContent", () => {
  const defaultReportConfig = defaultSkillsReportOutputConfig.report;

  test("should render ExperiencesReportContent correctly", () => {
    // GIVEN the ExperiencesReportContent component
    const givenExperiencesContentReport = (
      <ExperiencesReportContent experience={{ ...mockExperiences[0] }} reportConfig={defaultReportConfig} />
    );

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
    // AND the report content experience summary to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_SUMMARY)).toBeInTheDocument();
    // AND to match the snapshot
    expect(reportContentContainer).toMatchSnapshot();
  });

  describe("Field Visibility Configuration", () => {
    test("should hide title when experienceDetails.title is false", () => {
      // GIVEN a config with title disabled
      const givenConfig: ReportConfig = {
        ...defaultReportConfig,
        experienceDetails: {
          ...defaultReportConfig.experienceDetails,
          title: false,
        },
      };

      // WHEN the component is rendered
      render(<ExperiencesReportContent experience={{ ...mockExperiences[0] }} reportConfig={givenConfig} />);

      // THEN the title should not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_TITLE)).not.toBeInTheDocument();
    });

    test("should hide date range when experienceDetails.dateRange is false", () => {
      // GIVEN a config with dateRange disabled
      const givenConfig: ReportConfig = {
        ...defaultReportConfig,
        experienceDetails: {
          ...defaultReportConfig.experienceDetails,
          dateRange: false,
        },
      };

      // WHEN the component is rendered
      render(<ExperiencesReportContent experience={{ ...mockExperiences[0] }} reportConfig={givenConfig} />);

      // THEN the date should not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_DATE)).not.toBeInTheDocument();
    });

    test("should hide company name when experienceDetails.companyName is false", () => {
      // GIVEN a config with companyName disabled
      const givenConfig: ReportConfig = {
        ...defaultReportConfig,
        experienceDetails: {
          ...defaultReportConfig.experienceDetails,
          companyName: false,
        },
      };

      // WHEN the component is rendered
      render(<ExperiencesReportContent experience={{ ...mockExperiences[0] }} reportConfig={givenConfig} />);

      // THEN the company should not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_COMPANY)).not.toBeInTheDocument();
    });

    test("should hide location when experienceDetails.location is false", () => {
      // GIVEN a config with location disabled
      const givenConfig: ReportConfig = {
        ...defaultReportConfig,
        experienceDetails: {
          ...defaultReportConfig.experienceDetails,
          location: false,
        },
      };

      // WHEN the component is rendered
      render(<ExperiencesReportContent experience={{ ...mockExperiences[0] }} reportConfig={givenConfig} />);

      // THEN the location should not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_LOCATION)).not.toBeInTheDocument();
    });

    test("should hide summary when summary.show is false", () => {
      // GIVEN a config with summary disabled
      const givenConfig: ReportConfig = {
        ...defaultReportConfig,
      };

      givenConfig.experienceDetails.summary = false;

      // WHEN the component is rendered
      render(<ExperiencesReportContent experience={{ ...mockExperiences[0] }} reportConfig={givenConfig} />);

      // THEN the summary should not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_SUMMARY)).not.toBeInTheDocument();
    });

    test("should hide all experience info when all detail fields are disabled", () => {
      // GIVEN a config with all detail fields disabled
      const givenConfig: ReportConfig = {
        ...defaultReportConfig,
        experienceDetails: {
          title: false,
          summary: false,
          dateRange: false,
          companyName: false,
          location: false,
        },
        summary: {
          show: false,
        },
      };

      // WHEN the component is rendered
      render(<ExperiencesReportContent experience={{ ...mockExperiences[0] }} reportConfig={givenConfig} />);

      // THEN the info container should not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_INFO)).not.toBeInTheDocument();
      // AND neither should the title
      expect(screen.queryByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_TITLE)).not.toBeInTheDocument();
      // AND neither should the summary
      expect(screen.queryByTestId(DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_SUMMARY)).not.toBeInTheDocument();
    });
  });
});

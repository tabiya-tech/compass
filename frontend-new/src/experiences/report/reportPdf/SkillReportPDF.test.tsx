// mute the console
import "src/_test_utilities/consoleMock";

import SkillReportPDF, { DATA_TEST_ID } from "src/experiences/report/reportPdf/SkillReportPDF";
import { render, screen } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { defaultSkillsReportOutputConfig } from "src/experiences/report/config/default";

describe("Report", () => {
  test("should render Report correctly", () => {
    // GIVEN the Report component
    const experiences = mockExperiences;
    const givenReport = (
      <SkillReportPDF
        name="John Doe"
        email="johndoe@example.com"
        phone="1234567890"
        address="1234 Main St"
        experiences={experiences}
        conversationConductedAt="2021-06-01T00:00:00Z"
        config={defaultSkillsReportOutputConfig}
      />
    );

    // AND GET: Image will return a base64 image
    const mockedCustomerFetch = setupAPIServiceSpy(200, new Blob(["mock file content"]), "image/png");

    // WHEN the component is rendered
    render(givenReport);

    // THEN expect the report container to be in the document
    const reportContainer = screen.getByTestId(DATA_TEST_ID.SKILL_REPORT_CONTAINER);
    expect(reportContainer).toBeInTheDocument();
    // AND the report title to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.SKILL_REPORT_TITLE)).toBeInTheDocument();
    // AND the name to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.SKILL_REPORT_NAME)).toBeInTheDocument();
    // AND the email to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.SKILL_REPORT_EMAIL)).toBeInTheDocument();
    // AND the phone to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.SKILL_REPORT_PHONE)).toBeInTheDocument();
    // AND the address to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.SKILL_REPORT_ADDRESS)).toBeInTheDocument();
    // AND the experiences to be in the document
    const experiencesContainer = screen.getByTestId(DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_CONTAINER);
    expect(experiencesContainer).toBeInTheDocument();
    expect(experiencesContainer.children.length).toBe(experiences.length);
    // AND to match the snapshot
    expect(reportContainer).toMatchSnapshot();

    // AND the fetch should be called with authRequired:false.
    expect(mockedCustomerFetch).toHaveBeenCalledWith(
      expect.any(String), // Image Path,
      expect.objectContaining({
        authRequired: false, // With no Authentication.
      })
    );
  });
});

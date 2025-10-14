// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, userEvent } from "src/_test_utilities/test-utils";
import UploadedCVsAccordion, { DATA_TEST_ID } from "src/CV/uploadedCVsAccordion/UploadedCVsAccordion";
import { CVListItem } from "src/CV/CVService/CVService.types";
import { ConversationPhase } from "src/chat/chatProgressbar/types";

describe("UploadedCVsAccordion", () => {
  test("should render the Uploaded CVs Accordion component correctly", () => {
    // GIVEN a component
    const givenComponent = (
      <UploadedCVsAccordion
        items={[
          {
            upload_id: "1",
            filename: "John_Doe_CV.pdf",
            uploaded_at: new Date().toISOString(),
            upload_process_state: "COMPLETED",
            experiences_data: [],
          },
        ]}
        onSelect={() => {}}
        currentPhase={ConversationPhase.COLLECT_EXPERIENCES}
      />
    );

    // WHEN component is rendered
    render(givenComponent);

    // THEN expect the uploaded CVs accordion to be visible
    const uploadedCVsAccordion = screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_ACCORDION);
    expect(uploadedCVsAccordion).toBeInTheDocument();
    // AND expect the uploaded CVs accordion summary to be visible
    expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_ACCORDION_SUMMARY)).toBeInTheDocument();
    // AND expect the uploaded CVs file name to be visible
    expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_FILE_NAME)).toBeInTheDocument();
    // AND expect the uploaded CVs upload date to be visible
    expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_UPLOAD_DATE)).toBeInTheDocument();
    // AND expect the uploaded CVs description icon to be visible
    expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_DESCRIPTION_ICON)).toBeInTheDocument();
    // AND the component to match the snapshot
    expect(uploadedCVsAccordion).toMatchSnapshot();
    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should call onSelect when a CV is clicked", async () => {
    const user = userEvent.setup();

    // GIVEN a mock onSelect function
    const mockOnSelect = jest.fn();

    // AND a mock uploaded CV
    const mockUploadedCv: CVListItem = {
      upload_id: "001",
      filename: "John_Doe_CV.pdf",
      uploaded_at: new Date().toISOString(),
      upload_process_state: "COMPLETED",
      experiences_data: ["Experience 1", "Experience 2"],
    };

    // AND the component is rendered
    render(
      <UploadedCVsAccordion
        items={[mockUploadedCv]}
        onSelect={mockOnSelect}
        currentPhase={ConversationPhase.COLLECT_EXPERIENCES}
      />
    );

    // WHEN the accordion is expanded
    const summary = screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_ACCORDION_SUMMARY);
    await user.click(summary);
    // AND the CV item is clicked
    const cvItem = await screen.findByTestId(DATA_TEST_ID.UPLOADED_CVS_ACCORDION_DETAILS);
    await user.click(cvItem);

    // THEN expect the mock onSelect function to have been called with the correct CV item
    expect(mockOnSelect).toHaveBeenCalledWith(mockUploadedCv);
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});

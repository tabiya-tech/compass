// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, userEvent } from "src/_test_utilities/test-utils";
import UploadedCVsMenu, { DATA_TEST_ID } from "src/CV/uploadedCVsMenu/UploadedCVsMenu";
import { ConversationPhase } from "src/chat/chatProgressbar/types";
import { CVListItem } from "src/CV/CVService/CVService.types";

// mock help tip component
jest.mock("src/theme/HelpTip/HelpTip", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((props) => <div data-testid={props["data-testid"]} />),
  };
});

describe("UploadedCVsMenuContent", () => {
  describe("render tests", () => {
    test("should render the Uploaded CVs Menu Content component correctly", () => {
      // GIVEN a component
      const givenComponent = (
        <UploadedCVsMenu
          uploadedCVs={[
            {
              upload_id: "1",
              filename: "foo_bar.pdf",
              uploaded_at: new Date().toISOString(),
              upload_process_state: "COMPLETED",
              experiences_data: [],
            },
          ]}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          currentPhase={ConversationPhase.COLLECT_EXPERIENCES}
          isLoading={false}
        />
      );

      // WHEN component is rendered
      render(givenComponent);

      // THEN expect the uploaded CVs menu content to be visible
      const uploadedCVsMenuContent = screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_CONTENT);
      expect(uploadedCVsMenuContent).toBeInTheDocument();
      // AND expect the uploaded CVS arrow back icon to be visible
      expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_ARROW_BACK_ICON)).toBeInTheDocument();
      // AND expect the uploaded CVs uploaded text to be visible
      expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_UPLOADED_TEXT)).toBeInTheDocument();
      // AND expect the uploaded CVs help tip to be visible
      expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_HELP_TIP)).toBeInTheDocument();
      // AND expect the uploaded CVs file name to be visible
      expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_FILE_NAME)).toBeInTheDocument();
      // AND expect the uploaded CVs upload date to be visible
      expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_UPLOAD_DATE)).toBeInTheDocument();
      // AND expect the uploaded CVs description icon to be visible
      expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_DESCRIPTION_ICON)).toBeInTheDocument();
      // AND the component to match the snapshot
      expect(uploadedCVsMenuContent).toMatchSnapshot();
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should render correctly when loading", () => {
      // GIVEN a component that is loading
      const givenIsLoading = true;

      // WHEN component is rendered
      render(
        <UploadedCVsMenu
          uploadedCVs={[]}
          onSelect={jest.fn()}
          onBack={jest.fn()}
          currentPhase={ConversationPhase.COLLECT_EXPERIENCES}
          isLoading={givenIsLoading}
        />
      );

      // THEN expect the uploaded CVs menu content to be visible
      const uploadedCVsMenuContent = screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_CONTENT);
      expect(uploadedCVsMenuContent).toBeInTheDocument();
      // AND the skeleton to be visible
      expect(screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_SKELETON)).toBeInTheDocument();
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("action tests", () => {
    test("should call onSelect when a CV is clicked", async () => {
      // GIVEN a mock onSelect function
      const mockOnSelect = jest.fn();
      // AND a mock uploaded CV
      const mockUploadedCv: CVListItem = {
        upload_id: "1",
        filename: "foo_bar.pdf",
        uploaded_at: new Date().toISOString(),
        upload_process_state: "COMPLETED",
        experiences_data: ["foo", "bar"],
      };
      // AND the component is rendered
      render(
        <UploadedCVsMenu
          uploadedCVs={[mockUploadedCv]}
          onSelect={mockOnSelect}
          onBack={jest.fn()}
          currentPhase={ConversationPhase.COLLECT_EXPERIENCES}
          isLoading={false}
        />
      );

      // WHEN the user clicks on the uploaded CV item
      const cvItem = screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_FILE_NAME);
      await userEvent.click(cvItem);

      // THEN expect the mock onSelect function to have been called with the correct CV
      expect(mockOnSelect).toHaveBeenCalledWith(mockUploadedCv);
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should call onBack when the back button is clicked", async () => {
      // GIVEN a mock onBack function
      const mockOnBack = jest.fn();
      // AND the component is rendered
      render(
        <UploadedCVsMenu
          uploadedCVs={[]}
          onSelect={jest.fn()}
          onBack={mockOnBack}
          currentPhase={ConversationPhase.COLLECT_EXPERIENCES}
          isLoading={false}
        />
      );

      // WHEN the user clicks on the back button
      const backButton = screen.getByTestId(DATA_TEST_ID.UPLOADED_CVS_MENU_ARROW_BACK_ICON);
      await userEvent.click(backButton);

      // THEN expect the mock onBack function to have been called
      expect(mockOnBack).toHaveBeenCalled();
      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});

// mute the console
import "src/_test_utilities/consoleMock";

import RestoreExperiencesDrawer from "src/experiences/experiencesDrawer/components/restoreExperiencesDrawer/RestoreExperiencesDrawer";
import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import ExperienceService from "src/experiences/experienceService/experienceService";
import { DATA_TEST_ID } from "src/experiences/experiencesDrawer/ExperiencesDrawer";

const sessionId = 123;
const onClose = jest.fn();
const onRestore = jest.fn();
const onExperiencesRestored = jest.fn();
const currentExperiences = mockExperiences.slice(0, 1); // Only one is not deleted

describe("RestoreExperiencesDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should render loading state when open", async () => {
    jest.spyOn(ExperienceService.getInstance(), "getExperiences").mockImplementation(() => new Promise(() => {}));
    render(
      <RestoreExperiencesDrawer
        isOpen={true}
        onClose={onClose}
        onRestore={onRestore}
        sessionId={sessionId}
        onExperiencesRestored={onExperiencesRestored}
        currentExperiences={currentExperiences}
      />
    );
    // THEN loading skeletons are shown
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_LOADER)).toBeInTheDocument();
  });

  test("should render empty state when no deleted experiences", async () => {
    jest.spyOn(ExperienceService.getInstance(), "getExperiences").mockResolvedValueOnce(currentExperiences);
    render(
      <RestoreExperiencesDrawer
        isOpen={true}
        onClose={onClose}
        onRestore={onRestore}
        sessionId={sessionId}
        onExperiencesRestored={onExperiencesRestored}
        currentExperiences={currentExperiences}
      />
    );
    // THEN empty state is shown
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCES_EMPTY_MESSAGE)).toBeInTheDocument();
    });
    // AND Go Back button is present
    expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCES_GO_BACK_BUTTON)).toBeInTheDocument();
  });

  test("should call onClose when Go Back is clicked in empty state", async () => {
    jest.spyOn(ExperienceService.getInstance(), "getExperiences").mockResolvedValueOnce(currentExperiences);
    render(
      <RestoreExperiencesDrawer
        isOpen={true}
        onClose={onClose}
        onRestore={onRestore}
        sessionId={sessionId}
        onExperiencesRestored={onExperiencesRestored}
        currentExperiences={currentExperiences}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCES_GO_BACK_BUTTON)).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCES_GO_BACK_BUTTON));
    expect(onClose).toHaveBeenCalled();
  });

  test("should handle error if getExperiences rejects", async () => {
    jest.spyOn(ExperienceService.getInstance(), "getExperiences").mockRejectedValueOnce(new Error("API Error"));
    render(
      <RestoreExperiencesDrawer
        isOpen={true}
        onClose={onClose}
        onRestore={onRestore}
        sessionId={sessionId}
        onExperiencesRestored={onExperiencesRestored}
        currentExperiences={currentExperiences}
      />
    );
    // THEN loading skeletons are shown, but error is handled silently (no crash)
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_LOADER)).toBeInTheDocument();
    // Wait for the effect to finish
    await waitFor(() => {
      expect(screen.queryByText("No deleted experiences found.")).not.toBeInTheDocument();
    });
  });
}); 
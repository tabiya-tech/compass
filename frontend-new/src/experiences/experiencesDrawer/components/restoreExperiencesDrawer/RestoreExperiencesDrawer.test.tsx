// mute the console
import "src/_test_utilities/consoleMock";

import RestoreExperiencesDrawer, {
  DATA_TEST_ID,
} from "src/experiences/experiencesDrawer/components/restoreExperiencesDrawer/RestoreExperiencesDrawer";
import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import ExperienceService from "src/experiences/experienceService/experienceService";
import { DiveInPhase, Experience } from "src/experiences/experienceService/experiences.types";

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
    jest.spyOn(ExperienceService.getInstance(), "getExperiences").mockImplementation(() => new Promise(() => []));
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
    expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_LOADER)).toBeInTheDocument();
  });

  test("should render empty state when no deleted experiences", async () => {
    jest.spyOn(ExperienceService.getInstance(), "getExperiences").mockResolvedValueOnce([]);
    render(
      <RestoreExperiencesDrawer
        isOpen={true}
        onClose={onClose}
        onRestore={onRestore}
        sessionId={sessionId}
        onExperiencesRestored={onExperiencesRestored}
        currentExperiences={[]}
      />
    );
    // THEN empty state is shown
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCES_EMPTY_MESSAGE)).toBeInTheDocument();
    });
    // AND the Go Back button is present
    expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCES_GO_BACK_BUTTON)).toBeInTheDocument();
  });

  test("should render deleted experiences when available", async () => {
    // GIVEN a deleted experience
    const deletedExperience: Experience = {
      ...mockExperiences[1],
      exploration_phase: DiveInPhase.PROCESSED,
    };
    // AND a mock for getExperiences that returns some experiences (when asked deleted)
   const getExperiencesMock = jest
      .spyOn(ExperienceService.getInstance(), "getExperiences")
      .mockResolvedValueOnce([deletedExperience]);

    // WHEN the component is rendered
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

    // THEN the getExperiences mock should have been called with sessionId and true for deleted
    expect(getExperiencesMock).toHaveBeenCalledWith(sessionId, true);
    // AND expect the deleted experience to be shown
    const restoreExperience = screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCES);
    expect(restoreExperience).toBeInTheDocument();
    // AND loading skeletons to be shown
    expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_LOADER)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_CONTAINER)).toBeInTheDocument();
    });
    // AND the experience title to be shown
    expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_TITLE)).toBeInTheDocument();
    // AND the experience work type to be shown
    expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_WORK_TYPE)).toBeInTheDocument();
    // AND the restore button to be shown
    expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_BUTTON)).toBeInTheDocument();
    // AND the restore date to be shown
    expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_DATE)).toBeInTheDocument();
    // AND to match the snapshot
    expect(restoreExperience).toMatchSnapshot();
  });

  test("should call onClose when Go Back is clicked in empty state", async () => {
    jest.spyOn(ExperienceService.getInstance(), "getExperiences").mockResolvedValueOnce([]);
    render(
      <RestoreExperiencesDrawer
        isOpen={true}
        onClose={onClose}
        onRestore={onRestore}
        sessionId={sessionId}
        onExperiencesRestored={onExperiencesRestored}
        currentExperiences={[]}
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
    expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_LOADER)).toBeInTheDocument();
    // Wait for the effect to finish
    await waitFor(() => {
      expect(screen.queryByText("No deleted experiences found.")).not.toBeInTheDocument();
    });
  });

  test("should sort experiences alphabetically by title", async () => {
    // GIVEN unsorted experiences with various titles
    const unsortedExperiences: Experience[] = [
      { ...mockExperiences[0], UUID: "1", experience_title: "Foo"},
      { ...mockExperiences[0], UUID: "2", experience_title: "Bar"},
      { ...mockExperiences[0], UUID: "3", experience_title: "Baz"},
    ];
    // AND a mock for getExperiences that returns these unsorted experiences
    jest.spyOn(ExperienceService.getInstance(), "getExperiences").mockResolvedValueOnce([...unsortedExperiences]);

    // WHEN the component is rendered
    render(
      <RestoreExperiencesDrawer
        isOpen={true}
        onClose={onClose}
        onRestore={onRestore}
        sessionId={sessionId}
        onExperiencesRestored={onExperiencesRestored}
        currentExperiences={[]}
      />
    );

    // THEN the experiences are sorted alphabetically by title
    await waitFor(() => {
      const experienceTitles = screen.getAllByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_TITLE).map((el) => el.textContent);
      expect(experienceTitles).toEqual(["Bar", "Baz", "Foo"]);
    });
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should call onRestore when restore button is clicked", async () => {
    // GIVEN a deleted experience
    const deletedExperience: Experience = {
      ...mockExperiences[1],
      exploration_phase: DiveInPhase.PROCESSED,
    };
    // AND a mock for getExperiences that returns current and deleted experience
    jest
      .spyOn(ExperienceService.getInstance(), "getExperiences")
      .mockResolvedValueOnce([deletedExperience]);

    // WHEN the component is rendered
    render(
      <RestoreExperiencesDrawer
        isOpen={true}
        onClose={onClose}
        onRestore={onRestore}
        sessionId={sessionId}
        onExperiencesRestored={onExperiencesRestored}
        currentExperiences={[]}
      />
    );
    // AND the restore button is clicked
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_BUTTON)).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.RESTORE_EXPERIENCE_BUTTON));

    // THEN expect onRestore to be called with the correct experience
    expect(onRestore).toHaveBeenCalledWith(deletedExperience);
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});

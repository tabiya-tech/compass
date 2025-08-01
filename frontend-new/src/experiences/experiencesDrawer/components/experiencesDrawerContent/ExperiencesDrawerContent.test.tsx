// mute the console
import "src/_test_utilities/consoleMock";

import ExperiencesDrawerContent, {
  DATA_TEST_ID,
  LoadingExperienceDrawerContent,
  MENU_ITEM_ID,
  MENU_ITEM_TEXT,
} from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { render, screen } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { DATA_TEST_ID as CONTEXT_MENU_DATA_TEST_ID } from "src/theme/ContextMenu/ContextMenu";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import ExperienceService from "src/experiences/experienceService/experienceService";
import { DATA_TEST_ID as SKILL_POPOVER_TEST_ID } from "src/experiences/experiencesDrawer/components/skillPopover/SkillPopover";

// mock the ContextMenu
jest.mock("src/theme/ContextMenu/ContextMenu", () => {
  const actual = jest.requireActual("src/theme/ContextMenu/ContextMenu");
  return {
    __esModule: true,
    default: jest.fn(
      ({
        items,
        notifyOnClose,
        headerMessage,
      }: {
        items: MenuItemConfig[];
        notifyOnClose: () => void;
        headerMessage?: string;
      }) => (
        <div data-testid={actual.DATA_TEST_ID.MENU}>
          {headerMessage && <div data-testid={actual.DATA_TEST_ID.MENU_HEADER_MESSAGE}>{headerMessage}</div>}
          {items.map((item) => (
            <div key={item.id} data-testid={item.id} data-disabled={item.disabled} onClick={item.action}>
              {item.text}
            </div>
          ))}
          <button data-testid="close-menu-button" onClick={notifyOnClose}>
            Close
          </button>
        </div>
      )
    ),
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

describe("ReportDrawerContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAllMethodMocks(ExperienceService.getInstance());
  });
  test("should render ExperiencesDrawerContent correctly", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} onEdit={jest.fn()} onDelete={jest.fn()} />
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
    // AND the report drawer skills container to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_SKILLS_CONTAINER)).toBeInTheDocument();
    // AND the report drawer content experience summary to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_SUMMARY)).toBeInTheDocument();
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

  test("should render edit button if experience exploration phase is PROCESSED", () => {
    // GIVEN the ExperiencesDrawerContent component with a PROCESSED experience
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent
        experience={{ ...mockExperiences[0], exploration_phase: DiveInPhase.PROCESSED }}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the report drawer more button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)).toBeInTheDocument();
  });

  test.each([DiveInPhase.NOT_STARTED, DiveInPhase.EXPLORING_SKILLS, DiveInPhase.LINKING_RANKING])(
    "should display context menu with disabled actions when experience exploration phase is %s",
    async (phase) => {
      // GIVEN the ExperiencesDrawerContent component with a non-PROCESSED experience
      const givenReportDrawerContent = (
        <ExperiencesDrawerContent
          experience={{ ...mockExperiences[0], exploration_phase: phase }}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
        />
      );

      // WHEN the component is rendered
      render(givenReportDrawerContent);

      // AND the more button is clicked
      const moreButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
      await userEvent.click(moreButton);

      // THEN expect the context menu to be displayed
      const contextMenu = screen.getByTestId(CONTEXT_MENU_DATA_TEST_ID.MENU);
      expect(contextMenu).toBeInTheDocument();

      // AND there should be a header message
      expect(screen.getByTestId(CONTEXT_MENU_DATA_TEST_ID.MENU_HEADER_MESSAGE)).toBeInTheDocument();

      // AND all menu items should be disabled
      const editButton = screen.getByTestId(MENU_ITEM_ID.EDIT);
      expect(editButton).toHaveAttribute("data-disabled", "true");

      const deleteButton = screen.getByTestId(MENU_ITEM_ID.DELETE);
      expect(deleteButton).toHaveAttribute("data-disabled", "true");

      const restoreToOriginalButton = screen.getByTestId(MENU_ITEM_ID.RESTORE_TO_ORIGINAL);
      expect(restoreToOriginalButton).toHaveAttribute("data-disabled", "true");
    }
  );

  test("should display context menu with enabled actions when experience is processed", async () => {
    // GIVEN the ExperiencesDrawerContent component with a PROCESSED experience
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent
        experience={{ ...mockExperiences[0], exploration_phase: DiveInPhase.PROCESSED }}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // AND the more button is clicked
    const moreButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
    await userEvent.click(moreButton);

    // THEN the context menu should be displayed
    const contextMenu = screen.getByTestId(CONTEXT_MENU_DATA_TEST_ID.MENU);
    expect(contextMenu).toBeInTheDocument();

    // AND there should not be a header message
    expect(screen.queryByTestId(CONTEXT_MENU_DATA_TEST_ID.MENU_HEADER_MESSAGE)).not.toBeInTheDocument();

    // AND all menu items should be enabled
    const editButton = screen.getByTestId(MENU_ITEM_ID.EDIT);
    expect(editButton).toHaveAttribute("data-disabled", "false");

    const deleteButton = screen.getByTestId(MENU_ITEM_ID.DELETE);
    expect(deleteButton).toHaveAttribute("data-disabled", "false");

    const restoreToOriginalButton = screen.getByTestId(MENU_ITEM_ID.RESTORE_TO_ORIGINAL);
    expect(restoreToOriginalButton).toHaveAttribute("data-disabled", "false");
  });

  test("it should show No skills yet when there are no skills", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent
        experience={{ ...mockExperiences[0], top_skills: [] }}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);

    // THEN expect No skills yet to be in the document
    expect(screen.getByText("No skills discovered yet")).toBeInTheDocument();
  });

  test("should show skill description when chip is clicked", () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} onEdit={jest.fn()} onDelete={jest.fn()} />
    );
    // AND the component is rendered
    render(givenReportDrawerContent);

    // WHEN the chip is clicked
    const chip = screen.getAllByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CHIP)[0];
    fireEvent.click(chip);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the skill popover to be in the document
    expect(screen.getByTestId(SKILL_POPOVER_TEST_ID.SKILL_POPOVER)).toBeInTheDocument();
    // AND the skill description to be in the document
    expect(screen.getByText(mockExperiences[0].top_skills[0].description)).toBeInTheDocument();
  });

  test("should close popover when clicked outside", async () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={{ ...mockExperiences[0] }} onEdit={jest.fn()} onDelete={jest.fn()} />
    );
    // AND the component is rendered
    render(givenReportDrawerContent);
    // AND the chip is clicked
    const chip = screen.getAllByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CHIP)[0];
    await userEvent.click(chip);
    // AND the popover is open
    expect(screen.getByTestId(SKILL_POPOVER_TEST_ID.SKILL_POPOVER)).toBeInTheDocument();

    // WHEN the user clicks outside the popover
    await userEvent.keyboard("{Escape}");

    // THEN expect the popover to be invisible
    expect(screen.queryByTestId(SKILL_POPOVER_TEST_ID.SKILL_POPOVER)).not.toBeInTheDocument();
    // AND expect the skill description to not be in the document
    expect(screen.queryByText(mockExperiences[0].top_skills[0].description)).not.toBeInTheDocument();
  });

  test("should call onEdit when edit button is clicked", async () => {
    // GIVEN the ExperiencesDrawerContent component
    const onEditMock = jest.fn();
    // GIVEN some experiences that have been explored
    const givenExploredExperiences = mockExperiences[0];
    givenExploredExperiences.exploration_phase = DiveInPhase.PROCESSED;
    // AND the ExperiencesDrawer component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={givenExploredExperiences} onEdit={onEditMock} onDelete={jest.fn()} />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);
    // AND the more button is clicked to open the context menu
    const moreButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
    await userEvent.click(moreButton);
    // AND the edit button is clicked
    const editButton = screen.getByTestId(MENU_ITEM_ID.EDIT);
    await userEvent.click(editButton);

    // THEN expect onEdit to have been called with the correct experience
    expect(onEditMock).toHaveBeenCalledWith(mockExperiences[0]);
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should call onDelete when delete button is clicked", async () => {
    // GIVEN the ExperiencesDrawerContent component
    const onDeleteMock = jest.fn();
    // GIVEN some experiences that have been explored
    const givenExploredExperiences = mockExperiences[0];
    givenExploredExperiences.exploration_phase = DiveInPhase.PROCESSED;
    // AND the ExperiencesDrawer component
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={givenExploredExperiences} onEdit={jest.fn()} onDelete={onDeleteMock} />
    );

    // WHEN the component is rendered
    render(givenReportDrawerContent);
    // AND the more button is clicked to open the context menu
    const moreButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
    await userEvent.click(moreButton);
    // AND the delete button is clicked
    const deleteButton = screen.getByTestId(MENU_ITEM_ID.DELETE);
    await userEvent.click(deleteButton);

    // THEN expect onDelete to have been called with the correct experience
    expect(onDeleteMock).toHaveBeenCalledWith(mockExperiences[0]);
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should close context menu when clicked outside", async () => {
    // GIVEN the ExperiencesDrawerContent component
    const givenExploredExperiences = { ...mockExperiences[0], exploration_phase: DiveInPhase.PROCESSED };
    const givenReportDrawerContent = (
      <ExperiencesDrawerContent experience={givenExploredExperiences} onEdit={jest.fn()} onDelete={jest.fn()} />
    );
    // AND the component is rendered
    render(givenReportDrawerContent);

    // WHEN the more button is clicked to open the context menu
    const moreButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
    await userEvent.click(moreButton);

    // THEN expect the context menu to be visible
    expect(screen.getByTestId(CONTEXT_MENU_DATA_TEST_ID.MENU)).toBeInTheDocument();

    // WHEN the close button in the context menu is clicked
    const closeButton = screen.getByTestId("close-menu-button");
    await userEvent.click(closeButton);

    // THEN the more button should be able to be clicked again
    await userEvent.click(moreButton);
    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("Restore to Original functionality", () => {
    test("should show restore to original menu item in context menu", () => {
      // GIVEN an experience with restore to original handler
      const mockOnRestoreToOriginal = jest.fn();
      const experience = { ...mockExperiences[0], exploration_phase: DiveInPhase.PROCESSED };

      // WHEN the component is rendered
      render(
        <ExperiencesDrawerContent
          experience={experience}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onRestoreToOriginal={mockOnRestoreToOriginal}
        />
      );

      // AND the more menu button is clicked
      const moreButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
      fireEvent.click(moreButton);

      // THEN the restore to original menu item should be visible
      expect(screen.getByText(MENU_ITEM_TEXT.REVERT)).toBeInTheDocument();
    });

    test("should call onRestoreToOriginal when restore to original menu item is clicked", () => {
      // GIVEN an experience with restore to original handler
      const mockOnRestoreToOriginal = jest.fn();
      const experience = { ...mockExperiences[0], exploration_phase: DiveInPhase.PROCESSED };

      // WHEN the component is rendered
      render(
        <ExperiencesDrawerContent
          experience={experience}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onRestoreToOriginal={mockOnRestoreToOriginal}
        />
      );

      // AND the more menu button is clicked
      const moreButton = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON);
      fireEvent.click(moreButton);

      // AND the restore to original menu item is clicked
      const restoreToOriginalMenuItem = screen.getByText(MENU_ITEM_TEXT.REVERT);
      fireEvent.click(restoreToOriginalMenuItem);

      // THEN the onRestoreToOriginal handler should be called with the experience
      expect(mockOnRestoreToOriginal).toHaveBeenCalledWith(experience);
    });
  });
});
